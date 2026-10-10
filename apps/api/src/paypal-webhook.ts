import { createVerify } from 'node:crypto';

const certificateHosts = new Set([
  'api.sandbox.paypal.com',
  'api-m.sandbox.paypal.com',
]);
const certificateTtlMs = 6 * 60 * 60 * 1000;
const crcTable = Array.from({ length: 256 }, (_, value) => {
  let crc = value;
  for (let bit = 0; bit < 8; bit++)
    crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
  return crc >>> 0;
});

export type PayPalSignatureHeaders = {
  transmissionId: string;
  transmissionTime: string;
  certUrl: string;
  authAlgo: string;
  transmissionSig: string;
};

export function crc32(rawBody: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of rawBody)
    crc = crcTable[(crc ^ byte) & 0xff]! ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

export class PayPalWebhookVerifier {
  private readonly certificates = new Map<
    string,
    { pem: string; expiresAt: number }
  >();

  constructor(private readonly fetcher: typeof fetch = fetch) {}

  async verify(
    rawBody: Buffer,
    headers: PayPalSignatureHeaders,
    webhookId: string,
  ): Promise<boolean> {
    if (
      !rawBody.length ||
      !webhookId ||
      !headers.transmissionId ||
      !headers.transmissionTime ||
      headers.authAlgo !== 'SHA256withRSA' ||
      !/^[A-Za-z0-9+/]+={0,2}$/.test(headers.transmissionSig) ||
      !this.isCertificateUrlAllowed(headers.certUrl)
    )
      return false;

    const certificate = await this.getCertificate(headers.certUrl);
    const message = `${headers.transmissionId}|${headers.transmissionTime}|${webhookId}|${crc32(rawBody)}`;
    try {
      const verifier = createVerify('RSA-SHA256');
      verifier.update(message);
      verifier.end();
      return verifier.verify(
        certificate,
        Buffer.from(headers.transmissionSig, 'base64'),
      );
    } catch {
      return false;
    }
  }

  private isCertificateUrlAllowed(value: string): boolean {
    try {
      const url = new URL(value);
      return (
        url.protocol === 'https:' &&
        certificateHosts.has(url.hostname) &&
        !url.port &&
        !url.username &&
        !url.password &&
        !url.search &&
        !url.hash &&
        /^\/v1\/notifications\/certs\/[A-Za-z0-9-]+$/.test(url.pathname)
      );
    } catch {
      return false;
    }
  }

  private async getCertificate(url: string): Promise<string> {
    const cached = this.certificates.get(url);
    if (cached && cached.expiresAt > Date.now()) return cached.pem;
    try {
      const response = await this.fetcher(url, {
        method: 'GET',
        redirect: 'error',
        signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) throw new Error('Certificate request failed');
      const pem = await response.text();
      if (!pem || pem.length > 64_000) throw new Error('Invalid certificate');
      this.certificates.set(url, {
        pem,
        expiresAt: Date.now() + certificateTtlMs,
      });
      return pem;
    } catch {
      throw new Error('PayPal webhook certificate unavailable');
    }
  }
}

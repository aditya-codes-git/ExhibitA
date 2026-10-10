import { createSign, generateKeyPairSync } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import {
  crc32,
  PayPalWebhookVerifier,
  type PayPalSignatureHeaders,
} from '../src/paypal-webhook.js';

const webhookId = 'WH-TEST-123';
const certUrl =
  'https://api.sandbox.paypal.com/v1/notifications/certs/CERT-TEST';
const { privateKey, publicKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
});
const certificate = publicKey
  .export({ type: 'spki', format: 'pem' })
  .toString();

function signedHeaders(rawBody: Buffer): PayPalSignatureHeaders {
  const transmissionId = 'transmission-123';
  const transmissionTime = '2026-10-10T12:00:00Z';
  const message = `${transmissionId}|${transmissionTime}|${webhookId}|${crc32(rawBody)}`;
  const signer = createSign('RSA-SHA256');
  signer.update(message);
  signer.end();
  return {
    transmissionId,
    transmissionTime,
    certUrl,
    authAlgo: 'SHA256withRSA',
    transmissionSig: signer.sign(privateKey).toString('base64'),
  };
}

describe('PayPal webhook signature verifier', () => {
  it('computes the standard CRC32 checksum as unsigned decimal', () => {
    expect(crc32(Buffer.from('123456789'))).toBe(3421780262);
  });

  it('accepts a valid Sandbox RSA signature over the exact raw body', async () => {
    const rawBody = Buffer.from('{ "id":"EVENT-1" }');
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(certificate));
    const verifier = new PayPalWebhookVerifier(fetcher);

    await expect(
      verifier.verify(rawBody, signedHeaders(rawBody), webhookId),
    ).resolves.toBe(true);
    expect(fetcher.mock.calls[0]?.[0]).toBe(certUrl);
    expect(fetcher.mock.calls[0]?.[1]?.redirect).toBe('error');
  });

  it('rejects a body altered after PayPal signed it', async () => {
    const rawBody = Buffer.from('{"id":"EVENT-1"}');
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(certificate));
    const verifier = new PayPalWebhookVerifier(fetcher);

    await expect(
      verifier.verify(
        Buffer.from('{ "id":"EVENT-1" }'),
        signedHeaders(rawBody),
        webhookId,
      ),
    ).resolves.toBe(false);
  });

  it('rejects unsupported algorithms and certificate URLs outside the Sandbox allowlist', async () => {
    const rawBody = Buffer.from('{"id":"EVENT-1"}');
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(certificate));
    const verifier = new PayPalWebhookVerifier(fetcher);
    const headers = signedHeaders(rawBody);

    await expect(
      verifier.verify(
        rawBody,
        { ...headers, authAlgo: 'SHA1withRSA' },
        webhookId,
      ),
    ).resolves.toBe(false);
    await expect(
      verifier.verify(
        rawBody,
        { ...headers, certUrl: 'https://attacker.example/cert' },
        webhookId,
      ),
    ).resolves.toBe(false);
    await expect(
      verifier.verify(
        rawBody,
        { ...headers, certUrl: 'https://api.sandbox.paypal.com/not-a-cert' },
        webhookId,
      ),
    ).resolves.toBe(false);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('rejects certificate redirects and sanitizes certificate fetch errors', async () => {
    const rawBody = Buffer.from('{"id":"EVENT-1"}');
    const redirectFetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(null, { status: 302 }));
    const verifier = new PayPalWebhookVerifier(redirectFetcher);
    await expect(
      verifier.verify(rawBody, signedHeaders(rawBody), webhookId),
    ).rejects.toThrow('PayPal webhook certificate unavailable');

    const failedFetcher = vi
      .fn<typeof fetch>()
      .mockRejectedValue(new Error('private-network-detail'));
    await expect(
      new PayPalWebhookVerifier(failedFetcher).verify(
        rawBody,
        signedHeaders(rawBody),
        webhookId,
      ),
    ).rejects.toThrow('PayPal webhook certificate unavailable');
  });

  it('caches a certificate between verifications', async () => {
    const rawBody = Buffer.from('{"id":"EVENT-1"}');
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(certificate));
    const verifier = new PayPalWebhookVerifier(fetcher);
    const headers = signedHeaders(rawBody);

    await expect(verifier.verify(rawBody, headers, webhookId)).resolves.toBe(
      true,
    );
    await expect(verifier.verify(rawBody, headers, webhookId)).resolves.toBe(
      true,
    );
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});

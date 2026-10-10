import { createSign, generateKeyPairSync } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import supertest from 'supertest';
import type { PrismaClient } from '../src/generated/prisma/client.js';
import { parsePayPalWebhookEvent } from '../src/paypal-webhook-event.js';
import {
  crc32,
  PayPalWebhookVerifier,
  type PayPalSignatureHeaders,
} from '../src/paypal-webhook.js';
import { createApp } from './test-auth.js';

const webhookId = 'WH-TEST-123';
const certUrl =
  'https://api.sandbox.paypal.com/v1/notifications/certs/CERT-TEST';
const { privateKey, publicKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
});
const certificate = publicKey
  .export({ type: 'spki', format: 'pem' })
  .toString();

const localOrderId = '3fa85f64-5717-4562-b3fc-2c963f66afa6';
const paypalOrderId = 'PP_ORDER_123';
const eventPayload = {
  id: 'WH-EVENT-123',
  event_type: 'PAYMENT.CAPTURE.COMPLETED',
  create_time: '2026-10-10T12:00:00Z',
  resource_type: 'capture',
  resource: {
    id: 'CAPTURE_123',
    status: 'COMPLETED',
    amount: { currency_code: 'USD', value: '25.00' },
    create_time: '2026-10-10T11:59:59Z',
    supplementary_data: { related_ids: { order_id: paypalOrderId } },
    payer: { email_address: 'buyer@example.invalid' },
  },
};
const rawEvent = Buffer.from(JSON.stringify(eventPayload));
const requestHeaders = {
  'paypal-transmission-id': 'transmission-123',
  'paypal-transmission-time': '2026-10-10T12:00:00Z',
  'paypal-cert-url': certUrl,
  'paypal-auth-algo': 'SHA256withRSA',
  'paypal-transmission-sig': 'mock-signature',
};

function databaseForOrder(order: { id: string } | null) {
  const tx = {
    order: { findUnique: vi.fn().mockResolvedValue(order) },
    capture: { findUnique: vi.fn().mockResolvedValue(null) },
    payPalWebhookEvent: {
      upsert: vi.fn().mockResolvedValue({ id: 'receipt' }),
    },
    evidenceEvent: { createMany: vi.fn().mockResolvedValue({ count: 1 }) },
  };
  const database = {
    $transaction: vi.fn(async (run: (transaction: typeof tx) => unknown) =>
      run(tx),
    ),
  } as unknown as PrismaClient;
  return { database, tx };
}

function webhookApp({
  database,
  verifier,
  webhookId = 'WH-TEST-123',
}: {
  database?: PrismaClient;
  verifier?: { verify: ReturnType<typeof vi.fn> };
  webhookId?: string;
} = {}) {
  return createApp({
    config: {
      port: 3001,
      ...(webhookId ? { paypalWebhookId: webhookId } : {}),
    },
    database,
    paypalWebhookVerifier: verifier,
  });
}

async function postWebhook(
  app: ReturnType<typeof webhookApp>,
  body = rawEvent,
  headers = requestHeaders,
) {
  return supertest(app)
    .post('/api/paypal/webhook')
    .set('Content-Type', 'application/json')
    .set(headers)
    .send(body.toString('utf8'));
}

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
      .mockImplementation(async () => new Response(certificate));
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

  it('bounds the certificate cache by evicting its oldest entry', async () => {
    const rawBody = Buffer.from('{"id":"EVENT-1"}');
    const fetcher = vi
      .fn<typeof fetch>()
      .mockImplementation(async () => new Response(certificate));
    const verifier = new PayPalWebhookVerifier(fetcher);
    for (let index = 0; index < 33; index++) {
      const headers = {
        ...signedHeaders(rawBody),
        certUrl: `https://api.sandbox.paypal.com/v1/notifications/certs/CERT-${index}`,
      };
      await expect(verifier.verify(rawBody, headers, webhookId)).resolves.toBe(
        true,
      );
    }
    await verifier.verify(
      rawBody,
      {
        ...signedHeaders(rawBody),
        certUrl: 'https://api.sandbox.paypal.com/v1/notifications/certs/CERT-0',
      },
      webhookId,
    );
    expect(fetcher).toHaveBeenCalledTimes(34);
  });
});

describe('PayPal webhook event normalization', () => {
  it('maps only safe event fields and excludes personal data', () => {
    const event = parsePayPalWebhookEvent(rawEvent);
    expect(event.paypalOrderId).toBe(paypalOrderId);
    expect(event.relatedCaptureId).toBe('CAPTURE_123');
    expect(event.payload).toEqual({
      status: 'COMPLETED',
      amount: { currencyCode: 'USD', value: '25.00' },
    });
    expect(JSON.stringify(event)).not.toContain('buyer@example.invalid');
  });

  it('uses a checkout order resource ID for CHECKOUT.ORDER events', () => {
    const event = parsePayPalWebhookEvent(
      Buffer.from(
        JSON.stringify({
          ...eventPayload,
          event_type: 'CHECKOUT.ORDER.APPROVED',
          resource_type: 'checkout-order',
          resource: { id: paypalOrderId },
        }),
      ),
    );
    expect(event.paypalOrderId).toBe(paypalOrderId);
  });

  it('rejects malformed or incomplete event envelopes', () => {
    expect(() => parsePayPalWebhookEvent(Buffer.from('{'))).toThrow();
    expect(() =>
      parsePayPalWebhookEvent(Buffer.from(JSON.stringify({ id: 'missing' }))),
    ).toThrow();
  });
});

describe('PayPal webhook route', () => {
  it('accepts verified matched events without bearer auth and writes receipt plus timeline atomically', async () => {
    const { database, tx } = databaseForOrder({ id: localOrderId });
    const verifier = { verify: vi.fn().mockResolvedValue(true) };
    const response = await postWebhook(webhookApp({ database, verifier }));

    expect(response.status, response.text).toBe(200);
    expect(verifier.verify).toHaveBeenCalledWith(
      expect.any(Buffer),
      expect.objectContaining({ transmissionId: 'transmission-123' }),
      'WH-TEST-123',
    );
    expect(tx.payPalWebhookEvent.upsert).toHaveBeenCalledOnce();
    expect(tx.evidenceEvent.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: [
          expect.objectContaining({
            orderId: localOrderId,
            source: 'PAYPAL',
            kind: 'PAYPAL_WEBHOOK',
            externalEventId: eventPayload.id,
          }),
        ],
        skipDuplicates: true,
      }),
    );
    const upsert = tx.payPalWebhookEvent.upsert.mock.calls[0]?.[0];
    expect(JSON.stringify(upsert)).not.toContain('buyer@example.invalid');
  });

  it('fails closed when webhook ID is absent and rejects missing headers before verification', async () => {
    const verifier = { verify: vi.fn().mockResolvedValue(true) };
    const noId = await postWebhook(webhookApp({ verifier, webhookId: '' }));
    expect(noId.status).toBe(503);

    const missingHeaders = await postWebhook(
      webhookApp({ database: databaseForOrder(null).database, verifier }),
      rawEvent,
      {},
    );
    expect(missingHeaders.status, missingHeaders.text).toBe(400);
    expect(verifier.verify).not.toHaveBeenCalled();
  });

  it('does not write when the signature is invalid and retains unmatched events', async () => {
    const { database, tx } = databaseForOrder(null);
    const invalidVerifier = { verify: vi.fn().mockResolvedValue(false) };
    const invalid = await postWebhook(
      webhookApp({ database, verifier: invalidVerifier }),
    );
    expect(invalid.status).toBe(400);
    expect(database.$transaction).not.toHaveBeenCalled();

    const validVerifier = { verify: vi.fn().mockResolvedValue(true) };
    const unmatched = await postWebhook(
      webhookApp({ database, verifier: validVerifier }),
    );
    expect(unmatched.status, unmatched.text).toBe(200);
    expect(tx.payPalWebhookEvent.upsert).toHaveBeenCalled();
    expect(tx.evidenceEvent.createMany).not.toHaveBeenCalled();
  });

  it('uses a related capture ID when order ID is not included', async () => {
    const { database, tx } = databaseForOrder(null);
    tx.capture.findUnique.mockResolvedValue({ orderId: localOrderId });
    const verifier = { verify: vi.fn().mockResolvedValue(true) };
    const payload = {
      ...eventPayload,
      resource: {
        id: 'CAPTURE_123',
        status: 'COMPLETED',
        supplementary_data: { related_ids: { capture_id: 'CAPTURE_123' } },
      },
    };
    const response = await postWebhook(
      webhookApp({ database, verifier }),
      Buffer.from(JSON.stringify(payload)),
    );
    expect(response.status, response.text).toBe(200);
    expect(tx.capture.findUnique).toHaveBeenCalledWith({
      where: { paypalCaptureId: 'CAPTURE_123' },
      select: { orderId: true },
    });
    expect(tx.evidenceEvent.createMany).toHaveBeenCalledOnce();
  });

  it('retains unmatched deliveries and attaches the receipt when a later retry matches', async () => {
    const { database, tx } = databaseForOrder(null);
    tx.order.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValue({ id: localOrderId });
    const verifier = { verify: vi.fn().mockResolvedValue(true) };
    const app = webhookApp({ database, verifier });

    expect((await postWebhook(app)).status).toBe(200);
    expect((await postWebhook(app)).status).toBe(200);
    tx.order.findUnique.mockResolvedValue({ id: localOrderId });
    expect((await postWebhook(app)).status).toBe(200);

    expect(tx.payPalWebhookEvent.upsert).toHaveBeenCalledTimes(3);
    expect(tx.payPalWebhookEvent.upsert.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        where: { paypalEventId: eventPayload.id },
        create: expect.objectContaining({ orderId: null }),
      }),
    );
    expect(tx.payPalWebhookEvent.upsert.mock.calls[2]?.[0]).toEqual(
      expect.objectContaining({
        where: { paypalEventId: eventPayload.id },
        update: { orderId: localOrderId },
      }),
    );
    expect(tx.evidenceEvent.createMany).toHaveBeenCalledOnce();
  });

  it('returns retryable errors for missing dependencies and persistence failures', async () => {
    const noDatabase = await postWebhook(
      webhookApp({ verifier: { verify: vi.fn().mockResolvedValue(true) } }),
    );
    expect(noDatabase.status, noDatabase.text).toBe(503);

    const failedDatabase = {
      $transaction: vi.fn().mockRejectedValue(new Error('db unavailable')),
    } as unknown as PrismaClient;
    const failed = await postWebhook(
      webhookApp({
        database: failedDatabase,
        verifier: { verify: vi.fn().mockResolvedValue(true) },
      }),
    );
    expect(failed.status).toBe(503);
  });
});

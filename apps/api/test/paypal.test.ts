import { describe, expect, it, vi } from 'vitest';
import { PayPalClient } from '../src/paypal.js';

const requestId = '89c85c50-85a6-4bb4-8990-0ddfd99230b7';
const input = {
  amountMinor: 105,
  requestId,
  reference: 'local-order-1',
  returnUrl: 'http://localhost:5173/return',
  cancelUrl: 'http://localhost:5173/cancel',
};
const token = {
  access_token: 'mock-token',
  token_type: 'Bearer',
  expires_in: 300,
};
function setup(responses: Array<{ body: unknown; status?: number }>) {
  const fetcher = vi.fn<typeof fetch>();
  for (const response of responses)
    fetcher.mockResolvedValueOnce(
      new Response(JSON.stringify(response.body), {
        status: response.status ?? 200,
      }),
    );
  return {
    fetcher,
    client: new PayPalClient(
      { clientId: 'mock-client', clientSecret: 'mock-secret' },
      fetcher,
    ),
  };
}

describe('PayPal adapter (mocked HTTP, not Sandbox)', () => {
  it('redacts malformed callback URLs before network access', async () => {
    const { client, fetcher } = setup([]);
    await expect(
      client.createOrder({
        ...input,
        returnUrl: 'https://user:private-test-value@',
      }),
    ).rejects.toThrow('Invalid PayPal request');
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('authenticates with the fixed Sandbox origin and caches the token', async () => {
    const { client, fetcher } = setup([{ body: token }]);
    await client.verifyCredentials();
    await client.verifyCredentials();
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher.mock.calls[0]?.[0]).toBe(
      'https://api-m.sandbox.paypal.com/v1/oauth2/token',
    );
    expect(
      new Headers(fetcher.mock.calls[0]?.[1]?.headers).get('Authorization'),
    ).toBe(
      `Basic ${Buffer.from('mock-client:mock-secret').toString('base64')}`,
    );
  });
  it('sends exact minor-unit amounts and the stable request ID', async () => {
    const { client, fetcher } = setup([
      { body: token },
      {
        body: {
          id: 'ORDER123',
          status: 'PAYER_ACTION_REQUIRED',
          links: [
            {
              rel: 'payer-action',
              href: 'https://www.sandbox.paypal.com/checkoutnow?token=ORDER123',
            },
          ],
        },
      },
    ]);
    const order = await client.createOrder(input);
    expect(order.id).toBe('ORDER123');
    const init = fetcher.mock.calls[1]?.[1];
    expect(new Headers(init?.headers).get('PayPal-Request-Id')).toBe(requestId);
    expect(JSON.parse(String(init?.body)).purchase_units[0].amount).toEqual({
      currency_code: 'USD',
      value: '1.05',
    });
  });
  it.each([0, -1, 1.5, Number.MAX_SAFE_INTEGER])(
    'rejects invalid minor-unit amount %s before network access',
    async (amountMinor) => {
      const { client, fetcher } = setup([]);
      await expect(
        client.createOrder({ ...input, amountMinor }),
      ).rejects.toThrow('Invalid PayPal request');
      expect(fetcher).not.toHaveBeenCalled();
    },
  );
  it('rejects approval links outside PayPal Sandbox', async () => {
    const { client } = setup([
      { body: token },
      {
        body: {
          id: 'ORDER123',
          status: 'CREATED',
          links: [
            { rel: 'approve', href: 'https://example.com/fake-checkout' },
          ],
        },
      },
    ]);
    await expect(client.createOrder(input)).rejects.toThrow(
      'Invalid PayPal response',
    );
  });
  it('rejects failed authentication without exposing provider response contents', async () => {
    const { client } = setup([
      { body: { message: 'mock-secret' }, status: 401 },
    ]);
    await expect(client.verifyCredentials()).rejects.toThrow('PayPal HTTP 401');
  });
  it('rejects malformed successful responses', async () => {
    const { client } = setup([{ body: { unexpected: 'value' } }]);
    await expect(client.verifyCredentials()).rejects.toThrow(
      'Invalid PayPal response',
    );
  });
  it('returns pending capture status without claiming payment completion', async () => {
    const { client, fetcher } = setup([
      { body: token },
      { body: { id: 'ORDER123', status: 'APPROVED' } },
    ]);
    const result = await client.captureOrder('ORDER123', requestId);
    expect(result.status).toBe('APPROVED');
    expect(fetcher.mock.calls[1]?.[0]).toBe(
      'https://api-m.sandbox.paypal.com/v2/checkout/orders/ORDER123/capture',
    );
    expect(
      new Headers(fetcher.mock.calls[1]?.[1]?.headers).get('PayPal-Request-Id'),
    ).toBe(requestId);
  });
  it('rejects a capture response for a different order', async () => {
    const { client } = setup([
      { body: token },
      { body: { id: 'OTHER123', status: 'COMPLETED' } },
    ]);
    await expect(client.captureOrder('ORDER123', requestId)).rejects.toThrow(
      'Invalid PayPal response',
    );
  });
});

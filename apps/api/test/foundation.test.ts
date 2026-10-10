import { describe, expect, it, vi } from 'vitest';
import request from './test-auth.js';
import { parseConfig } from '../src/config.js';
import { createApp } from './test-auth.js';
import type { PayPalClient } from '../src/paypal.js';

describe('configuration', () => {
  it('redacts malformed credential-bearing database URLs', () => {
    const check = () =>
      parseConfig({ DATABASE_URL: 'postgresql://user:private-test-value@' });
    expect(check).toThrow('Invalid configuration: DATABASE_URL');
    try {
      check();
    } catch (error) {
      expect(JSON.stringify(error)).not.toContain('private-test-value');
    }
  });
  it('allows a foundation startup without integration credentials', () => {
    expect(parseConfig({})).toEqual({ port: 3001 });
  });
  it('rejects partial PayPal credentials without exposing the supplied secret', () => {
    expect(() =>
      parseConfig({ PAYPAL_CLIENT_SECRET: 'private-test-value' }),
    ).toThrow('PAYPAL_CLIENT_ID');
    try {
      parseConfig({ PAYPAL_CLIENT_SECRET: 'private-test-value' });
    } catch (error) {
      expect(String(error)).not.toContain('private-test-value');
    }
  });
  it.each([{ PORT: 'invalid' }, { DATABASE_URL: 'https://example.com' }])(
    'rejects malformed configuration %j',
    (env) => {
      expect(() => parseConfig(env)).toThrow('Invalid configuration');
    },
  );
});

describe('health', () => {
  it('keeps liveness separate from unconfigured integrations', async () => {
    const app = createApp({ config: { port: 3001 } });
    expect((await request(app).get('/api/health')).status).toBe(200);
    const response = await request(app).get('/api/readiness');
    expect(response.status).toBe(503);
    expect(response.body).toEqual({
      database: 'not_configured',
      paypal: 'not_configured',
      paymentFlow: 'not_implemented',
    });
  });
  it('reports database failure without leaking connection details', async () => {
    const app = createApp({
      config: { port: 3001, databaseUrl: 'postgresql://private-test-value' },
      checkDatabase: async () => {
        throw new Error('private-test-value');
      },
    });
    const response = await request(app).get('/api/readiness');
    expect(response.status).toBe(503);
    expect(response.body.database).toBe('unavailable');
    expect(response.text).not.toContain('private-test-value');
  });
  it('does not equate configured PayPal credentials with verified payments', async () => {
    const app = createApp({
      config: {
        port: 3001,
        databaseUrl: 'postgresql://test',
        paypalClientId: 'id',
        paypalClientSecret: 'secret',
      },
      checkDatabase: async () => {},
    });
    const response = await request(app).get('/api/readiness');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      database: 'connected',
      paypal: 'configured_unverified',
      paymentFlow: 'not_implemented',
    });
    expect(response.text).not.toContain('secret');
  });

  const config = {
    port: 3001,
    databaseUrl: 'postgresql://private-test-value',
    paypalClientId: 'id',
    paypalClientSecret: 'secret',
  };

  it('reports the payment flow ready only after database and OAuth succeed', async () => {
    const paypalClient = {
      verifyCredentials: vi.fn().mockResolvedValue(undefined),
    } as unknown as PayPalClient;
    const app = createApp({
      config,
      checkDatabase: async () => {},
      paypalClient,
    });
    const response = await request(app).get('/api/readiness');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      database: 'connected',
      paypal: 'verified',
      paymentFlow: 'ready',
    });
    expect(paypalClient.verifyCredentials).toHaveBeenCalledOnce();
  });

  it('does not expose OAuth errors or report ready when PayPal fails', async () => {
    const paypalClient = {
      verifyCredentials: vi
        .fn()
        .mockRejectedValue(new Error('private-test-value')),
    } as unknown as PayPalClient;
    const app = createApp({
      config,
      checkDatabase: async () => {},
      paypalClient,
    });
    const response = await request(app).get('/api/readiness');
    expect(response.body).toEqual({
      database: 'connected',
      paypal: 'configured_unverified',
      paymentFlow: 'not_implemented',
    });
    expect(response.text).not.toContain('private-test-value');
    expect(response.text).not.toContain('secret');
  });

  it('does not report the payment flow ready when database is unavailable', async () => {
    const paypalClient = {
      verifyCredentials: vi.fn().mockResolvedValue(undefined),
    } as unknown as PayPalClient;
    const app = createApp({
      config,
      checkDatabase: async () => {
        throw new Error('private-test-value');
      },
      paypalClient,
    });
    const response = await request(app).get('/api/readiness');
    expect(response.status).toBe(503);
    expect(response.body).toEqual({
      database: 'unavailable',
      paypal: 'verified',
      paymentFlow: 'not_implemented',
    });
    expect(response.text).not.toContain('private-test-value');
  });
});

import { describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import type { PrismaClient } from '../src/generated/prisma/client.js';
import type { PayPalClient } from '../src/paypal.js';
import { verifyAccessToken } from '../src/auth.js';

const userId = 'user-a';
const verifyToken = vi.fn(async (token: string) =>
  token === 'valid-token' ? { id: userId } : null,
);

describe('merchant API authorization', () => {
  it('keeps health and the fixed store product public but guards readiness', async () => {
    const app = createApp({ config: { port: 3001 }, verifyToken });
    expect((await request(app).get('/api/health')).status).toBe(200);
    expect((await request(app).get('/api/demo-store/product')).status).toBe(
      200,
    );
    expect((await request(app).get('/api/readiness')).status).toBe(401);
  });
  it('rejects missing, malformed and invalid tokens before touching data', async () => {
    const database = {
      order: { findMany: vi.fn() },
    } as unknown as PrismaClient;
    const app = createApp({ config: { port: 3001 }, database, verifyToken });
    expect((await request(app).get('/api/orders')).status).toBe(401);
    expect(
      (
        await request(app)
          .get('/api/orders')
          .set('Authorization', 'Basic valid-token')
      ).status,
    ).toBe(401);
    expect(
      (
        await request(app)
          .get('/api/orders')
          .set('Authorization', 'Bearer invalid')
      ).status,
    ).toBe(401);
    expect(database.order.findMany).not.toHaveBeenCalled();
  });

  it('scopes order lists to the verified user merchant', async () => {
    const database = {
      order: { findMany: vi.fn().mockResolvedValue([]) },
    } as unknown as PrismaClient;
    const app = createApp({ config: { port: 3001 }, database, verifyToken });
    const response = await request(app)
      .get('/api/orders')
      .set('Authorization', 'Bearer valid-token');
    expect(response.status).toBe(200);
    expect(database.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { merchant: { authUserId: userId } } }),
    );
  });

  it('uses atomic merchant creation for the first saved case', async () => {
    const merchant = { id: 'merchant-a', authUserId: userId };
    const database = {
      merchant: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockRejectedValue(new Error('unique constraint')),
        upsert: vi.fn().mockResolvedValue(merchant),
      },
      $transaction: vi.fn(async (callback) =>
        callback({
          order: { create: vi.fn().mockResolvedValue({ id: 'order-a' }) },
          evidenceCase: { create: vi.fn() },
        }),
      ),
    } as unknown as PrismaClient;
    const app = createApp({ config: { port: 3001 }, database, verifyToken });
    const response = await request(app)
      .post('/api/agent-cases')
      .set('Authorization', 'Bearer valid-token');
    expect(response.status).toBe(201);
    expect(database.merchant.upsert).toHaveBeenCalledWith({
      where: { authUserId: userId },
      create: { name: 'ExhibitA Merchant', authUserId: userId },
      update: {},
    });
    expect(database.merchant.create).not.toHaveBeenCalled();
  });

  it('hides another merchant order from detail, capture and agent-run routes', async () => {
    const database = {
      order: { findFirst: vi.fn().mockResolvedValue(null) },
      evidenceCase: { updateMany: vi.fn() },
    } as unknown as PrismaClient;
    const paypalClient = { captureOrder: vi.fn() } as unknown as PayPalClient;
    const app = createApp({
      config: { port: 3001 },
      database,
      paypalClient,
      agentModel: {} as never,
      verifyToken,
    });
    for (const method of ['get', 'capture', 'run'] as const) {
      const response =
        method === 'get'
          ? await request(app)
              .get('/api/orders/foreign')
              .set('Authorization', 'Bearer valid-token')
          : method === 'capture'
            ? await request(app)
                .post('/api/orders/foreign/capture')
                .set('Authorization', 'Bearer valid-token')
            : await request(app)
                .post('/api/agent-cases/foreign/run')
                .set('Authorization', 'Bearer valid-token');
      expect(response.status).toBe(404);
    }
    expect(paypalClient.captureOrder).not.toHaveBeenCalled();
    expect(database.evidenceCase.updateMany).not.toHaveBeenCalled();
  });

  it('returns a JSON error when ownership lookup fails', async () => {
    const database = {
      order: {
        findFirst: vi.fn().mockRejectedValue(new Error('connection dropped')),
      },
    } as unknown as PrismaClient;
    const app = createApp({ config: { port: 3001 }, database, verifyToken });
    const response = await request(app)
      .post('/api/agent-cases/order-a/run')
      .set('Authorization', 'Bearer valid-token');
    expect(response.status).toBe(500);
    expect(response.headers['content-type']).toMatch(/json/);
    expect(JSON.stringify(response.body)).not.toContain('connection dropped');
  });
});

describe('Supabase token verification', () => {
  it('uses the Auth server response and returns only its verified user ID', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify({ id: userId, user_metadata: { role: 'admin' } }),
          { status: 200 },
        ),
      );
    vi.stubGlobal('fetch', fetchMock);
    try {
      await expect(
        verifyAccessToken('access-token', {
          port: 3001,
          supabaseUrl: 'https://project.supabase.co',
          supabaseAnonKey: 'public-key',
        }),
      ).resolves.toEqual({ id: userId });
      expect(fetchMock.mock.calls[0]![0]).toBe(
        'https://project.supabase.co/auth/v1/user',
      );
      expect(fetchMock.mock.calls[0]![1].headers).toMatchObject({
        apikey: 'public-key',
        Authorization: 'Bearer access-token',
      });
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('rejects an expired token reported by Supabase Auth', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('{}', { status: 401 })),
    );
    try {
      await expect(
        verifyAccessToken('expired', {
          port: 3001,
          supabaseUrl: 'https://project.supabase.co',
          supabaseAnonKey: 'public-key',
        }),
      ).resolves.toBeNull();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('rejects a malformed token reported as a client error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('{}', { status: 400 })),
    );
    try {
      await expect(
        verifyAccessToken('malformed', {
          port: 3001,
          supabaseUrl: 'https://project.supabase.co',
          supabaseAnonKey: 'public-key',
        }),
      ).resolves.toBeNull();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

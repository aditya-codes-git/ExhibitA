import { describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import type { PrismaClient } from '../src/generated/prisma/client.js';
import type { PayPalClient } from '../src/paypal.js';
import type { AgentModel } from '../src/jersey-agent.js';

const orderId = '3fa85f64-5717-4562-b3fc-2c963f66afa6';

describe('recorded agent case', () => {
  it('creates a fixed case before making any PayPal request', async () => {
    const order = { id: orderId, amountMinor: 2500, status: 'LOCAL_CREATED' };
    const tx = {
      order: { create: vi.fn().mockResolvedValue(order) },
      evidenceCase: { create: vi.fn() },
    };
    const database = {
      merchant: { findFirst: vi.fn().mockResolvedValue({ id: 'merchant' }) },
      $transaction: vi.fn(async (run) => run(tx)),
    } as unknown as PrismaClient;
    const response = await request(
      createApp({ config: { port: 3001 }, database }),
    )
      .post('/api/agent-cases')
      .send({
        amountMinor: 1,
        itemName: 'wrong',
        agentActionSource: 'EXTERNAL_AGENT',
      });
    expect(response.status).toBe(201);
    expect(response.body).toEqual({ orderId });
    expect(tx.order.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        amountMinor: 2500,
        status: 'LOCAL_CREATED',
      }),
    });
    expect(tx.evidenceCase.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        agentRunStatus: 'READY',
        agentActionSource: null,
      }),
    });
  });

  it('returns the saved events in occurrence order', async () => {
    const database = {
      order: {
        findUnique: vi.fn().mockResolvedValue({
          id: orderId,
          captures: [],
          evidenceCase: null,
          evidenceEvents: [],
        }),
      },
    } as unknown as PrismaClient;
    const response = await request(
      createApp({ config: { port: 3001 }, database }),
    ).get(`/api/orders/${orderId}`);
    expect(response.status).toBe(200);
    expect(database.order.findUnique).toHaveBeenCalledWith({
      where: { id: orderId },
      include: expect.objectContaining({
        evidenceEvents: {
          orderBy: [{ occurredAt: 'asc' }, { recordedAt: 'asc' }],
        },
      }),
    });
  });

  it('claims a run once and returns the guarded checkout result', async () => {
    const database = {
      evidenceCase: {
        updateMany: vi
          .fn()
          .mockResolvedValueOnce({ count: 1 })
          .mockResolvedValueOnce({ count: 0 }),
        update: vi.fn().mockResolvedValue({}),
      },
      evidenceEvent: { create: vi.fn().mockResolvedValue({}) },
      order: {
        findUnique: vi.fn().mockResolvedValue({
          id: orderId,
          amountMinor: 2500,
          currency: 'USD',
          createRequestId: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
        }),
        update: vi.fn().mockResolvedValue({}),
      },
    } as unknown as PrismaClient;
    const paypalClient = {
      createOrder: vi.fn().mockResolvedValue({
        id: 'PP_ORDER_123',
        approvalUrl:
          'https://www.sandbox.paypal.com/checkoutnow?token=PP_ORDER_123',
      }),
    } as unknown as PayPalClient;
    const responses = [
      {
        tool_calls: [
          {
            id: 'lookup',
            type: 'function',
            function: {
              name: 'inspect_product',
              arguments: '{"productId":"jersey-2026-home-player"}',
            },
          },
        ],
      },
      {
        tool_calls: [
          {
            id: 'checkout',
            type: 'function',
            function: {
              name: 'initiate_sandbox_checkout',
              arguments:
                '{"productId":"jersey-2026-home-player","amountMinor":2500}',
            },
          },
        ],
      },
    ];
    const agentModel = {
      complete: vi.fn().mockImplementation(async () => responses.shift()),
    } as unknown as AgentModel;
    const app = createApp({
      config: { port: 3001 },
      database,
      paypalClient,
      agentModel,
    });
    const first = await request(app).post(`/api/agent-cases/${orderId}/run`);
    const second = await request(app).post(`/api/agent-cases/${orderId}/run`);
    expect(first.status).toBe(200);
    expect(first.body.paypalOrderId).toBe('PP_ORDER_123');
    expect(second.status).toBe(409);
    expect(paypalClient.createOrder).toHaveBeenCalledOnce();
    expect(database.evidenceCase.update).toHaveBeenCalledWith({
      where: { orderId },
      data: { agentRunStatus: 'CHECKOUT_READY' },
    });
  });

  it('keeps a missing Groq configuration from claiming the case', async () => {
    const database = {
      evidenceCase: { updateMany: vi.fn() },
    } as unknown as PrismaClient;
    const paypalClient = {} as PayPalClient;
    const response = await request(
      createApp({ config: { port: 3001 }, database, paypalClient }),
    ).post(`/api/agent-cases/${orderId}/run`);
    expect(response.status).toBe(503);
    expect(database.evidenceCase.updateMany).not.toHaveBeenCalled();
  });

  it('marks a model failure incomplete without leaking its error', async () => {
    const database = {
      evidenceCase: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        update: vi.fn().mockResolvedValue({}),
      },
      order: {
        findUnique: vi.fn().mockResolvedValue({
          id: orderId,
          amountMinor: 2500,
          currency: 'USD',
          createRequestId: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
        }),
      },
    } as unknown as PrismaClient;
    const agentModel = {
      complete: vi.fn().mockRejectedValue(new Error('secret-provider-detail')),
    } as unknown as AgentModel;
    const response = await request(
      createApp({
        config: { port: 3001 },
        database,
        paypalClient: {} as PayPalClient,
        agentModel,
      }),
    ).post(`/api/agent-cases/${orderId}/run`);
    expect(response.status).toBe(502);
    expect(JSON.stringify(response.body)).not.toContain(
      'secret-provider-detail',
    );
    expect(database.evidenceCase.update).toHaveBeenCalledWith({
      where: { orderId },
      data: { agentRunStatus: 'FAILED' },
    });
  });
});

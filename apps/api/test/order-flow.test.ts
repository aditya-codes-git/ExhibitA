import { describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { extractCaptureDetails } from '../src/paypal.js';
import type { PrismaClient } from '../src/generated/prisma/client.js';
import type { PayPalClient } from '../src/paypal.js';

describe('extractCaptureDetails', () => {
  it('extracts valid capture details with exact minor units and timestamp', () => {
    const paypalResponse = {
      id: 'ORDER_123',
      status: 'COMPLETED',
      purchase_units: [
        {
          reference_id: 'local_order_1',
          payments: {
            captures: [
              {
                id: 'CAPTURE_789',
                status: 'COMPLETED',
                amount: {
                  currency_code: 'USD',
                  value: '15.50',
                },
                create_time: '2026-10-05T12:00:00Z',
              },
            ],
          },
        },
      ],
    };

    const details = extractCaptureDetails(paypalResponse);
    expect(details.paypalCaptureId).toBe('CAPTURE_789');
    expect(details.status).toBe('COMPLETED');
    expect(details.amountMinor).toBe(1550);
    expect(details.currency).toBe('USD');
    expect(details.occurredAt.toISOString()).toBe('2026-10-05T12:00:00.000Z');
  });

  it('rejects capture response with non-USD currency', () => {
    const invalidCurrency = {
      purchase_units: [
        {
          payments: {
            captures: [
              {
                id: 'CAP1',
                status: 'COMPLETED',
                amount: { currency_code: 'EUR', value: '10.00' },
              },
            ],
          },
        },
      ],
    };
    expect(() => extractCaptureDetails(invalidCurrency)).toThrow(
      'Invalid capture currency or non-positive amount',
    );
  });

  it('rejects capture response with non-positive amount', () => {
    const zeroAmount = {
      purchase_units: [
        {
          payments: {
            captures: [
              {
                id: 'CAP1',
                status: 'COMPLETED',
                amount: { currency_code: 'USD', value: '0.00' },
              },
            ],
          },
        },
      ],
    };
    expect(() => extractCaptureDetails(zeroAmount)).toThrow(
      'Invalid capture currency or non-positive amount',
    );
  });

  it('rejects capture response when no capture records exist', () => {
    expect(() => extractCaptureDetails({ purchase_units: [] })).toThrow(
      'No valid capture records found in PayPal response',
    );
  });

  it.each(['15.505', '1e2', 'not-a-number'])(
    'rejects imprecise PayPal amount %s',
    (value) => {
      expect(() =>
        extractCaptureDetails({
          purchase_units: [
            {
              payments: {
                captures: [
                  {
                    id: 'CAP1',
                    status: 'COMPLETED',
                    amount: { currency_code: 'USD', value },
                    create_time: '2026-10-05T12:00:00Z',
                  },
                ],
              },
            },
          ],
        }),
      ).toThrow('Invalid capture amount');
    },
  );
});

describe('order flow endpoints (mocked db and paypal)', () => {
  it('returns 503 if database or paypal is missing when creating order', async () => {
    const appWithoutDeps = createApp({ config: { port: 3001 } });
    const res = await request(appWithoutDeps).post('/api/orders').send({});
    expect(res.status).toBe(503);
  });

  it('creates an order, persists to database, and requests PayPal approval link', async () => {
    const mockOrder = {
      id: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
      merchantId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
      amountMinor: 2500,
      currency: 'USD',
      status: 'LOCAL_CREATED',
      paypalOrderId: null,
      createRequestId: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
      captureRequestId: 'c3d4e5f6-a7b8-9012-cdef-123456789012',
    };

    const mockDb = {
      merchant: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
          name: 'ExhibitA Demo Merchant',
        }),
      },
      order: {
        create: vi.fn().mockResolvedValue(mockOrder),
        update: vi.fn().mockResolvedValue({
          ...mockOrder,
          paypalOrderId: 'PP_ORDER_999',
          status: 'PAYPAL_ORDER_CREATED',
        }),
      },
    } as unknown as PrismaClient;

    const mockPayPal = {
      createOrder: vi.fn().mockResolvedValue({
        id: 'PP_ORDER_999',
        status: 'PAYER_ACTION_REQUIRED',
        approvalUrl:
          'https://www.sandbox.paypal.com/checkoutnow?token=PP_ORDER_999',
      }),
    } as unknown as PayPalClient;

    const app = createApp({
      config: {
        port: 3001,
        databaseUrl: 'postgresql://localhost:5432/exhibita',
        paypalClientId: 'mock-client',
        paypalClientSecret: 'mock-secret',
      },
      database: mockDb,
      paypalClient: mockPayPal,
    });

    const res = await request(app)
      .post('/api/orders')
      .set('Origin', 'https://attacker.example')
      .send({ amountMinor: 2500 });

    expect(res.status).toBe(201);
    expect(res.body).toEqual({
      orderId: mockOrder.id,
      paypalOrderId: 'PP_ORDER_999',
      approvalUrl:
        'https://www.sandbox.paypal.com/checkoutnow?token=PP_ORDER_999',
      amountMinor: 2500,
      currency: 'USD',
      itemName: 'AI-Assisted Demonstration Item',
    });

    expect(mockDb.order.create).toHaveBeenCalled();
    expect(mockPayPal.createOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        amountMinor: 2500,
        reference: mockOrder.id,
        returnUrl: `http://127.0.0.1:5173/return?orderId=${mockOrder.id}`,
      }),
    );
    expect(mockDb.order.update).toHaveBeenCalledWith({
      where: { id: mockOrder.id },
      data: {
        paypalOrderId: 'PP_ORDER_999',
        status: 'PAYPAL_ORDER_CREATED',
      },
    });
  });

  it('captures an approved PayPal order and atomically persists capture in database', async () => {
    const existingOrder = {
      id: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
      merchantId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
      amountMinor: 2500,
      currency: 'USD',
      status: 'PAYPAL_ORDER_CREATED',
      paypalOrderId: 'PP_ORDER_999',
      createRequestId: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
      captureRequestId: 'c3d4e5f6-a7b8-9012-cdef-123456789012',
      captures: [],
      merchant: { name: 'ExhibitA Demo Merchant' },
    };

    const mockPayPalCaptureResponse = {
      id: 'PP_ORDER_999',
      status: 'COMPLETED',
      purchase_units: [
        {
          payments: {
            captures: [
              {
                id: 'CAPTURE_555',
                status: 'COMPLETED',
                amount: { currency_code: 'USD', value: '25.00' },
                create_time: '2026-10-05T12:30:00Z',
              },
            ],
          },
        },
      ],
    };

    const savedCapture = {
      id: 'cap-uuid-1',
      orderId: existingOrder.id,
      paypalCaptureId: 'CAPTURE_555',
      status: 'COMPLETED',
      amountMinor: 2500,
      currency: 'USD',
      occurredAt: new Date('2026-10-05T12:30:00Z'),
    };

    const completedOrder = {
      ...existingOrder,
      status: 'COMPLETED',
      captures: [savedCapture],
    };

    const mockDb = {
      order: {
        findUnique: vi.fn().mockResolvedValue(existingOrder),
      },
      capture: {
        findUnique: vi.fn().mockResolvedValue(null),
      },
      $transaction: vi.fn().mockImplementation(async (callback) => {
        const tx = {
          capture: {
            create: vi.fn().mockResolvedValue(savedCapture),
          },
          order: {
            update: vi.fn().mockResolvedValue(completedOrder),
          },
        };
        return callback(tx);
      }),
    } as unknown as PrismaClient;

    const mockPayPal = {
      captureOrder: vi.fn().mockResolvedValue(mockPayPalCaptureResponse),
    } as unknown as PayPalClient;

    const app = createApp({
      config: {
        port: 3001,
        databaseUrl: 'postgresql://localhost:5432/exhibita',
        paypalClientId: 'mock-client',
        paypalClientSecret: 'mock-secret',
      },
      database: mockDb,
      paypalClient: mockPayPal,
    });

    const res = await request(app).post(
      `/api/orders/${existingOrder.id}/capture`,
    );

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.order.status).toBe('COMPLETED');
    expect(res.body.capture.paypalCaptureId).toBe('CAPTURE_555');
    expect(mockPayPal.captureOrder).toHaveBeenCalledWith(
      'PP_ORDER_999',
      existingOrder.captureRequestId,
    );
  });

  it('does not persist a PayPal capture whose amount differs from the local order', async () => {
    const transaction = vi.fn();
    const database = {
      order: {
        findUnique: vi.fn().mockResolvedValue({
          id: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
          amountMinor: 2500,
          paypalOrderId: 'PP_ORDER_999',
          captureRequestId: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
          status: 'PAYPAL_ORDER_CREATED',
          captures: [],
        }),
      },
      capture: { findUnique: vi.fn().mockResolvedValue(null) },
      $transaction: transaction,
    } as unknown as PrismaClient;
    const paypalClient = {
      captureOrder: vi.fn().mockResolvedValue({
        id: 'PP_ORDER_999',
        status: 'COMPLETED',
        purchase_units: [
          {
            payments: {
              captures: [
                {
                  id: 'CAPTURE_555',
                  status: 'COMPLETED',
                  amount: { currency_code: 'USD', value: '15.00' },
                  create_time: '2026-10-05T12:30:00Z',
                },
              ],
            },
          },
        ],
      }),
    } as unknown as PayPalClient;
    const app = createApp({ config: { port: 3001 }, database, paypalClient });
    const response = await request(app).post(
      '/api/orders/3fa85f64-5717-4562-b3fc-2c963f66afa6/capture',
    );
    expect(response.status).toBe(500);
    expect(transaction).not.toHaveBeenCalled();
  });

  it('handles already captured orders idempotently without re-invoking PayPal capture', async () => {
    const capturedOrder = {
      id: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
      status: 'COMPLETED',
      paypalOrderId: 'PP_ORDER_999',
      captures: [
        {
          id: 'cap-1',
          paypalCaptureId: 'CAPTURE_555',
          status: 'COMPLETED',
          amountMinor: 2500,
        },
      ],
      merchant: { name: 'Demo' },
    };

    const mockDb = {
      order: {
        findUnique: vi.fn().mockResolvedValue(capturedOrder),
      },
    } as unknown as PrismaClient;

    const mockPayPal = {
      captureOrder: vi.fn(),
    } as unknown as PayPalClient;

    const app = createApp({
      config: {
        port: 3001,
        databaseUrl: 'postgresql://localhost:5432/exhibita',
        paypalClientId: 'mock-client',
        paypalClientSecret: 'mock-secret',
      },
      database: mockDb,
      paypalClient: mockPayPal,
    });

    const res = await request(app).post(
      `/api/orders/${capturedOrder.id}/capture`,
    );

    expect(res.status).toBe(200);
    expect(res.body.alreadyCaptured).toBe(true);
    expect(mockPayPal.captureOrder).not.toHaveBeenCalled();
  });

  it('returns the committed order when a duplicate capture finds an existing record', async () => {
    const id = '3fa85f64-5717-4562-b3fc-2c963f66afa6';
    const capture = {
      orderId: id,
      paypalCaptureId: 'CAPTURE_555',
      status: 'COMPLETED',
      amountMinor: 1,
      currency: 'USD',
    };
    const staleOrder = {
      id,
      amountMinor: 1,
      status: 'PAYPAL_ORDER_CREATED',
      paypalOrderId: 'PP_ORDER_999',
      captureRequestId: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
      captures: [],
    };
    const database = {
      order: {
        findUnique: vi
          .fn()
          .mockResolvedValueOnce(staleOrder)
          .mockResolvedValueOnce({
            ...staleOrder,
            status: 'COMPLETED',
            captures: [capture],
          }),
      },
      capture: { findUnique: vi.fn().mockResolvedValue(capture) },
    } as unknown as PrismaClient;
    const paypalClient = {
      captureOrder: vi.fn().mockResolvedValue({
        id: 'PP_ORDER_999',
        status: 'COMPLETED',
        purchase_units: [
          {
            payments: {
              captures: [
                {
                  id: 'CAPTURE_555',
                  status: 'COMPLETED',
                  amount: { currency_code: 'USD', value: '0.01' },
                },
              ],
            },
          },
        ],
      }),
    } as unknown as PayPalClient;

    const response = await request(
      createApp({ config: { port: 3001 }, database, paypalClient }),
    ).post(`/api/orders/${id}/capture`);

    expect(response.status).toBe(200);
    expect(response.body.order.status).toBe('COMPLETED');
    expect(response.body.capture.status).toBe('COMPLETED');
  });
});

describe('fixed jersey evidence case', () => {
  const orderId = '3fa85f64-5717-4562-b3fc-2c963f66afa6';

  function setup(paypalFails = false, legacy = false) {
    const order: Record<string, unknown> = { id: orderId };
    const evidenceCase: Record<string, unknown> = { orderId };
    const tx = {
      order: {
        create: vi.fn(async ({ data }) => Object.assign(order, data)),
        update: vi.fn(async ({ data }) => Object.assign(order, data)),
      },
      evidenceCase: {
        create: vi.fn(async ({ data }) => Object.assign(evidenceCase, data)),
        update: vi.fn(async ({ data }) => Object.assign(evidenceCase, data)),
      },
    };
    const database = {
      merchant: { findFirst: vi.fn().mockResolvedValue({ id: 'merchant-id' }) },
      $transaction: vi.fn(async (callback) => callback(tx)),
      order: {
        findUnique: vi.fn(async ({ include }) => ({
          ...order,
          captures: [],
          ...(include.evidenceCase
            ? { evidenceCase: legacy ? null : evidenceCase }
            : {}),
        })),
        findMany: vi.fn(async ({ include }) => [
          {
            ...order,
            captures: [],
            ...(include.evidenceCase
              ? { evidenceCase: legacy ? null : evidenceCase }
              : {}),
          },
        ]),
      },
    } as unknown as PrismaClient;
    const paypalClient = {
      createOrder: paypalFails
        ? vi.fn().mockRejectedValue(new Error('Sandbox unavailable'))
        : vi.fn().mockResolvedValue({
            id: 'PP_ORDER_999',
            approvalUrl:
              'https://www.sandbox.paypal.com/checkoutnow?token=PP_ORDER_999',
          }),
    } as unknown as PayPalClient;
    const app = createApp({ config: { port: 3001 }, database, paypalClient });
    return { app, database, paypalClient, tx, order, evidenceCase };
  }

  it('stores the fixed request and simulated action around PayPal order creation', async () => {
    const { app, database, paypalClient, tx, order, evidenceCase } = setup();
    const response = await request(app).post('/api/orders').send({
      demoCase: 'football_jersey_2026',
      agentActionSource: 'EXTERNAL_AGENT',
      agentActionAt: '2000-01-01T00:00:00Z',
      status: 'COMPLETED',
      paypalOrderId: 'FAKE',
    });

    expect(response.status).toBe(201);
    expect(response.body.amountMinor).toBe(2500);
    expect(response.body.currency).toBe('USD');
    expect(response.body.paypalOrderId).toBe('PP_ORDER_999');
    expect(order.amountMinor).toBe(2500);
    expect(order.status).toBe('PAYPAL_ORDER_CREATED');
    expect(evidenceCase).toMatchObject({
      buyerInstruction:
        'Buy the Real Madrid 2026 home jersey, player edition, for $25 from Demo Sports Shop.',
      itemName: 'Real Madrid 2026 home jersey, player edition',
      shopName: 'Demo Sports Shop',
      agentActionSource: 'SIMULATED_DEMO',
    });
    expect(evidenceCase.agentActionAt).toBeInstanceOf(Date);
    expect(database.$transaction).toHaveBeenCalledTimes(2);
    expect(tx.evidenceCase.create).toHaveBeenCalledBefore(
      paypalClient.createOrder as ReturnType<typeof vi.fn>,
    );
    expect(paypalClient.createOrder).toHaveBeenCalledBefore(
      tx.evidenceCase.update,
    );
    expect(paypalClient.createOrder).toHaveBeenCalledWith(
      expect.objectContaining({ amountMinor: 2500, reference: orderId }),
    );

    const saved = await request(app).get(`/api/orders/${orderId}`);
    expect(saved.body.evidenceCase.agentActionSource).toBe('SIMULATED_DEMO');
  });

  it.each([
    { demoCase: 'other_case' },
    { demoCase: 'football_jersey_2026', amountMinor: 1 },
    { demoCase: 'football_jersey_2026', itemName: 'Other item' },
  ])('rejects invalid demo input before database writes: %j', async (body) => {
    const { app, database } = setup();
    const response = await request(app).post('/api/orders').send(body);
    expect(response.status).toBe(400);
    expect(database.merchant.findFirst).not.toHaveBeenCalled();
    expect(database.$transaction).not.toHaveBeenCalled();
  });

  it('keeps action evidence absent when PayPal order creation fails', async () => {
    const { app, database, order, evidenceCase } = setup(true);
    const response = await request(app)
      .post('/api/orders')
      .send({ demoCase: 'football_jersey_2026' });
    expect(response.status).toBe(500);
    expect(database.$transaction).toHaveBeenCalledTimes(1);
    expect(order.status).toBe('LOCAL_CREATED');
    expect(evidenceCase.agentActionSource).toBeNull();
    expect(evidenceCase.agentActionAt).toBeNull();
  });

  it('returns legacy orders with a null case in both read endpoints', async () => {
    const { app, database } = setup(false, true);
    const one = await request(app).get(`/api/orders/${orderId}`);
    const many = await request(app).get('/api/orders');
    expect(one.body.evidenceCase).toBeNull();
    expect(many.body[0].evidenceCase).toBeNull();
    expect(database.order.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({ evidenceCase: true }),
      }),
    );
  });
});

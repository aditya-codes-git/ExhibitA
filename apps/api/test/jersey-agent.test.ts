import { describe, expect, it, vi } from 'vitest';
import type { PrismaClient } from '../src/generated/prisma/client.js';
import type { PayPalClient } from '../src/paypal.js';
import { runJerseyAgent, type AgentModel } from '../src/jersey-agent.js';

const order = {
  id: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
  amountMinor: 2500,
  currency: 'USD',
  createRequestId: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
};
const call = (id: string, name: string, args: object) => ({
  id,
  type: 'function' as const,
  function: { name, arguments: JSON.stringify(args) },
});
function setup(calls: ReturnType<typeof call>[]) {
  const model = {
    complete: vi
      .fn()
      .mockImplementation(async () => ({ tool_calls: [calls.shift()] })),
  } as unknown as AgentModel;
  const database = {
    evidenceEvent: { create: vi.fn().mockResolvedValue({}) },
    order: { update: vi.fn().mockResolvedValue({}) },
  } as unknown as PrismaClient;
  const paypalClient = {
    createOrder: vi.fn().mockResolvedValue({
      id: 'PP_ORDER_123',
      approvalUrl:
        'https://www.sandbox.paypal.com/checkoutnow?token=PP_ORDER_123',
    }),
  } as unknown as PayPalClient;
  return { model, database, paypalClient };
}

describe('constrained jersey agent', () => {
  it('persists actual lookup and checkout calls and results', async () => {
    const fixture = setup([
      call('lookup-1', 'inspect_product', {
        productId: 'jersey-2026-home-player',
      }),
      call('checkout-1', 'initiate_sandbox_checkout', {
        productId: 'jersey-2026-home-player',
        amountMinor: 2500,
      }),
    ]);
    const result = await runJerseyAgent({ ...fixture, order });
    expect(result.paypalOrderId).toBe('PP_ORDER_123');
    expect(fixture.paypalClient.createOrder).toHaveBeenCalledOnce();
    expect(fixture.model.complete).toHaveBeenNthCalledWith(
      1,
      expect.any(Array),
      expect.any(AbortSignal),
      'inspect_product',
    );
    expect(fixture.model.complete).toHaveBeenNthCalledWith(
      2,
      expect.arrayContaining([
        expect.objectContaining({
          role: 'assistant',
          tool_calls: [expect.objectContaining({ id: 'lookup-1' })],
        }),
        expect.objectContaining({ role: 'tool', tool_call_id: 'lookup-1' }),
      ]),
      expect.any(AbortSignal),
      'initiate_sandbox_checkout',
    );
    expect(fixture.database.evidenceEvent.create).toHaveBeenCalledTimes(4);
    expect(fixture.database.evidenceEvent.create).toHaveBeenNthCalledWith(1, {
      data: expect.objectContaining({
        source: 'AGENT_MODEL',
        kind: 'TOOL_REQUEST',
        externalEventId: 'lookup-1',
      }),
    });
    expect(fixture.database.evidenceEvent.create).toHaveBeenNthCalledWith(2, {
      data: expect.objectContaining({
        source: 'DEMO_STORE',
        kind: 'TOOL_RESULT',
      }),
    });
    expect(
      JSON.stringify(
        (fixture.database.evidenceEvent.create as ReturnType<typeof vi.fn>).mock
          .calls,
      ),
    ).not.toMatch(/api.key|approvalUrl|clientSecret/i);
  });

  it.each([
    [
      call('early', 'initiate_sandbox_checkout', {
        productId: 'jersey-2026-home-player',
        amountMinor: 2500,
      }),
    ],
    [call('wrong', 'inspect_product', { productId: 'different' })],
  ])('rejects unsafe first calls before PayPal', async (first) => {
    const fixture = setup([first]);
    await expect(runJerseyAgent({ ...fixture, order })).rejects.toThrow();
    expect(fixture.paypalClient.createOrder).not.toHaveBeenCalled();
  });

  it('rejects the wrong amount after a valid lookup', async () => {
    const fixture = setup([
      call('lookup', 'inspect_product', {
        productId: 'jersey-2026-home-player',
      }),
      call('wrong-price', 'initiate_sandbox_checkout', {
        productId: 'jersey-2026-home-player',
        amountMinor: 1,
      }),
    ]);
    await expect(runJerseyAgent({ ...fixture, order })).rejects.toThrow();
    expect(fixture.paypalClient.createOrder).not.toHaveBeenCalled();
  });

  it('keeps a PayPal failure incomplete after recording the request', async () => {
    const fixture = setup([
      call('lookup', 'inspect_product', {
        productId: 'jersey-2026-home-player',
      }),
      call('checkout', 'initiate_sandbox_checkout', {
        productId: 'jersey-2026-home-player',
        amountMinor: 2500,
      }),
    ]);
    vi.mocked(fixture.paypalClient.createOrder).mockRejectedValue(
      new Error('PayPal unavailable'),
    );
    await expect(runJerseyAgent({ ...fixture, order })).rejects.toThrow(
      'PayPal unavailable',
    );
    expect(fixture.database.evidenceEvent.create).toHaveBeenCalledTimes(3);
    expect(fixture.database.order.update).not.toHaveBeenCalled();
  });

  it('rejects duplicate tool call IDs without another PayPal request', async () => {
    const fixture = setup([
      call('same-id', 'inspect_product', {
        productId: 'jersey-2026-home-player',
      }),
      call('same-id', 'initiate_sandbox_checkout', {
        productId: 'jersey-2026-home-player',
        amountMinor: 2500,
      }),
    ]);
    await expect(runJerseyAgent({ ...fixture, order })).rejects.toThrow(
      'duplicate or invalid',
    );
    expect(fixture.paypalClient.createOrder).not.toHaveBeenCalled();
  });

  it('rejects a model answer without a tool call', async () => {
    const fixture = setup([]);
    vi.mocked(fixture.model.complete).mockResolvedValue({
      content: 'I bought it',
    });
    await expect(runJerseyAgent({ ...fixture, order })).rejects.toThrow(
      'one tool',
    );
    expect(fixture.database.evidenceEvent.create).not.toHaveBeenCalled();
  });
});

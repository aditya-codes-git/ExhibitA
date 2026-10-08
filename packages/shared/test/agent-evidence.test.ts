import { describe, expect, it } from 'vitest';
import { evidenceEventSchema, orderItemSchema } from '../src/index.js';

describe('agent evidence contracts', () => {
  it('accepts a source-labeled event but rejects unsupported sources', () => {
    const event = {
      id: '6e283cfa-35b4-4aed-9ac9-d00d3ab3d194',
      orderId: 'd73ffbba-2105-4f29-9e85-de71b40df79e',
      source: 'DEMO_STORE',
      kind: 'TOOL_RESULT',
      externalEventId: 'lookup-1',
      occurredAt: '2026-10-08T10:00:00.000Z',
      recordedAt: '2026-10-08T10:00:01.000Z',
      payload: { product: { productId: 'jersey-2026-home-player' } },
    };
    expect(evidenceEventSchema.parse(event).externalEventId).toBe('lookup-1');
    expect(
      evidenceEventSchema.safeParse({ ...event, source: 'PAYPAL' }).success,
    ).toBe(false);
  });

  it('treats missing event arrays on historical orders as empty', () => {
    const order = {
      id: 'd73ffbba-2105-4f29-9e85-de71b40df79e',
      merchantId: '6e283cfa-35b4-4aed-9ac9-d00d3ab3d194',
      amountMinor: 2500,
      currency: 'USD',
      status: 'COMPLETED',
      paypalOrderId: null,
      createRequestId: 'a85e163f-3975-4185-8d78-2059855c5bc8',
      captureRequestId: 'e3f15166-d520-4e13-9087-125e5fcfe9cd',
      createdAt: '2026-10-08T10:00:00.000Z',
      updatedAt: '2026-10-08T10:00:01.000Z',
      captures: [],
      evidenceCase: null,
    };
    expect(orderItemSchema.parse(order).evidenceEvents).toEqual([]);
  });
});

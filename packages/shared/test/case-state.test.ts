import { describe, expect, it } from 'vitest';
import * as shared from '../src/index.js';

describe('saved case payment state', () => {
  const isComplete = Reflect.get(shared, 'isCaseCaptureComplete') as
    | ((order: {
        status: string;
        captures: Array<{ status: string }>;
      }) => boolean)
    | undefined;

  it('requires both the order and a capture to be completed', () => {
    expect(
      isComplete?.({
        status: 'COMPLETED',
        captures: [{ status: 'COMPLETED' }],
      }),
    ).toBe(true);
    expect(isComplete?.({ status: 'COMPLETED', captures: [] })).toBe(false);
    expect(
      isComplete?.({
        status: 'PAYPAL_ORDER_CREATED',
        captures: [{ status: 'COMPLETED' }],
      }),
    ).toBe(false);
  });
});

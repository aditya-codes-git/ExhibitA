import { z } from 'zod';

export const readinessSchema = z.object({
  database: z.enum(['not_configured', 'connected', 'unavailable']),
  paypal: z.enum(['not_configured', 'configured_unverified', 'verified']),
  paymentFlow: z.enum(['not_implemented', 'ready']),
});
export type Readiness = z.infer<typeof readinessSchema>;

export const createOrderRequestSchema = z.object({
  amountMinor: z.number().int().min(1).max(1_000_000).default(1500),
  itemName: z.string().max(200).optional(),
});
export type CreateOrderRequest = z.infer<typeof createOrderRequestSchema>;

export const createOrderResponseSchema = z.object({
  orderId: z.string().uuid(),
  paypalOrderId: z.string(),
  approvalUrl: z.string().url(),
  amountMinor: z.number().int(),
  currency: z.literal('USD'),
});
export type CreateOrderResponse = z.infer<typeof createOrderResponseSchema>;

export const captureItemSchema = z.object({
  id: z.string().uuid(),
  orderId: z.string().uuid(),
  paypalCaptureId: z.string(),
  status: z.string(),
  amountMinor: z.number().int(),
  currency: z.string(),
  occurredAt: z.string(),
  recordedAt: z.string(),
});
export type CaptureItem = z.infer<typeof captureItemSchema>;

export const orderItemSchema = z.object({
  id: z.string().uuid(),
  merchantId: z.string().uuid(),
  merchantName: z.string().optional(),
  amountMinor: z.number().int(),
  currency: z.string(),
  status: z.string(),
  paypalOrderId: z.string().nullable(),
  createRequestId: z.string().uuid(),
  captureRequestId: z.string().uuid(),
  createdAt: z.string(),
  updatedAt: z.string(),
  captures: z.array(captureItemSchema).default([]),
});
export type OrderItem = z.infer<typeof orderItemSchema>;

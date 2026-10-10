import { z } from 'zod';

const envelope = z.object({
  id: z.string().trim().min(1).max(120),
  event_type: z.string().trim().min(1).max(120),
  create_time: z.string().datetime({ offset: true }),
  resource_type: z.string().trim().min(1).max(80),
  resource: z.object({
    id: z.string().trim().min(1).max(120),
    status: z.string().trim().min(1).max(40).optional(),
    amount: z
      .object({
        currency_code: z.string().trim().min(1).max(3),
        value: z.string().trim().min(1).max(32),
      })
      .optional(),
    supplementary_data: z
      .object({
        related_ids: z
          .object({
            order_id: z.string().trim().min(1).max(64).optional(),
            capture_id: z.string().trim().min(1).max(64).optional(),
          })
          .optional(),
      })
      .optional(),
  }),
});

export function parsePayPalWebhookEvent(rawBody: Buffer) {
  let body: unknown;
  try {
    body = JSON.parse(rawBody.toString('utf8'));
  } catch {
    throw new Error('Invalid PayPal webhook event');
  }
  const parsed = envelope.safeParse(body);
  if (!parsed.success) throw new Error('Invalid PayPal webhook event');

  const { resource } = parsed.data;
  const relatedIds = resource.supplementary_data?.related_ids;
  const paypalOrderId =
    relatedIds?.order_id ??
    (parsed.data.event_type.startsWith('CHECKOUT.ORDER.')
      ? resource.id
      : undefined);
  const relatedCaptureId =
    relatedIds?.capture_id ??
    (parsed.data.resource_type.toLowerCase().includes('capture')
      ? resource.id
      : undefined);
  return {
    paypalEventId: parsed.data.id,
    eventType: parsed.data.event_type,
    resourceType: parsed.data.resource_type,
    resourceId: resource.id,
    ...(paypalOrderId ? { paypalOrderId } : {}),
    ...(relatedCaptureId ? { relatedCaptureId } : {}),
    occurredAt: new Date(parsed.data.create_time),
    payload: {
      ...(resource.status ? { status: resource.status } : {}),
      ...(resource.amount
        ? {
            amount: {
              currencyCode: resource.amount.currency_code,
              value: resource.amount.value,
            },
          }
        : {}),
    },
  };
}

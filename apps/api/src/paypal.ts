import { z } from 'zod';

const sandboxOrigin = 'https://api-m.sandbox.paypal.com';
const tokenSchema = z.object({
  access_token: z.string().min(1),
  expires_in: z.number().positive(),
  token_type: z.literal('Bearer'),
});
const orderSchema = z.object({
  id: z.string().regex(/^[A-Z0-9]{1,64}$/),
  status: z.enum([
    'CREATED',
    'SAVED',
    'APPROVED',
    'VOIDED',
    'COMPLETED',
    'PAYER_ACTION_REQUIRED',
  ]),
  links: z
    .array(z.object({ rel: z.string(), href: z.string().url() }))
    .optional(),
  purchase_units: z.array(z.unknown()).optional(),
});
const callbackSchema = z
  .string()
  .url()
  .refine((value) => {
    const url = URL.parse(value);
    return (
      url !== null &&
      (url.protocol === 'https:' ||
        (url.protocol === 'http:' &&
          ['localhost', '127.0.0.1'].includes(url.hostname)))
    );
  });
const createSchema = z.object({
  amountMinor: z.number().int().min(1).max(1_000_000),
  requestId: z.uuid(),
  reference: z.string().min(1).max(127),
  returnUrl: callbackSchema,
  cancelUrl: callbackSchema,
});
export type CreateOrderInput = z.infer<typeof createSchema>;

function validate<T>(
  schema: z.ZodType<T>,
  data: unknown,
  kind: 'request' | 'response',
): T {
  const result = schema.safeParse(data);
  if (!result.success) throw new Error(`Invalid PayPal ${kind}`);
  return result.data;
}

/** Sandbox transport only. The caller must enforce ownership and persist request IDs. */
export class PayPalClient {
  private token?: { value: string; expiresAt: number };
  constructor(
    private readonly credentials: { clientId: string; clientSecret: string },
    private readonly fetcher: typeof fetch = fetch,
  ) {}

  private async request(path: string, init: RequestInit): Promise<unknown> {
    let response: Response;
    try {
      response = await this.fetcher(`${sandboxOrigin}${path}`, {
        ...init,
        signal: AbortSignal.timeout(15_000),
        redirect: 'error',
      });
    } catch {
      throw new Error('PayPal request failed or timed out');
    }
    if (!response.ok) throw new Error(`PayPal HTTP ${response.status}`);
    try {
      return await response.json();
    } catch {
      throw new Error('Invalid PayPal response');
    }
  }

  private async accessToken(): Promise<string> {
    if (this.token && this.token.expiresAt > Date.now())
      return this.token.value;
    const data = validate(
      tokenSchema,
      await this.request('/v1/oauth2/token', {
        method: 'POST',
        headers: {
          Authorization: `Basic ${Buffer.from(`${this.credentials.clientId}:${this.credentials.clientSecret}`).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: 'grant_type=client_credentials',
      }),
      'response',
    );
    this.token = {
      value: data.access_token,
      expiresAt: Date.now() + Math.max(0, data.expires_in - 30) * 1000,
    };
    return this.token.value;
  }

  async verifyCredentials(): Promise<void> {
    await this.accessToken();
  }

  private async orderRequest(path: string, requestId: string, body: unknown) {
    const accessToken = await this.accessToken();
    return validate(
      orderSchema,
      await this.request(path, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'PayPal-Request-Id': requestId,
          Prefer: 'return=representation',
        },
        body: JSON.stringify(body),
      }),
      'response',
    );
  }

  async createOrder(input: CreateOrderInput) {
    const data = validate(createSchema, input, 'request');
    const value = `${Math.floor(data.amountMinor / 100)}.${String(data.amountMinor % 100).padStart(2, '0')}`;
    const result = await this.orderRequest(
      '/v2/checkout/orders',
      data.requestId,
      {
        intent: 'CAPTURE',
        purchase_units: [
          {
            reference_id: data.reference,
            custom_id: data.reference,
            amount: { currency_code: 'USD', value },
          },
        ],
        payment_source: {
          paypal: {
            experience_context: {
              return_url: data.returnUrl,
              cancel_url: data.cancelUrl,
              user_action: 'PAY_NOW',
              shipping_preference: 'NO_SHIPPING',
            },
          },
        },
      },
    );
    const approvalUrl = result.links?.find((link) =>
      ['payer-action', 'approve'].includes(link.rel),
    )?.href;
    if (
      !approvalUrl ||
      new URL(approvalUrl).origin !== 'https://www.sandbox.paypal.com'
    )
      throw new Error('Invalid PayPal response');
    return { id: result.id, status: result.status, approvalUrl };
  }

  async captureOrder(id: string, requestId: string) {
    validate(orderSchema.shape.id, id, 'request');
    validate(z.uuid(), requestId, 'request');
    const result = await this.orderRequest(
      `/v2/checkout/orders/${id}/capture`,
      requestId,
      {},
    );
    if (result.id !== id) throw new Error('Invalid PayPal response');
    // Payment persistence must validate capture IDs, amounts, currency, and status.
    // An order-level status alone is not sufficient to mark a local order paid.
    return result;
  }
}

const captureDetailSchema = z.object({
  id: z.string().min(1).max(64),
  status: z.string().min(1).max(40),
  amount: z.object({
    currency_code: z.string(),
    value: z.string(),
  }),
  create_time: z.string().optional(),
  update_time: z.string().optional(),
});

export type ExtractedCapture = {
  paypalCaptureId: string;
  status: string;
  amountMinor: number;
  currency: 'USD';
  occurredAt: Date;
};

export function extractCaptureDetails(
  orderResponse: unknown,
): ExtractedCapture {
  if (typeof orderResponse !== 'object' || orderResponse === null) {
    throw new Error('Invalid PayPal capture response');
  }
  const obj = orderResponse as Record<string, unknown>;
  const units = Array.isArray(obj.purchase_units) ? obj.purchase_units : [];
  for (const unit of units) {
    if (typeof unit === 'object' && unit !== null) {
      const payments = (unit as Record<string, unknown>).payments;
      if (typeof payments === 'object' && payments !== null) {
        const captures = (payments as Record<string, unknown>).captures;
        if (Array.isArray(captures) && captures.length > 0) {
          const capResult = captureDetailSchema.safeParse(captures[0]);
          if (capResult.success) {
            const cap = capResult.data;
            if (!/^\d+\.\d{2}$/.test(cap.amount.value)) {
              throw new Error('Invalid capture amount');
            }
            const [dollars, cents] = cap.amount.value.split('.');
            const minor = Number(dollars) * 100 + Number(cents);
            if (!Number.isSafeInteger(minor)) {
              throw new Error('Invalid capture amount');
            }
            if (minor <= 0 || cap.amount.currency_code !== 'USD') {
              throw new Error(
                'Invalid capture currency or non-positive amount',
              );
            }
            const dateStr = cap.create_time || cap.update_time;
            const occurredAt = dateStr ? new Date(dateStr) : new Date();
            return {
              paypalCaptureId: cap.id,
              status: cap.status,
              amountMinor: minor,
              currency: 'USD',
              occurredAt: isNaN(occurredAt.getTime()) ? new Date() : occurredAt,
            };
          }
        }
      }
    }
  }
  throw new Error('No valid capture records found in PayPal response');
}

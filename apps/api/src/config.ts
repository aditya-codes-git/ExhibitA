import { z } from 'zod';

export type Config = {
  port: number;
  databaseUrl?: string;
  paypalClientId?: string;
  paypalClientSecret?: string;
};
const optional = (schema: z.ZodType) =>
  z.preprocess(
    (value) => (value === '' ? undefined : value),
    schema.optional(),
  );
const schema = z
  .object({
    PORT: z.coerce.number().int().min(1).max(65535).default(3001),
    DATABASE_URL: optional(
      z
        .string()
        .url()
        .refine((value) => {
          const url = URL.parse(value);
          return (
            url !== null && ['postgresql:', 'postgres:'].includes(url.protocol)
          );
        }),
    ),
    PAYPAL_CLIENT_ID: optional(z.string().trim().min(1)),
    PAYPAL_CLIENT_SECRET: optional(z.string().trim().min(1)),
  })
  .superRefine((value, ctx) => {
    if (
      Boolean(value.PAYPAL_CLIENT_ID) !== Boolean(value.PAYPAL_CLIENT_SECRET)
    ) {
      ctx.addIssue({
        code: 'custom',
        path: [
          value.PAYPAL_CLIENT_ID ? 'PAYPAL_CLIENT_SECRET' : 'PAYPAL_CLIENT_ID',
        ],
        message: 'Both PayPal credentials are required',
      });
    }
  });

export function parseConfig(env: Record<string, string | undefined>): Config {
  const result = schema.safeParse(env);
  if (!result.success) {
    throw new Error(
      `Invalid configuration: ${result.error.issues.map((issue) => issue.path.join('.')).join(', ')}`,
    );
  }
  return {
    port: result.data.PORT,
    ...(result.data.DATABASE_URL
      ? { databaseUrl: String(result.data.DATABASE_URL) }
      : {}),
    ...(result.data.PAYPAL_CLIENT_ID
      ? { paypalClientId: String(result.data.PAYPAL_CLIENT_ID) }
      : {}),
    ...(result.data.PAYPAL_CLIENT_SECRET
      ? { paypalClientSecret: String(result.data.PAYPAL_CLIENT_SECRET) }
      : {}),
  };
}

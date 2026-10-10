import { z } from 'zod';

export type Config = {
  port: number;
  databaseUrl?: string;
  paypalClientId?: string;
  paypalClientSecret?: string;
  groqApiKey?: string;
  groqModel?: string;
  supabaseUrl?: string;
  supabaseAnonKey?: string;
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
    GROQ_API_KEY: optional(z.string().trim().min(1)),
    GROQ_MODEL: optional(z.string().trim().min(1)),
    SUPABASE_URL: optional(z.string().url()),
    SUPABASE_ANON_KEY: optional(z.string().trim().min(1)),
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
    if (Boolean(value.SUPABASE_URL) !== Boolean(value.SUPABASE_ANON_KEY)) {
      ctx.addIssue({
        code: 'custom',
        path: [value.SUPABASE_URL ? 'SUPABASE_ANON_KEY' : 'SUPABASE_URL'],
        message: 'Both Supabase Auth settings are required',
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
    ...(result.data.GROQ_API_KEY
      ? { groqApiKey: String(result.data.GROQ_API_KEY) }
      : {}),
    ...(result.data.GROQ_MODEL
      ? { groqModel: String(result.data.GROQ_MODEL) }
      : {}),
    ...(result.data.SUPABASE_URL
      ? { supabaseUrl: String(result.data.SUPABASE_URL) }
      : {}),
    ...(result.data.SUPABASE_ANON_KEY
      ? { supabaseAnonKey: String(result.data.SUPABASE_ANON_KEY) }
      : {}),
  };
}

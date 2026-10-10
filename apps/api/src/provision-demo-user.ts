import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { config } from 'dotenv';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { PrismaClient } from './generated/prisma/client.js';
import { createDatabase } from './database.js';

type Admin = Pick<SupabaseClient['auth']['admin'], 'listUsers' | 'createUser'>;

export async function provisionDemoUser({
  database,
  admin,
  email,
  password,
}: {
  database: PrismaClient;
  admin: Admin;
  email: string;
  password: string;
}) {
  const merchants = await database.merchant.findMany({
    select: { id: true, authUserId: true },
    take: 2,
  });
  if (merchants.length !== 1)
    throw new Error(
      'Expected exactly one existing merchant; no account was changed.',
    );
  const merchant = merchants[0]!;

  let existing:
    | { id: string; email?: string; email_confirmed_at?: string | null }
    | undefined;
  for (let page = 1; ; page++) {
    const { data, error } = await admin.listUsers({ page, perPage: 1000 });
    if (error || !data)
      throw new Error('Could not inspect Supabase Auth users.');
    existing = data.users.find(
      (user) => user.email?.toLowerCase() === email.toLowerCase(),
    );
    if (existing || data.users.length < 1000) break;
  }
  if (existing && !existing.email_confirmed_at)
    throw new Error('Existing demo Auth user is not email-confirmed.');
  if (merchant.authUserId && merchant.authUserId !== existing?.id) {
    throw new Error(
      'Existing merchant is already linked to another Auth user.',
    );
  }

  let userId = existing?.id;
  if (!userId) {
    const { data, error } = await admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (error || !data.user)
      throw new Error('Could not create demo Auth user.');
    userId = data.user.id;
  }
  if (merchant.authUserId === userId) return userId;
  const linked = await database.merchant.updateMany({
    where: { id: merchant.id, authUserId: null },
    data: { authUserId: userId },
  });
  if (linked.count !== 1)
    throw new Error('Merchant ownership changed; no link was made.');
  return userId;
}

async function main() {
  config({
    path: fileURLToPath(new URL('../../../.env', import.meta.url)),
    quiet: true,
  });
  const {
    DATABASE_URL,
    SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY,
    DEMO_USER_EMAIL,
    DEMO_USER_PASSWORD,
  } = process.env;
  if (
    !DATABASE_URL ||
    !SUPABASE_URL ||
    !SUPABASE_SERVICE_ROLE_KEY ||
    !DEMO_USER_EMAIL ||
    !DEMO_USER_PASSWORD
  ) {
    throw new Error(
      'Set DATABASE_URL, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, DEMO_USER_EMAIL and DEMO_USER_PASSWORD in root .env.',
    );
  }
  if (DEMO_USER_PASSWORD.length < 8)
    throw new Error('DEMO_USER_PASSWORD must have at least 8 characters.');
  const database = createDatabase(DATABASE_URL);
  try {
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    }).auth.admin;
    await provisionDemoUser({
      database,
      admin,
      email: DEMO_USER_EMAIL,
      password: DEMO_USER_PASSWORD,
    });
    console.log('Demo account is linked to the existing merchant.');
  } finally {
    await database.$disconnect();
  }
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  void main().catch((error) => {
    console.error(
      error instanceof Error ? error.message : 'Demo account setup failed.',
    );
    process.exitCode = 1;
  });
}

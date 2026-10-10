import type { Config } from './config.js';

export async function verifyAccessToken(
  token: string,
  config: Config,
): Promise<{ id: string } | null> {
  if (!config.supabaseUrl || !config.supabaseAnonKey)
    throw new Error('Supabase Auth is not configured');
  const response = await fetch(
    `${config.supabaseUrl.replace(/\/$/, '')}/auth/v1/user`,
    {
      headers: {
        apikey: config.supabaseAnonKey,
        Authorization: `Bearer ${token}`,
      },
      signal: AbortSignal.timeout(10000),
    },
  );
  if (!response.ok) {
    if (
      response.status >= 400 &&
      response.status < 500 &&
      response.status !== 429
    )
      return null;
    throw new Error('Supabase Auth is unavailable');
  }
  const user: unknown = await response.json();
  return user &&
    typeof user === 'object' &&
    'id' in user &&
    typeof user.id === 'string' &&
    user.id
    ? { id: user.id }
    : null;
}

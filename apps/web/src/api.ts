import { supabase } from './supabase';

export async function apiFetch(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const {
    data: { session },
  } = (await supabase?.auth.getSession()) ?? { data: { session: null } };
  if (!session) throw new Error('Sign in to continue.');
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${session.access_token}`);
  return fetch(path, { ...init, headers });
}

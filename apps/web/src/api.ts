import { supabase } from './supabase';

export function apiUrl(path: string): string {
  const base = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');
  return `${base}${path}`;
}

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
  return fetch(apiUrl(path), { ...init, headers });
}

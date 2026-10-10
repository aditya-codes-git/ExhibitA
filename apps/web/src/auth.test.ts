import { describe, expect, it, vi } from 'vitest';
import { safeNextPath, signInWithPassword, startGoogleSignIn } from './auth';
import { apiFetch } from './api';
import { supabase } from './supabase';

vi.mock('./supabase', () => ({ supabase: { auth: { getSession: vi.fn() } } }));

describe('browser authentication', () => {
  it('keeps a local payment return URL and rejects external redirects', () => {
    expect(safeNextPath('/return?orderId=order-1')).toBe(
      '/return?orderId=order-1',
    );
    expect(safeNextPath('https://attacker.example')).toBe('/');
    expect(safeNextPath('//attacker.example')).toBe('/');
    expect(safeNextPath('/\\attacker.example')).toBe('/');
  });

  it('passes email credentials only to Supabase Auth', async () => {
    const signIn = vi.fn().mockResolvedValue({ error: null });
    await signInWithPassword(
      { auth: { signInWithPassword: signIn } },
      'demo@exhibita.test',
      'test-password',
    );
    expect(signIn).toHaveBeenCalledWith({
      email: 'demo@exhibita.test',
      password: 'test-password',
    });
  });

  it('starts Google OAuth with the fixed same-origin callback', async () => {
    const signIn = vi.fn().mockResolvedValue({ error: null });
    await startGoogleSignIn(
      { auth: { signInWithOAuth: signIn } },
      'http://127.0.0.1:5173',
    );
    expect(signIn).toHaveBeenCalledWith({
      provider: 'google',
      options: { redirectTo: 'http://127.0.0.1:5173/auth/callback' },
    });
  });
});

describe('authenticated API calls', () => {
  it('adds the current access token without losing caller headers', async () => {
    vi.mocked(supabase!.auth.getSession).mockResolvedValue({
      data: { session: { access_token: 'access-token' } },
    } as never);
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}'));
    vi.stubGlobal('fetch', fetchMock);
    const controller = new AbortController();
    await apiFetch('/api/orders', {
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
    });
    const headers = new Headers(fetchMock.mock.calls[0]![1].headers);
    expect(headers.get('Authorization')).toBe('Bearer access-token');
    expect(headers.get('Content-Type')).toBe('application/json');
    expect(fetchMock.mock.calls[0]![1].signal).toBe(controller.signal);
    vi.unstubAllGlobals();
  });

  it('does not send a protected request without a session', async () => {
    vi.mocked(supabase!.auth.getSession).mockResolvedValue({
      data: { session: null },
    } as never);
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    await expect(apiFetch('/api/orders')).rejects.toThrow(
      'Sign in to continue',
    );
    expect(fetchMock).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});

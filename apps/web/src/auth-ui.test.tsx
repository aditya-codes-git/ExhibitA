// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider, RequireAuth, SignOutButton, useAuth } from './auth';
import { AuthCallback } from './Login';

const mocks = vi.hoisted(() => ({
  onAuthStateChange: vi.fn(),
  getSession: vi.fn(),
  signOut: vi.fn(),
  exchangeCodeForSession: vi.fn(),
}));
vi.mock('./supabase', () => ({ supabase: { auth: mocks } }));

let authChange: (
  event: string,
  session: { user: { id: string; email: string } } | null,
) => void;

function SessionProbe() {
  const { user, loading } = useAuth();
  return <div>{loading ? 'loading' : (user?.email ?? 'signed out')}</div>;
}

function LocationProbe() {
  const location = useLocation();
  return <div>{location.search}</div>;
}

beforeEach(() => {
  mocks.onAuthStateChange.mockReset().mockImplementation((callback) => {
    authChange = callback;
    return { data: { subscription: { unsubscribe: vi.fn() } } };
  });
  mocks.getSession.mockReset().mockResolvedValue({ data: { session: null } });
  mocks.signOut.mockReset().mockResolvedValue({ error: null });
  mocks.exchangeCodeForSession.mockReset().mockResolvedValue({ error: null });
  sessionStorage.clear();
  window.history.replaceState({}, '', '/');
});
afterEach(cleanup);

describe('auth routes', () => {
  it('restores a session from the initial Supabase event', async () => {
    render(
      <AuthProvider>
        <SessionProbe />
      </AuthProvider>,
    );
    await act(async () =>
      authChange('INITIAL_SESSION', {
        user: { id: 'user', email: 'merchant@test.local' },
      }),
    );
    expect(screen.getByText('merchant@test.local')).toBeTruthy();
  });

  it('keeps the requested PayPal return URL when redirecting to login', async () => {
    render(
      <MemoryRouter initialEntries={['/return?orderId=order-1&token=pay-pal']}>
        <AuthProvider>
          <Routes>
            <Route
              path="/return"
              element={
                <RequireAuth>
                  <div>Private</div>
                </RequireAuth>
              }
            />
            <Route path="/login" element={<LocationProbe />} />
          </Routes>
        </AuthProvider>
      </MemoryRouter>,
    );
    await act(async () => authChange('INITIAL_SESSION', null));
    expect(
      screen.getByText('?next=%2Freturn%3ForderId%3Dorder-1%26token%3Dpay-pal'),
    ).toBeTruthy();
  });

  it('shows a logout error rather than silently ignoring it', async () => {
    mocks.signOut.mockResolvedValue({ error: { message: 'Auth unavailable' } });
    render(
      <AuthProvider>
        <SignOutButton />
      </AuthProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: /sign out/i }));
    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toContain(
        'Auth unavailable',
      ),
    );
  });

  it('exchanges a Google code and returns to the saved path', async () => {
    window.history.replaceState({}, '', '/auth/callback?code=provider-code');
    sessionStorage.setItem('exhibita-auth-next', '/return?orderId=order-1');
    render(
      <MemoryRouter initialEntries={['/auth/callback']}>
        <AuthProvider>
          <Routes>
            <Route path="/auth/callback" element={<AuthCallback />} />
            <Route path="/return" element={<LocationProbe />} />
          </Routes>
        </AuthProvider>
      </MemoryRouter>,
    );
    await waitFor(() =>
      expect(screen.getByText('?orderId=order-1')).toBeTruthy(),
    );
    expect(mocks.exchangeCodeForSession).toHaveBeenCalledWith('provider-code');
  });

  it('shows a Google provider error without claiming sign-in', async () => {
    window.history.replaceState({}, '', '/auth/callback?error=access_denied');
    render(
      <MemoryRouter>
        <AuthProvider>
          <AuthCallback />
        </AuthProvider>
      </MemoryRouter>,
    );
    expect(screen.getByRole('alert').textContent).toContain('access_denied');
    expect(mocks.exchangeCodeForSession).not.toHaveBeenCalled();
  });
});

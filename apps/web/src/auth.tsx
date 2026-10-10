import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { Navigate, useLocation } from 'react-router';
import type { User } from '@supabase/supabase-js';
import { supabase } from './supabase';

export function safeNextPath(value: string | null): string {
  return value?.startsWith('/') &&
    !value.startsWith('//') &&
    !value.includes('\\')
    ? value
    : '/';
}

type PasswordClient = {
  auth: {
    signInWithPassword: (credentials: {
      email: string;
      password: string;
    }) => Promise<{ error: { message: string } | null }>;
  };
};
type GoogleClient = {
  auth: {
    signInWithOAuth: (options: {
      provider: 'google';
      options: { redirectTo: string };
    }) => Promise<{ error: { message: string } | null }>;
  };
};

export async function signInWithPassword(
  client: PasswordClient,
  email: string,
  password: string,
) {
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw new Error(error.message);
}

export async function startGoogleSignIn(client: GoogleClient, origin: string) {
  const { error } = await client.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: `${origin}/auth/callback` },
  });
  if (error) throw new Error(error.message);
}

type AuthState = {
  user: User | null;
  loading: boolean;
  signInWithPassword(email: string, password: string): Promise<void>;
  signInWithGoogle(next: string): Promise<void>;
  signOut(): Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(Boolean(supabase));

  useEffect(() => {
    if (!supabase) return;
    let active = true;
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active) {
        setUser(session?.user ?? null);
        setLoading(false);
      }
    });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        signInWithPassword: async (email, password) => {
          if (!supabase) throw new Error('Supabase Auth is not configured.');
          await signInWithPassword(supabase, email, password);
        },
        signInWithGoogle: async (next) => {
          if (!supabase) throw new Error('Supabase Auth is not configured.');
          sessionStorage.setItem('exhibita-auth-next', safeNextPath(next));
          await startGoogleSignIn(supabase, window.location.origin);
        },
        signOut: async () => {
          if (!supabase) return;
          const { error } = await supabase.auth.signOut();
          if (error) throw new Error(error.message);
        },
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const state = useContext(AuthContext);
  if (!state) throw new Error('AuthProvider is missing');
  return state;
}

export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading)
    return (
      <main className="p-10" role="status">
        Restoring session…
      </main>
    );
  if (!user) {
    const next = safeNextPath(
      location.pathname + location.search + location.hash,
    );
    return <Navigate to={`/login?next=${encodeURIComponent(next)}`} replace />;
  }
  return children;
}

export function SignOutButton() {
  const { user, signOut } = useAuth();
  const [error, setError] = useState('');
  return (
    <span className="ml-4 text-right">
      <button
        type="button"
        onClick={() => {
          setError('');
          void signOut().catch((cause) =>
            setError(
              cause instanceof Error ? cause.message : 'Sign-out failed.',
            ),
          );
        }}
        className="text-xs font-semibold text-teal-800 hover:underline"
        aria-label={`Sign out ${user?.email ?? ''}`}
      >
        Sign out
      </button>
      {error && (
        <span role="alert" className="block text-xs text-rose-700">
          {error}
        </span>
      )}
    </span>
  );
}

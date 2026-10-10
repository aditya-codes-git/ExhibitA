import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router';
import { FileSearch } from 'lucide-react';
import { useAuth, safeNextPath } from './auth';
import { supabase } from './supabase';

export function Login() {
  const { user, loading, signInWithPassword, signInWithGoogle } = useAuth();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const next = safeNextPath(params.get('next'));

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await signInWithPassword(email.trim(), password);
      navigate(next, { replace: true });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Sign-in failed.');
    } finally {
      setBusy(false);
    }
  }

  if (loading)
    return (
      <main className="p-10" role="status">
        Restoring session…
      </main>
    );
  if (user) return <Navigate to={next} replace />;

  return (
    <main className="min-h-screen bg-slate-50 flex items-center justify-center p-5">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <Link
          to="/demo-store"
          className="inline-flex items-center gap-2 font-bold text-2xl text-slate-950"
        >
          <FileSearch className="text-teal-800" />
          ExhibitA
        </Link>
        <p className="mt-3 text-sm text-slate-600">
          Merchant evidence workspace · PayPal Sandbox
        </p>
        <h1 className="mt-8 text-2xl font-bold text-slate-950">Sign in</h1>
        <form onSubmit={submit} className="mt-5 space-y-4">
          <label className="block text-sm font-semibold text-slate-800">
            Email
            <input
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal"
            />
          </label>
          <label className="block text-sm font-semibold text-slate-800">
            Password
            <input
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal"
            />
          </label>
          {error && (
            <p role="alert" className="text-sm text-rose-700">
              {error}
            </p>
          )}
          {!supabase && (
            <p role="alert" className="text-sm text-amber-800">
              Supabase Auth is not configured for this site.
            </p>
          )}
          <button
            disabled={busy || !supabase}
            className="w-full rounded-lg bg-teal-800 px-4 py-3 font-semibold text-white hover:bg-teal-900 disabled:opacity-50"
          >
            {busy ? 'Signing in…' : 'Sign in with email'}
          </button>
        </form>
        <div className="my-5 text-center text-xs uppercase tracking-wider text-slate-500">
          or
        </div>
        <button
          type="button"
          disabled={busy || !supabase}
          onClick={() => {
            setBusy(true);
            setError('');
            void signInWithGoogle(next).catch((cause) => {
              setError(
                cause instanceof Error
                  ? cause.message
                  : 'Google sign-in failed.',
              );
              setBusy(false);
            });
          }}
          className="w-full rounded-lg border border-slate-300 px-4 py-3 font-semibold text-slate-900 hover:bg-slate-50 disabled:opacity-50"
        >
          Continue with Google
        </button>
        <p className="mt-6 text-xs text-slate-500">
          This workspace contains demonstration transactions only.
        </p>
      </div>
    </main>
  );
}

export function AuthCallback() {
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const params = new URLSearchParams(window.location.search);
    const providerError =
      params.get('error_description') || params.get('error');
    const code = params.get('code');
    if (providerError || !code || !supabase) {
      setError(providerError || 'Google sign-in did not return a code.');
      return;
    }
    void supabase.auth
      .exchangeCodeForSession(code)
      .then(({ error }) => {
        if (error) throw error;
        const next = safeNextPath(sessionStorage.getItem('exhibita-auth-next'));
        sessionStorage.removeItem('exhibita-auth-next');
        navigate(next, { replace: true });
      })
      .catch((cause) =>
        setError(
          cause instanceof Error ? cause.message : 'Google sign-in failed.',
        ),
      );
  }, [navigate]);
  return (
    <main className="min-h-screen bg-slate-50 flex items-center justify-center p-5">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-sm">
        <h1 className="text-xl font-bold">Completing sign-in</h1>
        {error ? (
          <>
            <p role="alert" className="mt-4 text-rose-700">
              {error}
            </p>
            <Link
              to="/login"
              className="mt-4 inline-block text-teal-800 underline"
            >
              Return to sign-in
            </Link>
          </>
        ) : (
          <p role="status" className="mt-4 text-slate-600">
            Checking your Google session…
          </p>
        )}
      </div>
    </main>
  );
}

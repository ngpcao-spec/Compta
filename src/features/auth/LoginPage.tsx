import { useState } from 'react';
import { Navigate } from 'react-router';
import { vi } from '@/i18n/vi';
import { supabaseConfigured } from '@/lib/supabase';
import { useAuth } from './AuthProvider';

function isIosStandalone(): boolean {
  const nav = navigator as Navigator & { standalone?: boolean };
  return /iphone|ipad|ipod/i.test(navigator.userAgent) && nav.standalone === true;
}

export function LoginPage() {
  const { state, signInWithGoogle, signInE2E } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (state.status === 'signedIn') return <Navigate to="/" replace />;

  const onGoogle = async () => {
    setBusy(true);
    setError(null);
    try {
      await signInWithGoogle();
    } catch {
      setError(vi.login.error);
      setBusy(false);
    }
  };

  return (
    <main className="flex h-full flex-col items-center justify-center gap-6 bg-gradient-to-b from-primary to-primary-dark px-8 text-center text-white">
      <img src="/logo.svg" alt="" width={96} height={96} className="rounded-3xl shadow-lg" />
      <div>
        <h1 className="text-3xl font-bold">{vi.login.title}</h1>
        <p className="mt-2 text-sm opacity-90">{vi.login.tagline}</p>
      </div>
      <button
        onClick={onGoogle}
        disabled={busy || !supabaseConfigured}
        className="tap flex w-full max-w-xs items-center justify-center gap-3 rounded-full bg-white px-6 font-semibold text-ink shadow disabled:opacity-60"
      >
        <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
          <path
            fill="#EA4335"
            d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z"
          />
          <path
            fill="#4285F4"
            d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.6 5.9c4.4-4.1 7-10.1 7-17.6z"
          />
          <path
            fill="#FBBC05"
            d="M10.5 28.7a14.5 14.5 0 010-9.4l-7.9-6.1a24 24 0 000 21.6l7.9-6.1z"
          />
          <path
            fill="#34A853"
            d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.6-5.9c-2.1 1.4-4.9 2.3-8.3 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z"
          />
        </svg>
        {busy ? vi.login.signingIn : vi.login.google}
      </button>
      {import.meta.env.VITE_E2E === '1' && (
        <button
          onClick={signInE2E}
          data-testid="e2e-login"
          className="tap rounded-full bg-white/20 px-4 text-sm"
        >
          {vi.login.e2e}
        </button>
      )}
      {error && (
        <p role="alert" className="text-sm">
          {error}
        </p>
      )}
      {isIosStandalone() && <p className="max-w-xs text-xs opacity-90">{vi.login.iosStandalone}</p>}
    </main>
  );
}

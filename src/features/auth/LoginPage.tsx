import { useState } from 'react';
import { Navigate } from 'react-router';
import { BookText } from 'lucide-react';
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
    <main className="flex h-full flex-col bg-primary px-6 pb-12 text-white">
      <div className="flex flex-1 flex-col items-center justify-center gap-5 text-center">
        <div className="flex h-24 w-24 items-center justify-center rounded-[28px] bg-white text-primary shadow-[0_12px_30px_rgb(0_0_0/0.18)]">
          <BookText size={52} strokeWidth={1.8} />
        </div>
        <h1 className="text-[34px] font-bold tracking-[-0.5px]">{vi.login.title}</h1>
        <p className="max-w-[280px] text-base leading-normal">{vi.login.tagline}</p>
      </div>
      <div className="flex flex-col gap-4">
        <button
          onClick={onGoogle}
          disabled={busy || !supabaseConfigured}
          className="flex h-14 items-center justify-center gap-3 rounded-full bg-white text-base font-semibold text-ink shadow-[0_6px_18px_rgb(0_0_0/0.15)] disabled:opacity-60"
        >
          <svg width="22" height="22" viewBox="0 0 48 48" aria-hidden="true">
            <path
              fill="#FFC107"
              d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"
            />
            <path
              fill="#FF3D00"
              d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"
            />
            <path
              fill="#4CAF50"
              d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"
            />
            <path
              fill="#1976D2"
              d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"
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
          <p role="alert" className="text-center text-sm">
            {error}
          </p>
        )}
        {isIosStandalone() && <p className="text-center text-xs">{vi.login.iosStandalone}</p>}
        <p className="text-center text-[13px] leading-normal">{vi.login.footnote}</p>
      </div>
    </main>
  );
}

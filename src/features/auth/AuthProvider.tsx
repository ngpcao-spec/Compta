import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { db } from '@/db/local';
import { supabase } from '@/lib/supabase';
import { currentEngine, resetEngine } from '@/sync/runtime';

export interface AuthUser {
  id: string;
  email: string | null;
  name: string | null;
  avatar: string | null;
}

export type AuthState =
  { status: 'loading' } | { status: 'signedOut' } | { status: 'signedIn'; user: AuthUser };

interface AuthApi {
  state: AuthState;
  signInWithGoogle(): Promise<void>;
  /** Connexion de test, uniquement si VITE_E2E=1. */
  signInE2E(): void;
  signOut(): Promise<void>;
  deleteAccount(): Promise<void>;
}

// Constante locale : le build de production la remplace par `false` et élimine tout le code e2e.
const isE2E = import.meta.env.VITE_E2E === '1';
const USER_KEY = 'stc.user';
const E2E_KEY = 'stc.e2e.user';

const AuthContext = createContext<AuthApi | null>(null);

function fromSupabase(u: User): AuthUser {
  const m = u.user_metadata as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === 'string' ? v : null);
  return {
    id: u.id,
    email: u.email ?? null,
    name: str(m.full_name) ?? str(m.name),
    avatar: str(m.avatar_url) ?? str(m.picture),
  };
}

function readCache(key: string): AuthUser | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  } catch {
    return null;
  }
}
function writeCache(key: string, u: AuthUser | null): void {
  try {
    if (u) localStorage.setItem(key, JSON.stringify(u));
    else localStorage.removeItem(key);
  } catch {
    /* stockage indisponible */
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(() => {
    if (!isE2E) return { status: 'loading' };
    const u = readCache(E2E_KEY);
    return u ? { status: 'signedIn', user: u } : { status: 'signedOut' };
  });

  useEffect(() => {
    if (isE2E) return;
    const signedIn = (s: Session) => {
      const user = fromSupabase(s.user);
      writeCache(USER_KEY, user);
      setState({ status: 'signedIn', user });
    };
    const fallback = () => {
      // Hors ligne avec une session mise en cache : l'app s'ouvre normalement.
      const cached = readCache(USER_KEY);
      setState(
        cached && !navigator.onLine
          ? { status: 'signedIn', user: cached }
          : { status: 'signedOut' },
      );
    };
    supabase.auth
      .getSession()
      .then(({ data }) => (data.session ? signedIn(data.session) : fallback()))
      .catch(fallback);
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) signedIn(session);
      else if (event === 'SIGNED_OUT') setState({ status: 'signedOut' });
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const signInWithGoogle = useCallback(async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    });
    if (error) throw error;
  }, []);

  const signInE2E = useCallback(() => {
    if (!isE2E) return;
    const user: AuthUser = {
      id: '11111111-1111-4111-8111-111111111111',
      email: 'test@sothuchi.local',
      name: 'Người Dùng Thử',
      avatar: null,
    };
    writeCache(E2E_KEY, user);
    setState({ status: 'signedIn', user });
  }, []);

  const clearLocal = useCallback(async () => {
    resetEngine();
    writeCache(USER_KEY, null);
    if (isE2E) writeCache(E2E_KEY, null);
    await db.wipe();
    setState({ status: 'signedOut' });
  }, []);

  const signOut = useCallback(async () => {
    const engine = currentEngine();
    if (engine && navigator.onLine) {
      // Dernière synchro pour ne pas perdre de modifications, sans bloquer plus de 5 s.
      await Promise.race([engine.syncNow(), new Promise((r) => setTimeout(r, 5000))]);
    }
    if (!isE2E) await supabase.auth.signOut().catch(() => undefined);
    await clearLocal();
  }, [clearLocal]);

  const deleteAccount = useCallback(async () => {
    if (!isE2E) {
      const { error } = await supabase.functions.invoke('delete-account', { method: 'POST' });
      if (error) throw error;
      await supabase.auth.signOut().catch(() => undefined);
    } else {
      localStorage.removeItem('stc.e2e.server');
    }
    await clearLocal();
  }, [clearLocal]);

  const api = useMemo<AuthApi>(
    () => ({ state, signInWithGoogle, signInE2E, signOut, deleteAccount }),
    [state, signInWithGoogle, signInE2E, signOut, deleteAccount],
  );
  return <AuthContext.Provider value={api}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthApi {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth hors AuthProvider');
  return ctx;
}

export function useUser(): AuthUser {
  const { state } = useAuth();
  if (state.status !== 'signedIn') throw new Error('Utilisateur non connecté');
  return state.user;
}

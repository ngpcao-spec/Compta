import { db } from '@/db/local';
import { supabase } from '@/lib/supabase';
import { createSyncEngine, type SyncEngine } from './engine';
import { syncStatus } from './status';
import { supabaseTransport } from './supabaseTransport';
import type { SyncTransport } from './transport';

export interface RuntimeUser {
  id: string;
  name: string | null;
}

let engine: SyncEngine | null = null;

async function makeTransport(user: RuntimeUser): Promise<SyncTransport> {
  // Test uniquement : `VITE_E2E` est absent des builds de production, la branche est éliminée.
  if (import.meta.env.VITE_E2E === '1') {
    const { createFakeServer } = await import('./fakeTransport');
    const fake = createFakeServer({ persistKey: 'stc.e2e.server' });
    fake.signUp(user.id, user.name ?? undefined);
    return fake;
  }
  return supabaseTransport;
}

async function refreshAuth(): Promise<boolean> {
  if (import.meta.env.VITE_E2E === '1') return false;
  const { data, error } = await supabase.auth.refreshSession();
  return !error && Boolean(data.session);
}

export async function getEngine(user: RuntimeUser): Promise<SyncEngine> {
  if (engine) return engine;
  engine = createSyncEngine({
    db,
    transport: await makeTransport(user),
    refreshAuth,
    status: syncStatus,
  });
  return engine;
}

export function currentEngine(): SyncEngine | null {
  return engine;
}

export function resetEngine(): void {
  engine?.stop();
  engine = null;
  syncStatus.set({ state: 'idle', pending: 0, lastSyncAt: null, authExpired: false });
}

import type { Table } from 'dexie';
import type { LocalDb } from '@/db/local';
import { onLocalWrite } from '@/db/events';
import type { SyncedTable } from '@/db/types';
import { createStatusStore, type StatusStore } from './status';
import { SyncError, type SyncRow, type SyncTransport } from './transport';

/** Ordre imposé par les clés étrangères (transactions → categories). */
export const PUSH_ORDER: readonly SyncedTable[] = [
  'profiles',
  'categories',
  'budgets',
  'transactions',
];
const BATCH = 200;
const PULL_PAGE = 1000;

export interface EngineDeps {
  db: LocalDb;
  transport: SyncTransport;
  /** Tente de rafraîchir la session ; true si une nouvelle session valide existe. */
  refreshAuth: () => Promise<boolean>;
  status?: StatusStore;
  isOnline?: () => boolean;
  now?: () => Date;
}

export type SyncOutcome = 'ok' | 'offline' | 'auth' | 'error';

export interface SyncEngine {
  syncNow(): Promise<SyncOutcome>;
  /** Pull complet sans push : premier lancement après connexion. */
  initialPull(): Promise<SyncOutcome>;
  start(): void;
  stop(): void;
  refreshPending(): Promise<void>;
}

function stripLocal(row: Record<string, unknown>): SyncRow {
  const { _dirty: _d, server_updated_at: _s, ...rest } = row;
  return rest as SyncRow;
}

export function createSyncEngine(deps: EngineDeps): SyncEngine {
  const { db, transport, refreshAuth } = deps;
  const status = deps.status ?? createStatusStore();
  const isOnline =
    deps.isOnline ?? (() => (typeof navigator === 'undefined' ? true : navigator.onLine));
  const now = deps.now ?? (() => new Date());
  let inflight: Promise<SyncOutcome> | null = null;

  const tbl = (name: SyncedTable) =>
    db[name] as unknown as Table<Record<string, unknown> & SyncRow, string>;

  async function refreshPending(): Promise<void> {
    status.set({ pending: await db.countPending() });
  }

  async function push(): Promise<void> {
    for (const name of PUSH_ORDER) {
      const t = tbl(name);
      const dirty = await t.where('_dirty').equals(1).toArray();
      for (let i = 0; i < dirty.length; i += BATCH) {
        const chunk = dirty.slice(i, i + BATCH);
        await transport.upsert(name, chunk.map(stripLocal));
        // N'effacer le drapeau que si la ligne n'a pas été modifiée pendant l'envoi.
        await db.transaction('rw', t, async () => {
          for (const sent of chunk) {
            const cur = await t.get(sent.id);
            if (cur && cur.updated_at === sent.updated_at) await t.update(sent.id, { _dirty: 0 });
          }
        });
      }
    }
  }

  async function pull(): Promise<void> {
    for (const name of PUSH_ORDER) {
      const t = tbl(name);
      const key = `cursor:${name}`;
      let cursor = (await db.getMeta(key)) ?? null;
      for (;;) {
        const rows = await transport.pull(name, cursor, PULL_PAGE);
        if (rows.length === 0) break;
        await db.transaction('rw', t, async () => {
          for (const row of rows) {
            const local = await t.get(row.id);
            const keepLocal =
              local && local._dirty === 1 && String(local.updated_at) > row.updated_at;
            if (!keepLocal) await t.put({ ...row, _dirty: 0 });
          }
        });
        const last = rows[rows.length - 1]?.server_updated_at;
        if (typeof last === 'string') {
          cursor = last;
          await db.setMeta(key, last);
        }
        if (rows.length < PULL_PAGE) break;
      }
    }
  }

  async function attempt(withPush: boolean, retried: boolean): Promise<SyncOutcome> {
    try {
      if (withPush) await push();
      await pull();
      status.set({ state: 'idle', lastSyncAt: now().toISOString(), authExpired: false });
      return 'ok';
    } catch (e) {
      const kind = e instanceof SyncError ? e.kind : 'server';
      if (kind === 'auth') {
        if (!retried && (await refreshAuth())) return attempt(withPush, true);
        status.set({ state: 'error', authExpired: true });
        return 'auth';
      }
      if (kind === 'network' || !isOnline()) {
        status.set({ state: 'offline' });
        return 'offline';
      }
      status.set({ state: 'error' });
      return 'error';
    }
  }

  function run(withPush: boolean): Promise<SyncOutcome> {
    if (inflight) return inflight;
    if (!isOnline()) {
      status.set({ state: 'offline' });
      return refreshPending().then((): SyncOutcome => 'offline');
    }
    status.set({ state: 'syncing' });
    inflight = attempt(withPush, false).finally(async () => {
      inflight = null;
      await refreshPending();
    });
    return inflight;
  }

  // Déclencheurs ------------------------------------------------------------
  let debounce: ReturnType<typeof setTimeout> | undefined;
  let interval: ReturnType<typeof setInterval> | undefined;
  let unsubscribeWrites: (() => void) | undefined;
  let detach: (() => void) | undefined;

  const visible = () => typeof document === 'undefined' || document.visibilityState === 'visible';

  function start() {
    stop();
    void run(true);
    unsubscribeWrites = onLocalWrite(() => {
      void refreshPending();
      clearTimeout(debounce);
      debounce = setTimeout(() => void run(true), 2000);
    });
    if (typeof window !== 'undefined') {
      const onOnline = () => void run(true);
      const onVisible = () => {
        if (visible()) void run(true);
      };
      const onOffline = () => status.set({ state: 'offline' });
      window.addEventListener('online', onOnline);
      window.addEventListener('offline', onOffline);
      document.addEventListener('visibilitychange', onVisible);
      detach = () => {
        window.removeEventListener('online', onOnline);
        window.removeEventListener('offline', onOffline);
        document.removeEventListener('visibilitychange', onVisible);
      };
      interval = setInterval(() => {
        if (visible()) void run(true);
      }, 60_000);
    }
    void refreshPending();
  }

  function stop() {
    clearTimeout(debounce);
    clearInterval(interval);
    unsubscribeWrites?.();
    detach?.();
    unsubscribeWrites = detach = undefined;
  }

  return {
    syncNow: () => run(true),
    initialPull: () => run(false),
    start,
    stop,
    refreshPending,
  };
}

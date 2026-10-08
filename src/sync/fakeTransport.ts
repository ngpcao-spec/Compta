import type { SyncedTable } from '@/db/types';
import { DEFAULT_CATEGORIES } from './defaultCategories';
import { SyncError, type SyncRow, type SyncTransport } from './transport';

type Store = Record<SyncedTable, Map<string, SyncRow>>;

export interface FakeServer extends SyncTransport {
  rows(table: SyncedTable): SyncRow[];
  /** Simule un utilisateur existant côté serveur : profil + 40 catégories (trigger d'inscription). */
  signUp(userId: string, displayName?: string): void;
  failNext(kind: 'network' | 'auth' | 'server', times?: number): void;
  calls: { upsert: number; pull: number };
}

/**
 * Serveur en mémoire : mêmes règles que la migration (server_updated_at monotone,
 * dernier écrit gagne, aucune suppression). Sert aux tests et au mode e2e (VITE_E2E=1).
 */
export function createFakeServer(
  opts: { persistKey?: string; isOnline?: () => boolean } = {},
): FakeServer {
  const store: Store = {
    profiles: new Map(),
    categories: new Map(),
    budgets: new Map(),
    transactions: new Map(),
  };
  let tick = 0;
  let failures: { kind: 'network' | 'auth' | 'server'; times: number } | null = null;
  const calls = { upsert: 0, pull: 0 };
  const online =
    opts.isOnline ?? (() => (typeof navigator === 'undefined' ? true : navigator.onLine));

  if (opts.persistKey && typeof localStorage !== 'undefined') {
    try {
      const raw = localStorage.getItem(opts.persistKey);
      if (raw) {
        const parsed = JSON.parse(raw) as { tick: number; rows: Record<SyncedTable, SyncRow[]> };
        tick = parsed.tick;
        for (const t of Object.keys(store) as SyncedTable[])
          for (const r of parsed.rows[t] ?? []) store[t].set(r.id, r);
      }
    } catch {
      /* état corrompu : repartir à vide */
    }
  }
  const persist = () => {
    if (!opts.persistKey || typeof localStorage === 'undefined') return;
    const rows = {} as Record<SyncedTable, SyncRow[]>;
    for (const t of Object.keys(store) as SyncedTable[]) rows[t] = [...store[t].values()];
    localStorage.setItem(opts.persistKey, JSON.stringify({ tick, rows }));
  };

  const stamp = () => new Date(Date.UTC(2026, 0, 1) + ++tick).toISOString();

  function maybeFail() {
    if (!online()) throw new SyncError('network', 'offline');
    if (failures && failures.times > 0) {
      failures.times--;
      throw new SyncError(failures.kind, `fake ${failures.kind} error`);
    }
  }

  return {
    calls,
    rows: (t) => [...store[t].values()],
    signUp(userId, displayName) {
      if (store.profiles.has(userId)) return;
      const ts = stamp();
      store.profiles.set(userId, {
        id: userId,
        display_name: displayName ?? null,
        avatar_url: null,
        hide_amounts: false,
        default_budget: null,
        updated_at: ts,
        server_updated_at: ts,
      });
      const counters = { expense: 0, income: 0 };
      for (const c of DEFAULT_CATEGORIES) {
        const id = crypto.randomUUID();
        const t2 = stamp();
        store.categories.set(id, {
          id,
          user_id: userId,
          ...c,
          sort_order: counters[c.type]++,
          archived: false,
          created_at: t2,
          updated_at: t2,
          deleted_at: null,
          server_updated_at: t2,
        });
      }
      persist();
    },
    failNext(kind, times = 1) {
      failures = { kind, times };
    },
    async upsert(table, rows) {
      calls.upsert++;
      maybeFail();
      for (const row of rows) {
        const old = store[table].get(row.id);
        if (old && row.updated_at < old.updated_at) {
          store[table].set(row.id, { ...old, server_updated_at: stamp() }); // LWW : l'ancienne gagne
        } else {
          store[table].set(row.id, { ...old, ...row, server_updated_at: stamp() });
        }
      }
      persist();
    },
    async pull(table, since, limit) {
      calls.pull++;
      maybeFail();
      return [...store[table].values()]
        .filter((r) => !since || String(r.server_updated_at) > since)
        .sort((a, b) => String(a.server_updated_at).localeCompare(String(b.server_updated_at)))
        .slice(0, limit)
        .map((r) => ({ ...r }));
    },
  };
}

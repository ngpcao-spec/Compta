import { supabase } from '@/lib/supabase';
import type { SyncedTable } from '@/db/types';
import { SyncError, type SyncRow, type SyncTransport } from './transport';

interface PgError {
  code?: string;
  message: string;
  status?: number;
}
interface LooseTable {
  upsert(rows: unknown[], opts?: { onConflict?: string }): PromiseLike<{ error: PgError | null }>;
  select(cols: string): {
    order(
      col: string,
      opts: { ascending: boolean },
    ): {
      limit(n: number): PromiseLike<{ data: SyncRow[] | null; error: PgError | null }>;
      gt(
        col: string,
        v: string,
      ): {
        limit(n: number): PromiseLike<{ data: SyncRow[] | null; error: PgError | null }>;
      };
    };
  };
}

function toSyncError(e: PgError): SyncError {
  const msg = e.message ?? '';
  if (
    e.status === 401 ||
    e.status === 403 ||
    e.code === 'PGRST301' ||
    e.code === 'PGRST303' ||
    /jwt/i.test(msg)
  ) {
    return new SyncError('auth', msg);
  }
  if (e.status === 0 || /failed to fetch|network|load failed|fetch/i.test(msg)) {
    return new SyncError('network', msg);
  }
  return new SyncError('server', msg);
}

const table = (name: SyncedTable): LooseTable => supabase.from(name) as unknown as LooseTable;

export const supabaseTransport: SyncTransport = {
  async upsert(name, rows) {
    try {
      const { error } = await table(name).upsert(
        rows,
        name === 'budgets' ? { onConflict: 'id' } : undefined,
      );
      if (error) throw toSyncError(error);
    } catch (e) {
      if (e instanceof SyncError) throw e;
      throw new SyncError('network', e instanceof Error ? e.message : String(e));
    }
  },

  async pull(name, since, limit) {
    try {
      const base = table(name).select('*').order('server_updated_at', { ascending: true });
      const { data, error } = await (since ? base.gt('server_updated_at', since) : base).limit(
        limit,
      );
      if (error) throw toSyncError(error);
      return data ?? [];
    } catch (e) {
      if (e instanceof SyncError) throw e;
      throw new SyncError('network', e instanceof Error ? e.message : String(e));
    }
  },
};

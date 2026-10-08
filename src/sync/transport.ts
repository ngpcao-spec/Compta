import type { SyncedTable } from '@/db/types';

export type SyncRow = Record<string, unknown> & { id: string; updated_at: string };

export type SyncErrorKind = 'network' | 'auth' | 'server';

export class SyncError extends Error {
  constructor(
    public readonly kind: SyncErrorKind,
    message: string,
  ) {
    super(message);
    this.name = 'SyncError';
  }
}

/** Frontière réseau : le moteur ne connaît que cette interface. */
export interface SyncTransport {
  upsert(table: SyncedTable, rows: SyncRow[]): Promise<void>;
  /** Lignes dont `server_updated_at` > `since`, triées par `server_updated_at`. */
  pull(table: SyncedTable, since: string | null, limit: number): Promise<SyncRow[]>;
}

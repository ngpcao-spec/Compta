import { useSyncExternalStore } from 'react';

export interface SyncStatus {
  state: 'idle' | 'syncing' | 'offline' | 'error';
  pending: number;
  lastSyncAt: string | null;
  /** Session expirée et impossible à rafraîchir : garder les données, proposer de se reconnecter. */
  authExpired: boolean;
}

export interface StatusStore {
  get(): SyncStatus;
  set(patch: Partial<SyncStatus>): void;
  subscribe(l: () => void): () => void;
}

export function createStatusStore(): StatusStore {
  let state: SyncStatus = { state: 'idle', pending: 0, lastSyncAt: null, authExpired: false };
  const ls = new Set<() => void>();
  return {
    get: () => state,
    set(patch) {
      state = { ...state, ...patch };
      for (const l of ls) l();
    },
    subscribe(l) {
      ls.add(l);
      return () => ls.delete(l);
    },
  };
}

export const syncStatus = createStatusStore();

export function useSyncStatus(): SyncStatus {
  return useSyncExternalStore(syncStatus.subscribe, syncStatus.get, syncStatus.get);
}

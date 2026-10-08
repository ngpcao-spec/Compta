import type { Database } from '@/types/supabase';

export type TxType = Database['public']['Enums']['tx_type'];
type Row<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row'];

/** `_dirty` : 1 = modifié localement, pas encore poussé. */
type Local<R> = R & { _dirty: 0 | 1 };

export type Category = Local<Row<'categories'>>;
export type Transaction = Local<Row<'transactions'>>;
export type Budget = Local<Row<'budgets'>>;
export type Profile = Local<Row<'profiles'>>;

export type SyncedTable = 'profiles' | 'categories' | 'budgets' | 'transactions';

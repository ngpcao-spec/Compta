// Types alignés sur supabase/migrations. À régénérer avec `npm run gen:types`
// dès que le projet Supabase existe (voir DECISIONS.md).
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type ProfileRow = {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  hide_amounts: boolean;
  default_budget: number | null;
  updated_at: string;
  server_updated_at: string;
};
type CategoryRow = {
  id: string;
  user_id: string;
  type: 'expense' | 'income';
  name: string;
  icon: string;
  color: string;
  sort_order: number;
  archived: boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  server_updated_at: string;
};
type TransactionRow = {
  id: string;
  user_id: string;
  category_id: string;
  type: 'expense' | 'income';
  amount: number;
  note: string | null;
  occurred_on: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  server_updated_at: string;
};
type BudgetRow = {
  id: string;
  user_id: string;
  month: string;
  amount: number;
  updated_at: string;
  deleted_at: string | null;
  server_updated_at: string;
};

type TableDef<R, Required extends keyof R> = {
  Row: R;
  Insert: Pick<R, Required> & Partial<Omit<R, Required>>;
  Update: Partial<R>;
  Relationships: [];
};

export type Database = {
  public: {
    Tables: {
      profiles: TableDef<ProfileRow, 'id'>;
      categories: TableDef<CategoryRow, 'id' | 'user_id' | 'type' | 'name' | 'icon' | 'color'>;
      transactions: TableDef<
        TransactionRow,
        'id' | 'user_id' | 'category_id' | 'type' | 'amount' | 'occurred_on'
      >;
      budgets: TableDef<BudgetRow, 'id' | 'user_id' | 'month' | 'amount'>;
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: { tx_type: 'expense' | 'income' };
    CompositeTypes: Record<string, never>;
  };
};

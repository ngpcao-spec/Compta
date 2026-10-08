export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: '14.18';
  };
  public: {
    Tables: {
      budgets: {
        Row: {
          amount: number;
          deleted_at: string | null;
          id: string;
          month: string;
          server_updated_at: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          amount: number;
          deleted_at?: string | null;
          id: string;
          month: string;
          server_updated_at?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          amount?: number;
          deleted_at?: string | null;
          id?: string;
          month?: string;
          server_updated_at?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      categories: {
        Row: {
          archived: boolean;
          color: string;
          created_at: string;
          deleted_at: string | null;
          icon: string;
          id: string;
          name: string;
          server_updated_at: string;
          sort_order: number;
          type: Database['public']['Enums']['tx_type'];
          updated_at: string;
          user_id: string;
        };
        Insert: {
          archived?: boolean;
          color: string;
          created_at?: string;
          deleted_at?: string | null;
          icon: string;
          id: string;
          name: string;
          server_updated_at?: string;
          sort_order?: number;
          type: Database['public']['Enums']['tx_type'];
          updated_at?: string;
          user_id: string;
        };
        Update: {
          archived?: boolean;
          color?: string;
          created_at?: string;
          deleted_at?: string | null;
          icon?: string;
          id?: string;
          name?: string;
          server_updated_at?: string;
          sort_order?: number;
          type?: Database['public']['Enums']['tx_type'];
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          avatar_url: string | null;
          default_budget: number | null;
          display_name: string | null;
          hide_amounts: boolean;
          id: string;
          server_updated_at: string;
          updated_at: string;
        };
        Insert: {
          avatar_url?: string | null;
          default_budget?: number | null;
          display_name?: string | null;
          hide_amounts?: boolean;
          id: string;
          server_updated_at?: string;
          updated_at?: string;
        };
        Update: {
          avatar_url?: string | null;
          default_budget?: number | null;
          display_name?: string | null;
          hide_amounts?: boolean;
          id?: string;
          server_updated_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      receipt_scans: {
        Row: {
          created_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      transactions: {
        Row: {
          amount: number;
          category_id: string;
          created_at: string;
          deleted_at: string | null;
          id: string;
          note: string | null;
          occurred_on: string;
          server_updated_at: string;
          type: Database['public']['Enums']['tx_type'];
          updated_at: string;
          user_id: string;
        };
        Insert: {
          amount: number;
          category_id: string;
          created_at?: string;
          deleted_at?: string | null;
          id: string;
          note?: string | null;
          occurred_on: string;
          server_updated_at?: string;
          type: Database['public']['Enums']['tx_type'];
          updated_at?: string;
          user_id: string;
        };
        Update: {
          amount?: number;
          category_id?: string;
          created_at?: string;
          deleted_at?: string | null;
          id?: string;
          note?: string | null;
          occurred_on?: string;
          server_updated_at?: string;
          type?: Database['public']['Enums']['tx_type'];
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'transactions_category_id_fkey';
            columns: ['category_id'];
            isOneToOne: false;
            referencedRelation: 'categories';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      tx_type: 'expense' | 'income';
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

export const Constants = {
  public: {
    Enums: {
      tx_type: ['expense', 'income'],
    },
  },
} as const;

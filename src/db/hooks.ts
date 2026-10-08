import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './local';
import type { Budget, Category, Profile, Transaction, TxType } from './types';
import { monthEnd, monthStart } from '@/lib/dates';

export function useProfile(): Profile | undefined {
  return useLiveQuery(async () => (await db.profiles.toArray())[0], []);
}

export function useHideAmounts(): boolean {
  return useProfile()?.hide_amounts ?? false;
}

/** Catégories d'un type, triées ; `archived` sélectionne les actives (false) ou les archivées (true). */
export function useCategories(type: TxType, archived = false): Category[] | undefined {
  return useLiveQuery(async () => {
    const rows = await db.categories.where('type').equals(type).toArray();
    return rows
      .filter((c) => !c.deleted_at && c.archived === archived)
      .sort((a, b) => a.sort_order - b.sort_order);
  }, [type, archived]);
}

/** Toutes les catégories (y compris archivées) pour les statistiques et l'historique. */
export function useAllCategories(): Category[] | undefined {
  return useLiveQuery(async () => (await db.categories.toArray()).filter((c) => !c.deleted_at), []);
}

/** `undefined` = chargement, `null` = introuvable. */
export function useCategory(id: string | undefined): Category | null | undefined {
  return useLiveQuery(async () => (id ? ((await db.categories.get(id)) ?? null) : null), [id]);
}

export function useMonthTransactions(month: string): Transaction[] | undefined {
  return useLiveQuery(async () => {
    const rows = await db.transactions
      .where('occurred_on')
      .between(monthStart(month), monthEnd(month), true, true)
      .toArray();
    return rows.filter((t) => !t.deleted_at);
  }, [month]);
}

export function useYearTransactions(year: number): Transaction[] | undefined {
  return useLiveQuery(async () => {
    const rows = await db.transactions
      .where('occurred_on')
      .between(`${year}-01-01`, `${year}-12-31`, true, true)
      .toArray();
    return rows.filter((t) => !t.deleted_at);
  }, [year]);
}

export function useAllTransactions(): Transaction[] | undefined {
  return useLiveQuery(
    async () => (await db.transactions.toArray()).filter((t) => !t.deleted_at),
    [],
  );
}

/** `undefined` = chargement, `null` = introuvable. */
export function useTransaction(id: string | undefined): Transaction | null | undefined {
  return useLiveQuery(async () => (id ? ((await db.transactions.get(id)) ?? null) : null), [id]);
}

export function useBudgets(): Budget[] | undefined {
  return useLiveQuery(async () => (await db.budgets.toArray()).filter((b) => !b.deleted_at), []);
}

/** Années pour lesquelles il existe des transactions, plus l'année courante. */
export function useTransactionYears(): number[] {
  return (
    useLiveQuery(async () => {
      const keys = await db.transactions.orderBy('occurred_on').keys();
      const years = new Set<number>([new Date().getFullYear()]);
      for (const k of keys) years.add(Number(String(k).slice(0, 4)));
      return [...years].sort((a, b) => b - a);
    }, []) ?? [new Date().getFullYear()]
  );
}

/** Premier mois contenant une transaction (pour borner les listes de mois). */
export function useEarliestMonth(): string | undefined {
  return useLiveQuery(async () => {
    const first = await db.transactions.orderBy('occurred_on').first();
    return first ? monthStart(first.occurred_on) : undefined;
  }, []);
}

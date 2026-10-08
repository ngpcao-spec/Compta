import type { Budget, Category, Transaction, TxType } from '@/db/types';
import { addMonths, compareMonths, elapsedDays, elapsedMonths, monthOf, monthStart } from './dates';

type TxLite = Pick<Transaction, 'type' | 'amount' | 'occurred_on'>;

export interface Totals {
  income: number;
  expense: number;
  balance: number;
}

export function totals(txs: readonly Pick<Transaction, 'type' | 'amount'>[]): Totals {
  let income = 0;
  let expense = 0;
  for (const t of txs) {
    if (t.type === 'income') income += t.amount;
    else expense += t.amount;
  }
  return { income, expense, balance: income - expense };
}

export function inMonth<T extends Pick<Transaction, 'occurred_on'>>(
  txs: readonly T[],
  month: string,
): T[] {
  const prefix = monthStart(month).slice(0, 7);
  return txs.filter((t) => t.occurred_on.startsWith(prefix));
}

export interface DayGroup<T> {
  date: string;
  items: T[];
  income: number;
  expense: number;
}

/** Groupes par jour, jour le plus récent en haut ; dans un jour, création décroissante. */
export function groupByDay<
  T extends Pick<Transaction, 'occurred_on' | 'type' | 'amount' | 'created_at'>,
>(txs: readonly T[]): DayGroup<T>[] {
  const map = new Map<string, T[]>();
  for (const t of txs) {
    const list = map.get(t.occurred_on);
    if (list) list.push(t);
    else map.set(t.occurred_on, [t]);
  }
  return [...map.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([date, items]) => {
      items.sort((a, b) => b.created_at.localeCompare(a.created_at));
      const tt = totals(items);
      return { date, items, income: tt.income, expense: tt.expense };
    });
}

/** Dépenses ÷ jours écoulés (arrondi). */
export function dailyAverage(expense: number, month: string, today: string): number {
  const days = elapsedDays(month, today);
  return days === 0 ? 0 : Math.round(expense / days);
}

/**
 * Budget effectif d'un mois : ligne du mois > budget par défaut du profil >
 * ligne du mois antérieur le plus récent. `null` si aucun.
 */
export function resolveBudget(
  month: string,
  budgets: readonly Pick<Budget, 'month' | 'amount' | 'deleted_at'>[],
  defaultBudget: number | null,
): { amount: number; inherited: boolean } | null {
  const live = budgets.filter((b) => !b.deleted_at);
  const exact = live.find((b) => compareMonths(b.month, month) === 0);
  if (exact) return { amount: exact.amount, inherited: false };
  if (defaultBudget) return { amount: defaultBudget, inherited: true };
  const earlier = live
    .filter((b) => compareMonths(b.month, month) < 0)
    .sort((a, b) => compareMonths(b.month, a.month))[0];
  return earlier ? { amount: earlier.amount, inherited: true } : null;
}

export interface BudgetStatus {
  amount: number;
  spent: number;
  remaining: number;
  /** 0..1, plafonné */
  ratio: number;
  over: boolean;
}

export function budgetStatus(amount: number, spent: number): BudgetStatus {
  return {
    amount,
    spent,
    remaining: amount - spent,
    ratio: amount > 0 ? Math.min(1, spent / amount) : 0,
    over: spent > amount,
  };
}

export interface CategoryShare {
  categoryId: string;
  name: string;
  icon: string;
  color: string;
  amount: number;
  /** 0..100 */
  percent: number;
}

/** Répartition par catégorie du type donné, triée par montant décroissant. */
export function categoryBreakdown(
  txs: readonly Pick<Transaction, 'type' | 'amount' | 'category_id'>[],
  categories: readonly Pick<Category, 'id' | 'name' | 'icon' | 'color'>[],
  type: TxType,
): { total: number; items: CategoryShare[] } {
  const byCat = new Map<string, number>();
  let total = 0;
  for (const t of txs) {
    if (t.type !== type) continue;
    byCat.set(t.category_id, (byCat.get(t.category_id) ?? 0) + t.amount);
    total += t.amount;
  }
  const items: CategoryShare[] = [];
  for (const [categoryId, amount] of byCat) {
    const c = categories.find((x) => x.id === categoryId);
    items.push({
      categoryId,
      name: c?.name ?? '?',
      icon: c?.icon ?? 'ellipsis',
      color: c?.color ?? '#9E9E9E',
      amount,
      percent: total > 0 ? (amount / total) * 100 : 0,
    });
  }
  items.sort((a, b) => b.amount - a.amount || a.name.localeCompare(b.name));
  return { total, items };
}

export interface MonthRow extends Totals {
  month: string;
}

/** Totaux des mois d'une année, de janvier au dernier mois écoulé. */
export function monthlyTotals(txs: readonly TxLite[], year: number, today: string): MonthRow[] {
  const n = elapsedMonths(year, today);
  const rows: MonthRow[] = [];
  for (let m = 1; m <= n; m++) {
    const month = monthOf(year, m);
    rows.push({ month, ...totals(inMonth(txs, month)) });
  }
  return rows;
}

export interface YearSummary {
  year: Totals;
  monthlyAverage: Totals;
  months: MonthRow[];
}

export function yearSummary(txs: readonly TxLite[], year: number, today: string): YearSummary {
  const months = monthlyTotals(txs, year, today);
  const year_ = totals(txs.filter((t) => t.occurred_on.startsWith(`${year}-`)));
  const n = elapsedMonths(year, today);
  const avg = (v: number) => (n === 0 ? 0 : Math.round(v / n));
  return {
    year: year_,
    monthlyAverage: {
      income: avg(year_.income),
      expense: avg(year_.expense),
      balance: avg(year_.balance),
    },
    months: [...months].reverse(),
  };
}

export { addMonths };

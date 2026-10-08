import { describe, expect, it } from 'vitest';
import {
  budgetStatus,
  categoryBreakdown,
  dailyAverage,
  groupByDay,
  inMonth,
  resolveBudget,
  totals,
  yearSummary,
} from './stats';

type T = {
  id: string;
  type: 'expense' | 'income';
  amount: number;
  occurred_on: string;
  category_id: string;
  created_at: string;
};
const tx = (
  id: string,
  type: T['type'],
  amount: number,
  occurred_on: string,
  category_id: string,
  created_at = '2026-01-01T00:00:00Z',
): T => ({ id, type, amount, occurred_on, category_id, created_at });

// Jeu de données « maquette » : janvier 2026
const jan: T[] = [
  tx('1', 'income', 38000000, '2026-01-02', 'luong'),
  tx('2', 'expense', 1200000, '2026-01-02', 'an', '2026-01-02T08:00:00Z'),
  tx('3', 'expense', 400000, '2026-01-02', 'traicay', '2026-01-02T09:00:00Z'),
  tx('4', 'expense', 3200000, '2026-01-02', 'quanao', '2026-01-02T10:00:00Z'),
  tx('5', 'expense', 3700000, '2026-01-01', 'qua'),
  tx('6', 'expense', 750000, '2026-01-01', 'game', '2026-01-01T01:00:00Z'),
];

describe('totals', () => {
  it('reproduit les valeurs de la maquette', () => {
    const t = totals(jan);
    expect(t.income).toBe(38000000);
    expect(t.expense).toBe(9250000);
    expect(t.balance).toBe(28750000);
  });
  it('moyenne journalière au 2 janvier', () => {
    expect(dailyAverage(9250000, '2026-01-01', '2026-01-02')).toBe(4625000);
    expect(dailyAverage(9250000, '2026-02-01', '2026-01-02')).toBe(0);
    expect(dailyAverage(3100000, '2025-12-01', '2026-01-02')).toBe(100000);
  });
});

describe('groupByDay', () => {
  it('trie les jours décroissants et les transactions par création décroissante', () => {
    const g = groupByDay(jan);
    expect(g.map((x) => x.date)).toEqual(['2026-01-02', '2026-01-01']);
    expect(g[0]?.items.map((i) => i.id)).toEqual(['4', '3', '2', '1']);
    expect(g[0]).toMatchObject({ income: 38000000, expense: 4800000 });
    expect(g[1]).toMatchObject({ income: 0, expense: 4450000 });
  });
  it('filtre par mois', () => {
    expect(inMonth([...jan, tx('x', 'expense', 1, '2026-02-01', 'an')], '2026-01-15')).toHaveLength(
      6,
    );
  });
});

describe('resolveBudget', () => {
  const b = (month: string, amount: number, deleted_at: string | null = null) => ({
    month,
    amount,
    deleted_at,
  });
  it('retourne null sans budget', () => {
    expect(resolveBudget('2026-01-01', [], null)).toBeNull();
  });
  it('hérite du mois antérieur le plus récent', () => {
    const list = [b('2025-10-01', 10), b('2025-12-01', 18000000)];
    expect(resolveBudget('2026-03-01', list, null)).toEqual({ amount: 18000000, inherited: true });
    expect(resolveBudget('2025-12-01', list, null)).toEqual({ amount: 18000000, inherited: false });
    expect(resolveBudget('2025-11-01', list, null)).toEqual({ amount: 10, inherited: true });
    expect(resolveBudget('2025-09-01', list, null)).toBeNull();
  });
  it('le budget par défaut prime sur l’héritage mais pas sur une ligne du mois', () => {
    const list = [b('2025-12-01', 18000000)];
    expect(resolveBudget('2026-02-01', list, 20000000)).toEqual({
      amount: 20000000,
      inherited: true,
    });
    expect(resolveBudget('2025-12-01', list, 20000000)).toEqual({
      amount: 18000000,
      inherited: false,
    });
  });
  it('ignore les lignes supprimées', () => {
    expect(
      resolveBudget('2026-01-01', [b('2025-12-01', 5, '2026-01-01T00:00:00Z')], null),
    ).toBeNull();
  });
  it('calcule reste et dépassement', () => {
    expect(budgetStatus(18000000, 9250000)).toMatchObject({ remaining: 8750000, over: false });
    expect(budgetStatus(1000, 1500)).toMatchObject({ remaining: -500, over: true, ratio: 1 });
  });
});

describe('categoryBreakdown', () => {
  const cats = [
    { id: 'an', name: 'Ăn uống', icon: 'utensils', color: '#FBC02D' },
    { id: 'qua', name: 'Quà tặng', icon: 'gift', color: '#EC407A' },
  ];
  it('calcule parts et tri', () => {
    const r = categoryBreakdown(jan, cats, 'expense');
    expect(r.total).toBe(9250000);
    expect(r.items[0]?.categoryId).toBe('qua');
    expect(r.items.reduce((s, i) => s + i.percent, 0)).toBeCloseTo(100);
  });
  it('type vide', () => {
    expect(categoryBreakdown([], cats, 'income')).toEqual({ total: 0, items: [] });
  });
});

describe('yearSummary', () => {
  const data = [
    tx('a', 'income', 700, '2026-01-10', 'x'),
    tx('b', 'expense', 100, '2026-01-12', 'x'),
    tx('c', 'income', 100, '2026-02-03', 'x'),
    tx('d', 'expense', 300, '2026-03-05', 'x'),
    tx('e', 'expense', 999, '2025-12-31', 'x'),
  ];
  it('totaux annuels, moyenne mensuelle et lignes décroissantes', () => {
    const s = yearSummary(data, 2026, '2026-03-20');
    expect(s.year).toEqual({ income: 800, expense: 400, balance: 400 });
    expect(s.monthlyAverage).toEqual({ income: 267, expense: 133, balance: 133 });
    expect(s.months.map((m) => m.month)).toEqual(['2026-03-01', '2026-02-01', '2026-01-01']);
    expect(s.months[2]).toMatchObject({ income: 700, expense: 100, balance: 600 });
  });
  it('année passée = 12 mois', () => {
    const s = yearSummary(data, 2025, '2026-03-20');
    expect(s.months).toHaveLength(12);
    expect(s.monthlyAverage.expense).toBe(83);
  });
});

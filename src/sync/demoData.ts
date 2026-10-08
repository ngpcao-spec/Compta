import type { TxType } from '@/db/types';

export interface DemoTx {
  date: string;
  type: TxType;
  category: string;
  amount: number;
  note?: string;
}

const e = (date: string, category: string, amount: number, note?: string): DemoTx => ({
  date,
  type: 'expense',
  category,
  amount,
  note,
});
const i = (date: string, category: string, amount: number, note?: string): DemoTx => ({
  date,
  type: 'income',
  category,
  amount,
  note,
});

/**
 * Jeu de démonstration (SPEC §12), calé sur les maquettes : janvier 2026 = thu 38,000,000,
 * chi 9,250,000, solde 28,750,000 ; février–juillet = tableau « Xu hướng ». Année : 228,000,000
 * de revenus, 101,250,000 de dépenses, 126,750,000 de solde.
 */
export const DEMO_TXS: readonly DemoTx[] = [
  i('2026-01-02', 'Lương', 38_000_000),
  e('2026-01-02', 'Ăn uống', 1_200_000),
  e('2026-01-02', 'Trái cây', 400_000),
  e('2026-01-02', 'Quần áo', 3_200_000, 'Mũ nón'),
  e('2026-01-01', 'Quà tặng', 3_700_000),
  e('2026-01-01', 'Game', 750_000),

  // Février–juillet : totaux de la maquette « Xu hướng » (thu / chi par mois).
  i('2026-02-03', 'Lương', 30_000_000),
  e('2026-02-05', 'Ăn uống', 6_000_000),
  e('2026-02-06', 'Tiền nhà', 6_000_000),

  i('2026-03-03', 'Lương', 30_000_000),
  e('2026-03-05', 'Ăn uống', 8_000_000),
  e('2026-03-20', 'Mua sắm', 8_000_000),

  i('2026-04-03', 'Lương', 35_000_000),
  e('2026-04-05', 'Ăn uống', 7_000_000),
  e('2026-04-18', 'Du lịch', 8_000_000),

  i('2026-05-03', 'Lương', 35_000_000),
  e('2026-05-05', 'Ăn uống', 7_000_000),
  e('2026-05-25', 'Điện', 5_000_000),

  i('2026-06-03', 'Lương', 32_000_000),
  e('2026-06-05', 'Ăn uống', 9_000_000),
  e('2026-06-14', 'Quần áo', 6_000_000),

  i('2026-07-03', 'Lương', 28_000_000),
  e('2026-07-05', 'Ăn uống', 10_000_000),
  e('2026-07-06', 'Tiền nhà', 12_000_000),
];

export const DEMO_BUDGET = { month: '2026-01-01', amount: 18_000_000 } as const;

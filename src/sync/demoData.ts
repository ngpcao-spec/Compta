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
 * Jeu de démonstration (SPEC §12). Janvier 2026 reproduit la maquette (thu 38,000,000,
 * chi 9,250,000, solde 28,750,000). Février–juillet : les maquettes n'ont pas été fournies,
 * valeurs plausibles (voir DECISIONS.md).
 */
export const DEMO_TXS: readonly DemoTx[] = [
  i('2026-01-02', 'Lương', 38_000_000),
  e('2026-01-02', 'Ăn uống', 1_200_000),
  e('2026-01-02', 'Trái cây', 400_000),
  e('2026-01-02', 'Quần áo', 3_200_000, 'Mũ nón'),
  e('2026-01-01', 'Quà tặng', 3_700_000),
  e('2026-01-01', 'Game', 450_000),
  e('2026-01-01', 'Ăn uống', 300_000),

  i('2026-02-03', 'Lương', 38_000_000),
  e('2026-02-05', 'Ăn uống', 6_500_000),
  e('2026-02-06', 'Tiền nhà', 8_000_000),
  e('2026-02-10', 'Điện', 1_200_000),

  i('2026-03-03', 'Lương', 38_000_000),
  i('2026-03-15', 'Thưởng', 5_000_000),
  e('2026-03-05', 'Ăn uống', 7_200_000),
  e('2026-03-06', 'Tiền nhà', 8_000_000),
  e('2026-03-20', 'Mua sắm', 4_300_000),

  i('2026-04-03', 'Lương', 38_000_000),
  e('2026-04-05', 'Ăn uống', 6_000_000),
  e('2026-04-06', 'Tiền nhà', 8_000_000),
  e('2026-04-18', 'Du lịch', 2_500_000),

  i('2026-05-03', 'Lương', 38_000_000),
  e('2026-05-05', 'Ăn uống', 7_800_000),
  e('2026-05-06', 'Tiền nhà', 8_000_000),
  e('2026-05-12', 'Mua sắm', 3_900_000),
  e('2026-05-25', 'Điện', 1_100_000),

  i('2026-06-03', 'Lương', 38_000_000),
  i('2026-06-20', 'Làm thêm', 3_000_000),
  e('2026-06-05', 'Ăn uống', 6_900_000),
  e('2026-06-06', 'Tiền nhà', 8_000_000),
  e('2026-06-14', 'Quần áo', 2_700_000),

  i('2026-07-03', 'Lương', 38_000_000),
  e('2026-07-05', 'Ăn uống', 5_500_000),
  e('2026-07-06', 'Tiền nhà', 8_000_000),
  e('2026-07-12', 'Cà phê', 1_800_000),
];

export const DEMO_BUDGET = { month: '2026-01-01', amount: 18_000_000 } as const;

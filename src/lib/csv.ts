import type { Category, Transaction } from '@/db/types';

const BOM = '﻿';

function esc(v: string | number): string {
  const s = String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** CSV UTF-8 avec BOM (Excel) : date, type, catégorie, montant, note. */
export function buildCsv(
  txs: readonly Pick<
    Transaction,
    'occurred_on' | 'type' | 'category_id' | 'amount' | 'note' | 'created_at'
  >[],
  categories: readonly Pick<Category, 'id' | 'name'>[],
  labels: { header: string[]; expense: string; income: string },
): string {
  const names = new Map(categories.map((c) => [c.id, c.name]));
  const rows = [...txs].sort(
    (a, b) =>
      a.occurred_on.localeCompare(b.occurred_on) || a.created_at.localeCompare(b.created_at),
  );
  const lines = [labels.header.map(esc).join(',')];
  for (const t of rows) {
    lines.push(
      [
        t.occurred_on,
        t.type === 'expense' ? labels.expense : labels.income,
        names.get(t.category_id) ?? '',
        t.amount,
        t.note ?? '',
      ]
        .map(esc)
        .join(','),
    );
  }
  return BOM + lines.join('\r\n') + '\r\n';
}

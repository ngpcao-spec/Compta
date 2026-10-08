import { db } from '@/db/local';
import { buildCsv } from '@/lib/csv';
import { todayStr } from '@/lib/dates';
import { vi } from '@/i18n/vi';

/** Exporte toutes les transactions actives. Retourne false s'il n'y en a aucune. */
export async function exportCsv(): Promise<boolean> {
  const [txs, cats] = await Promise.all([db.transactions.toArray(), db.categories.toArray()]);
  const live = txs.filter((t) => !t.deleted_at);
  if (live.length === 0) return false;
  const csv = buildCsv(live, cats, {
    header: [...vi.more.csvHeader],
    expense: vi.common.expense,
    income: vi.common.income,
  });
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `so-thu-chi-${todayStr()}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return true;
}

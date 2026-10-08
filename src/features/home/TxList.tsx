import { useState } from 'react';
import { useNavigate } from 'react-router';
import { CategoryIcon } from '@/components/CategoryIcon';
import { ConfirmSheet } from '@/components/ConfirmSheet';
import { Money } from '@/components/Money';
import { SwipeRow } from '@/components/SwipeRow';
import { useToast } from '@/components/Toast';
import type { Category, Transaction } from '@/db/types';
import { deleteTransaction } from '@/db/repo/transactions';
import { vi } from '@/i18n/vi';
import { formatDayHeader } from '@/lib/dates';
import type { DayGroup } from '@/lib/stats';

interface Props {
  groups: DayGroup<Transaction>[];
  categories: readonly Category[];
}

export function TxRow({ tx, category }: { tx: Transaction; category: Category | undefined }) {
  return (
    <div className="flex min-h-[56px] items-center gap-3 px-4 py-2">
      <CategoryIcon icon={category?.icon ?? 'ellipsis'} color={category?.color ?? '#9E9E9E'} />
      <div className="min-w-0 flex-1">
        <div className="truncate font-medium">{category?.name ?? '—'}</div>
        {tx.note && <div className="truncate text-sm text-muted">{tx.note}</div>}
      </div>
      <Money
        value={tx.amount}
        expense={tx.type === 'expense'}
        className={`shrink-0 font-semibold ${tx.type === 'income' ? 'text-income' : 'text-expense'}`}
      />
    </div>
  );
}

export function TxList({ groups, categories }: Props) {
  const navigate = useNavigate();
  const toast = useToast();
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const byId = new Map(categories.map((c) => [c.id, c]));

  return (
    <div className="mx-4 mt-3 space-y-3">
      {groups.map((g) => (
        <section key={g.date} className="card overflow-hidden" aria-label={formatDayHeader(g.date)}>
          <div className="flex flex-wrap items-center justify-between gap-x-3 border-b border-divider px-4 py-2 text-xs text-muted">
            <span className="whitespace-nowrap font-semibold">{formatDayHeader(g.date)}</span>
            <span className="flex gap-3 whitespace-nowrap">
              {g.expense > 0 && (
                <span>
                  {vi.home.expense}: <Money value={g.expense} expense />
                </span>
              )}
              {g.income > 0 && (
                <span>
                  {vi.home.income}: <Money value={g.income} />
                </span>
              )}
            </span>
          </div>
          <ul>
            {g.items.map((t) => (
              <li
                key={t.id}
                className="border-b border-divider last:border-b-0"
                data-testid="tx-row"
              >
                <SwipeRow
                  onOpen={() => void navigate(`/tx/${t.id}`)}
                  onDelete={() => setPendingDelete(t.id)}
                >
                  <TxRow tx={t} category={byId.get(t.category_id)} />
                </SwipeRow>
              </li>
            ))}
          </ul>
        </section>
      ))}
      <ConfirmSheet
        open={pendingDelete !== null}
        title={vi.home.deleteConfirm}
        confirmLabel={vi.common.delete}
        danger
        onCancel={() => setPendingDelete(null)}
        onConfirm={async () => {
          const id = pendingDelete;
          setPendingDelete(null);
          if (id) {
            await deleteTransaction(id);
            toast(vi.home.deleted);
          }
        }}
      />
    </div>
  );
}

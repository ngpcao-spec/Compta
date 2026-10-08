import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { Ellipsis } from 'lucide-react';
import { BottomSheet } from '@/components/BottomSheet';
import { CategoryIcon } from '@/components/CategoryIcon';
import { Money } from '@/components/Money';
import { Segmented } from '@/components/Segmented';
import { useAllCategories, useEarliestMonth, useMonthTransactions } from '@/db/hooks';
import type { TxType } from '@/db/types';
import { TxRow } from '@/features/home/TxList';
import { useNavigate } from 'react-router';
import { vi } from '@/i18n/vi';
import { addMonths, compareMonths, formatMonthVi, monthStart, todayStr } from '@/lib/dates';
import { useMonthParam } from '@/lib/nav';
import { categoryBreakdown, dailyAverage, totals } from '@/lib/stats';
import { CategoryDonut } from './CategoryDonut';

function Tile({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="card p-3">
      <div className="text-xs text-muted">{label}</div>
      <div className="mt-1 text-xl font-bold">{children}</div>
    </div>
  );
}

export function ChartsPage() {
  const [month, setMonth] = useMonthParam();
  const navigate = useNavigate();
  const txsQ = useMonthTransactions(month);
  const categoriesQ = useAllCategories();
  const txs = useMemo(() => txsQ ?? [], [txsQ]);
  const categories = useMemo(() => categoriesQ ?? [], [categoriesQ]);
  const earliest = useEarliestMonth();
  const [type, setType] = useState<TxType>('expense');
  const [menu, setMenu] = useState(false);
  const [detail, setDetail] = useState<string | null>(null);
  const today = todayStr();

  const t = useMemo(() => totals(txs), [txs]);
  const daily = dailyAverage(t.expense, month, today);
  const { total, items } = useMemo(
    () => categoryBreakdown(txs, categories, type),
    [txs, categories, type],
  );

  const months = useMemo(() => {
    const current = monthStart(today);
    let from = addMonths(current, -11);
    if (earliest && compareMonths(earliest, from) < 0) from = earliest;
    if (compareMonths(month, from) < 0) from = month;
    const list: string[] = [];
    for (let m = from; compareMonths(m, current) <= 0; m = addMonths(m, 1)) list.push(m);
    if (!list.includes(month)) list.push(month);
    return list.sort((a, b) => compareMonths(b, a));
  }, [earliest, month, today]);

  const detailItems = detail ? txs.filter((x) => x.category_id === detail && x.type === type) : [];
  const detailCat = categories.find((c) => c.id === detail);

  return (
    <div>
      <header
        className="flex items-center justify-between bg-white px-4 pt-[calc(var(--safe-top)+8px)]"
        style={{ minHeight: 56 }}
      >
        <h1 className="text-lg font-bold">{vi.charts.title}</h1>
        <div className="relative">
          <button
            className="tap flex items-center justify-center"
            aria-label={vi.common.menu}
            onClick={() => setMenu((v) => !v)}
          >
            <Ellipsis />
          </button>
          {menu && (
            <div
              className="absolute right-0 z-20 w-44 overflow-hidden rounded-xl bg-white shadow-lg"
              role="menu"
            >
              <Link role="menuitem" to="/trend" className="tap block px-4 py-3 text-sm">
                {vi.charts.trend}
              </Link>
            </div>
          )}
        </div>
      </header>

      <div className="space-y-3 p-4">
        <select
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          aria-label={vi.home.pickMonth}
          data-testid="month-select"
          className="tap w-full rounded-xl bg-white px-3 font-semibold shadow-sm"
        >
          {months.map((m) => (
            <option key={m} value={m}>
              {formatMonthVi(m)}
            </option>
          ))}
        </select>

        <div className="grid grid-cols-2 gap-3">
          <Tile label={vi.charts.income}>
            <span data-testid="tile-income" className="text-income">
              <Money value={t.income} />
            </span>
          </Tile>
          <Tile label={vi.charts.expense}>
            <span data-testid="tile-expense">
              <Money value={t.expense} expense />
            </span>
          </Tile>
          <Tile label={vi.charts.balance}>
            <span
              data-testid="tile-balance"
              className={t.balance < 0 ? 'text-danger' : 'text-income'}
            >
              <Money value={t.balance} />
            </span>
          </Tile>
          <Tile label={vi.charts.daily}>
            <span data-testid="tile-daily">
              <Money value={daily} expense />
            </span>
          </Tile>
        </div>

        <section className="card p-3" aria-label={vi.charts.category}>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="font-bold">{vi.charts.category}</h2>
            <div className="w-56">
              <Segmented
                value={type}
                onChange={setType}
                options={[
                  { value: 'income', label: vi.charts.income },
                  { value: 'expense', label: vi.charts.expense },
                ]}
              />
            </div>
          </div>
          {items.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted">{vi.charts.noData}</p>
          ) : (
            <>
              <CategoryDonut items={items} total={total} />
              <ul className="mt-2 divide-y divide-divider" data-testid="ranking">
                {items.map((i) => (
                  <li key={i.categoryId}>
                    <button
                      className="tap flex w-full items-center gap-3 py-2 text-left"
                      onClick={() => setDetail(i.categoryId)}
                    >
                      <CategoryIcon icon={i.icon} color={i.color} size={32} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2 text-sm">
                          <span className="truncate font-medium">{i.name}</span>
                          <span className="shrink-0 text-xs text-muted">
                            {i.percent.toFixed(1)}%
                          </span>
                        </div>
                        <div className="mt-1 h-1 overflow-hidden rounded-full bg-divider">
                          <div
                            className="h-full rounded-full"
                            style={{ width: `${i.percent}%`, background: i.color }}
                          />
                        </div>
                      </div>
                      <Money value={i.amount} className="shrink-0 text-sm font-semibold" />
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      </div>

      <BottomSheet
        open={detail !== null}
        onClose={() => setDetail(null)}
        title={detailCat?.name ?? vi.charts.byCategory}
      >
        <div className="max-h-[60vh] overflow-y-auto pb-4">
          <h2 className="px-4 pb-2 text-lg font-bold">{detailCat?.name}</h2>
          <ul>
            {detailItems
              .sort(
                (a, b) =>
                  b.occurred_on.localeCompare(a.occurred_on) ||
                  b.created_at.localeCompare(a.created_at),
              )
              .map((x) => (
                <li key={x.id}>
                  <button className="w-full text-left" onClick={() => void navigate(`/tx/${x.id}`)}>
                    <div className="px-4 pt-1 text-xs text-muted">{x.occurred_on}</div>
                    <TxRow tx={x} category={detailCat} />
                  </button>
                </li>
              ))}
          </ul>
        </div>
      </BottomSheet>
    </div>
  );
}

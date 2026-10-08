import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Money, useAmountText } from '@/components/Money';
import { Segmented } from '@/components/Segmented';
import { useYearTransactions } from '@/db/hooks';
import type { TxType } from '@/db/types';
import { vi } from '@/i18n/vi';
import { parseDateStr, todayStr } from '@/lib/dates';
import { useGoBack } from '@/lib/nav';
import { niceAxis, yearSummary } from '@/lib/stats';

const arrowClass =
  'flex h-11 w-11 items-center justify-center rounded-full bg-white shadow-[0_1px_3px_rgb(0_0_0/0.08)] disabled:text-[#9AA0A8]';

export function TrendPage() {
  const goBack = useGoBack('/charts');
  const today = todayStr();
  const currentYear = parseDateStr(today).y;
  const [year, setYear] = useState(currentYear);
  const [type, setType] = useState<TxType>('expense');
  const txsQ = useYearTransactions(year);
  const txs = useMemo(() => txsQ ?? [], [txsQ]);
  const text = useAmountText();

  const summary = useMemo(() => yearSummary(txs, year, today), [txs, year, today]);
  const data = useMemo(
    () =>
      [...summary.months].reverse().map((m) => ({
        label: `thg ${parseDateStr(m.month).m}`,
        value: type === 'expense' ? m.expense : m.income,
      })),
    [summary, type],
  );
  const axis = useMemo(() => niceAxis(Math.max(0, ...data.map((d) => d.value))), [data]);
  const color = type === 'expense' ? '#E53935' : '#1976D2';

  return (
    <div className="flex h-full flex-col">
      <header
        className="relative flex items-center bg-white px-2 pt-[var(--safe-top)] shadow-[0_1px_0_var(--divider)]"
        style={{ minHeight: 52 }}
      >
        <button
          className="tap flex items-center gap-0.5 px-2 text-base text-primary"
          onClick={goBack}
          aria-label={vi.common.back}
        >
          <ChevronLeft size={22} strokeWidth={2.2} />
          {vi.tabs.charts}
        </button>
        <h1 className="pointer-events-none absolute inset-x-0 text-center text-[17px] font-bold">
          {vi.trend.title}
        </h1>
      </header>

      <div className="no-scrollbar min-h-0 flex-1 space-y-3 overflow-y-auto p-4 pb-10">
        <div className="flex items-center justify-center gap-6">
          <button
            className={arrowClass}
            aria-label={vi.home.prevMonth}
            onClick={() => setYear(year - 1)}
          >
            <ChevronLeft size={20} />
          </button>
          <span className="min-w-16 text-center text-[22px] font-bold" data-testid="year-label">
            {year}
          </span>
          <button
            className={arrowClass}
            aria-label={vi.home.nextMonth}
            disabled={year >= currentYear}
            onClick={() => setYear(year + 1)}
          >
            <ChevronRight size={20} />
          </button>
        </div>

        <section className="card p-4">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h2 className="text-xl font-bold">{vi.trend.card}</h2>
            <div className="w-[176px]">
              <Segmented
                small
                value={type}
                onChange={setType}
                options={[
                  { value: 'income', label: vi.charts.income },
                  { value: 'expense', label: vi.charts.expense },
                ]}
              />
            </div>
          </div>
          <div className="h-[220px]" data-testid="trend-chart">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ top: 10, right: 16, bottom: 0, left: 0 }}>
                <CartesianGrid stroke="#ECEDF1" vertical={false} />
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  fontSize={11}
                  stroke="#6B7280"
                  interval={1}
                />
                <YAxis
                  width={40}
                  tickLine={false}
                  axisLine={false}
                  fontSize={11}
                  stroke="#646B78"
                  domain={[0, axis.max]}
                  ticks={axis.ticks}
                  tickFormatter={(v: number) =>
                    v >= 1_000_000 ? `${v / 1_000_000}tr` : v >= 1000 ? `${v / 1000}k` : String(v)
                  }
                />
                <Tooltip formatter={(v) => text(Number(v))} />
                <Line
                  type="linear"
                  dataKey="value"
                  stroke={color}
                  strokeWidth={2}
                  dot={{ r: 3.5, fill: color, stroke: color }}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="card overflow-hidden" aria-label={vi.trend.title}>
          <table className="w-full table-fixed text-[12px]" data-testid="trend-table">
            <thead>
              <tr className="bg-[#F7F8FA] text-muted">
                <th className="w-[25%] px-3 py-3 text-left font-medium">{vi.trend.colDate}</th>
                <th className="px-1 py-3 text-right font-medium">{vi.trend.colIncome}</th>
                <th className="px-1 py-3 text-right font-medium">{vi.trend.colExpense}</th>
                <th className="px-1 py-3 text-right font-medium">{vi.trend.colBalance}</th>
                <th className="w-6" />
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-divider font-bold" data-testid="row-year">
                <td className="px-3 py-3.5">{year}</td>
                <td className="px-1 text-right text-income">
                  <Money value={summary.year.income} />
                </td>
                <td className="px-1 text-right">
                  <Money value={summary.year.expense} expense />
                </td>
                <td className="px-1 text-right">
                  <Money value={summary.year.balance} />
                </td>
                <td />
              </tr>
              <tr className="border-t border-divider font-bold" data-testid="row-average">
                <td className="whitespace-nowrap px-3 py-3.5 text-[11px]">{vi.trend.monthly}</td>
                <td className="px-1 text-right text-income">
                  <Money value={summary.monthlyAverage.income} />
                </td>
                <td className="px-1 text-right">
                  <Money value={summary.monthlyAverage.expense} expense />
                </td>
                <td className="px-1 text-right">
                  <Money value={summary.monthlyAverage.balance} />
                </td>
                <td />
              </tr>
              {summary.months.map((m) => {
                const to = `/charts?m=${m.month.slice(0, 7)}`;
                const label = `thg ${parseDateStr(m.month).m} ${year}`;
                return (
                  <tr key={m.month} className="border-t border-divider" data-testid="row-month">
                    <td className="px-3 py-3.5">
                      <Link to={to} className="block whitespace-nowrap">
                        {label}
                      </Link>
                    </td>
                    <td className="px-1 text-right text-income">
                      <Money value={m.income} />
                    </td>
                    <td className="px-1 text-right">
                      <Money value={m.expense} expense />
                    </td>
                    <td className="px-1 text-right">
                      <Money value={m.balance} />
                    </td>
                    <td className="pr-1.5 text-muted">
                      <Link to={to} aria-label={label}>
                        <ChevronRight size={16} />
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      </div>
    </div>
  );
}

import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { ChevronRight } from 'lucide-react';
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
import { ScreenHeader } from '@/app/layouts';
import { useTransactionYears, useYearTransactions } from '@/db/hooks';
import type { TxType } from '@/db/types';
import { vi } from '@/i18n/vi';
import { parseDateStr, todayStr } from '@/lib/dates';
import { useGoBack } from '@/lib/nav';
import { yearSummary } from '@/lib/stats';

function balanceClass(v: number) {
  return v < 0 ? 'text-danger' : 'text-income';
}

export function TrendPage() {
  const goBack = useGoBack('/charts');
  const today = todayStr();
  const [year, setYear] = useState(parseDateStr(today).y);
  const [type, setType] = useState<TxType>('expense');
  const txsQ = useYearTransactions(year);
  const txs = useMemo(() => txsQ ?? [], [txsQ]);
  const years = useTransactionYears();
  const text = useAmountText();

  const summary = useMemo(() => yearSummary(txs, year, today), [txs, year, today]);
  const data = useMemo(
    () =>
      [...summary.months].reverse().map((m) => ({
        label: `${parseDateStr(m.month).m}`,
        value: type === 'expense' ? m.expense : m.income,
      })),
    [summary, type],
  );
  const color = type === 'expense' ? '#E53935' : '#2196F3';
  const yearOptions = years.includes(year) ? years : [year, ...years].sort((a, b) => b - a);

  return (
    <div className="flex h-full flex-col">
      <ScreenHeader
        title={vi.trend.title}
        onBack={goBack}
        right={
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            aria-label={vi.trend.pickYear}
            data-testid="year-select"
            className="tap rounded-lg bg-transparent text-sm font-semibold text-link"
          >
            {yearOptions.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        }
      />
      <div className="no-scrollbar min-h-0 flex-1 space-y-3 overflow-y-auto p-4 pb-10">
        <section className="card p-3">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="font-bold">{vi.trend.card}</h2>
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
          <div className="h-[220px]" data-testid="trend-chart">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ top: 10, right: 12, bottom: 0, left: 0 }}>
                <CartesianGrid stroke="#ECEDF1" vertical={false} />
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  fontSize={11}
                  stroke="#8A8F98"
                  interval={0}
                  tickFormatter={(l: string) => `thg ${l}`}
                />
                <YAxis
                  width={44}
                  tickLine={false}
                  axisLine={false}
                  fontSize={10}
                  stroke="#8A8F98"
                  tickFormatter={(v: number) =>
                    v >= 1_000_000
                      ? `${Math.round(v / 1_000_000)}M`
                      : v >= 1000
                        ? `${Math.round(v / 1000)}K`
                        : String(v)
                  }
                />
                <Tooltip
                  formatter={(v) => text(Number(v))}
                  labelFormatter={(l) => `thg ${String(l)}`}
                />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke={color}
                  strokeWidth={2}
                  dot={{ r: 3, fill: color }}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="card overflow-hidden text-sm" aria-label={vi.trend.title}>
          <table className="w-full table-fixed text-[12px]" data-testid="trend-table">
            <thead>
              <tr className="border-b border-divider text-xs text-muted">
                <th className="w-[19%] px-3 py-2 text-left font-medium">{vi.trend.colDate}</th>
                <th className="px-1 py-2 text-right font-medium">{vi.trend.colIncome}</th>
                <th className="px-1 py-2 text-right font-medium">{vi.trend.colExpense}</th>
                <th className="px-1 py-2 text-right font-medium">{vi.trend.colBalance}</th>
                <th className="w-5" />
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-divider font-semibold" data-testid="row-year">
                <td className="px-3 py-3">{year}</td>
                <td className="px-1 text-right text-income">
                  <Money value={summary.year.income} />
                </td>
                <td className="px-1 text-right">
                  <Money value={summary.year.expense} expense />
                </td>
                <td className={`px-1 text-right ${balanceClass(summary.year.balance)}`}>
                  <Money value={summary.year.balance} />
                </td>
                <td />
              </tr>
              <tr className="border-b border-divider" data-testid="row-average">
                <td className="whitespace-nowrap px-3 py-3 text-[11px] text-muted">
                  {vi.trend.monthly}
                </td>
                <td className="px-1 text-right text-income">
                  <Money value={summary.monthlyAverage.income} />
                </td>
                <td className="px-1 text-right">
                  <Money value={summary.monthlyAverage.expense} expense />
                </td>
                <td className={`px-1 text-right ${balanceClass(summary.monthlyAverage.balance)}`}>
                  <Money value={summary.monthlyAverage.balance} />
                </td>
                <td />
              </tr>
              {summary.months.map((m) => (
                <tr
                  key={m.month}
                  className="border-b border-divider last:border-b-0"
                  data-testid="row-month"
                >
                  <td className="px-3 py-3">
                    <Link
                      to={`/charts?m=${m.month.slice(0, 7)}`}
                      className="block"
                    >{`thg ${parseDateStr(m.month).m}`}</Link>
                  </td>
                  <td className="px-1 text-right text-income">
                    <Money value={m.income} />
                  </td>
                  <td className="px-1 text-right">
                    <Money value={m.expense} expense />
                  </td>
                  <td className={`px-1 text-right ${balanceClass(m.balance)}`}>
                    <Money value={m.balance} />
                  </td>
                  <td className="pr-1 text-muted">
                    <Link
                      to={`/charts?m=${m.month.slice(0, 7)}`}
                      aria-label={`thg ${parseDateStr(m.month).m}`}
                    >
                      <ChevronRight size={16} />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </div>
  );
}

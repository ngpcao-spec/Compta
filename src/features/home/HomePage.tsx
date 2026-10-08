import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { NotebookPen } from 'lucide-react';
import { useAllCategories, useBudgets, useMonthTransactions, useProfile } from '@/db/hooks';
import { BudgetSheet } from '@/features/budget/BudgetSheet';
import { vi } from '@/i18n/vi';
import { useMonthParam } from '@/lib/nav';
import { budgetStatus, groupByDay, resolveBudget, totals } from '@/lib/stats';
import { BudgetCard } from './BudgetCard';
import { HomeHeader } from './HomeHeader';
import { TxList } from './TxList';

export function HomePage() {
  const [month, setMonth] = useMonthParam();
  const navigate = useNavigate();
  const txs = useMonthTransactions(month);
  const categories = useAllCategories();
  const budgets = useBudgets();
  const profile = useProfile();
  const [sheet, setSheet] = useState(false);

  const { income, expense } = useMemo(() => totals(txs ?? []), [txs]);
  const groups = useMemo(() => groupByDay(txs ?? []), [txs]);
  const effective = useMemo(
    () => resolveBudget(month, budgets ?? [], profile?.default_budget ?? null),
    [month, budgets, profile?.default_budget],
  );
  const status = effective ? budgetStatus(effective.amount, expense) : null;

  return (
    <div>
      <HomeHeader month={month} onMonthChange={setMonth} income={income} expense={expense} />
      <BudgetCard status={status} onOpen={() => setSheet(true)} />
      {txs && groups.length === 0 ? (
        <div
          className="mt-10 flex flex-col items-center gap-3 px-8 text-center text-muted"
          data-testid="empty-state"
        >
          <NotebookPen size={56} strokeWidth={1.25} />
          <p>{vi.home.empty}</p>
          <button
            className="tap rounded-full bg-primary px-5 font-semibold text-white"
            onClick={() => void navigate('/tx/new')}
          >
            {vi.home.emptyAdd}
          </button>
        </div>
      ) : (
        <TxList groups={groups} categories={categories ?? []} />
      )}
      <BudgetSheet
        open={sheet}
        month={month}
        current={effective?.amount ?? 0}
        onClose={() => setSheet(false)}
      />
    </div>
  );
}

import { useState } from 'react';
import { AmountKeypad } from '@/components/AmountKeypad';
import { BottomSheet } from '@/components/BottomSheet';
import { useToast } from '@/components/Toast';
import { applyDefaultBudget, setMonthBudget } from '@/db/repo/budgets';
import { vi } from '@/i18n/vi';
import { formatMonthVi } from '@/lib/dates';
import { evaluate, formatExpr, hasOperator } from '@/lib/expr';
import { formatVnd } from '@/lib/money';

interface Props {
  open: boolean;
  month: string;
  /** budget effectif actuel (0 si aucun) */
  current: number;
  onClose: () => void;
}

function BudgetForm({ month, current, onClose }: Omit<Props, 'open'>) {
  const [expr, setExpr] = useState(current > 0 ? String(current) : '');
  const [future, setFuture] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();
  const preview = evaluate(expr === '' ? '0' : expr);

  const submit = async (value: number) => {
    try {
      if (future) await applyDefaultBudget(month, value);
      else await setMonthBudget(month, value);
      toast(vi.budget.saved);
      onClose();
    } catch {
      setError(vi.login.error);
    }
  };

  return (
    <>
      <div className="px-4 pb-2">
        <h2 className="text-lg font-bold">{vi.budget.title}</h2>
        <p className="text-sm text-muted">{formatMonthVi(month)}</p>
        <p className="mt-3 text-4xl font-bold text-link" data-testid="budget-amount">
          {expr === '' ? '0' : formatExpr(expr)}
        </p>
        {hasOperator(expr) && preview.ok && (
          <p className="text-sm text-muted">= {formatVnd(preview.value)}</p>
        )}
        <p className="mt-1 text-xs text-muted">{vi.budget.zeroHint}</p>
        <label className="mt-3 flex items-center gap-3 text-sm">
          <input
            type="checkbox"
            className="h-5 w-5 accent-[var(--primary)]"
            checked={future}
            onChange={(e) => setFuture(e.target.checked)}
          />
          {vi.budget.applyFuture}
        </label>
        {error && (
          <p role="alert" className="mt-2 text-sm text-danger">
            {error}
          </p>
        )}
      </div>
      <AmountKeypad
        expr={expr}
        onExprChange={setExpr}
        onSubmit={(v) => void submit(v)}
        onError={setError}
      />
    </>
  );
}

/** Feuille « Chỉnh sửa ngân sách » (SPEC §3.4). Le formulaire est monté à l'ouverture seulement. */
export function BudgetSheet({ open, month, current, onClose }: Props) {
  return (
    <BottomSheet open={open} onClose={onClose} title={vi.budget.title}>
      <BudgetForm month={month} current={current} onClose={onClose} />
    </BottomSheet>
  );
}

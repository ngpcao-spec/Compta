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
  const operator = hasOperator(expr);

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
    <div className="flex flex-col gap-3.5 px-4 pb-2">
      <div className="flex items-center">
        <button
          className="tap min-w-[60px] text-left text-[15px] font-medium text-primary"
          onClick={onClose}
        >
          {vi.common.cancel}
        </button>
        <div className="flex flex-1 flex-col items-center gap-0.5">
          <h2 className="text-lg font-bold">{vi.budget.title}</h2>
          <span className="text-[13px] text-muted">{formatMonthVi(month)}</span>
        </div>
        <span className="min-w-[60px]" />
      </div>

      <div className="pt-3 text-center">
        <p
          className="text-[44px] font-bold leading-tight tracking-[-0.5px] text-primary"
          data-testid="budget-amount"
        >
          {operator && preview.ok ? formatVnd(preview.value) : expr === '' ? '0' : formatExpr(expr)}
        </p>
        {operator && (
          <p className="text-sm text-muted">{formatExpr(expr).replace(/([+−×÷])/g, ' $1 ')}</p>
        )}
        <p className="mt-1 text-xs text-muted">{vi.budget.zeroHint}</p>
      </div>

      <label className="flex items-center gap-2.5 rounded-xl bg-bg px-3.5 py-3 text-sm">
        <input
          type="checkbox"
          className="h-5 w-5 accent-[var(--primary)]"
          checked={future}
          onChange={(e) => setFuture(e.target.checked)}
        />
        <span>{vi.budget.applyFuture}</span>
      </label>
      {error && (
        <p role="alert" className="text-sm text-danger-ink">
          {error}
        </p>
      )}
      <AmountKeypad
        expr={expr}
        onExprChange={setExpr}
        onSubmit={(v) => void submit(v)}
        onError={setError}
      />
    </div>
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

import { ChevronDown } from 'lucide-react';
import { Money } from '@/components/Money';
import { vi } from '@/i18n/vi';
import type { BudgetStatus } from '@/lib/stats';

interface Props {
  status: BudgetStatus | null;
  onOpen: () => void;
}

/** Carte budget qui chevauche l'en-tête. */
export function BudgetCard({ status, onOpen }: Props) {
  if (!status) {
    return (
      <section className="card relative z-10 mx-4 -mt-11 flex items-center justify-between p-4">
        <p className="mr-3 text-sm text-muted">{vi.home.setBudgetHint}</p>
        <button
          className="tap shrink-0 rounded-full bg-primary px-4 text-sm font-semibold text-white"
          onClick={onOpen}
          data-testid="set-budget"
        >
          {vi.home.setBudget}
        </button>
      </section>
    );
  }
  return (
    <button
      className="card relative z-10 mx-4 -mt-11 flex w-[calc(100%-32px)] flex-col gap-2.5 p-4 text-left"
      onClick={onOpen}
      data-testid="budget-card"
    >
      <div className="flex items-center gap-1 text-[15px] font-bold">
        <span>
          {vi.home.budget}: <Money value={status.amount} />
        </span>
        <ChevronDown size={16} className="text-muted" />
      </div>
      <div
        className="h-2 overflow-hidden rounded-full bg-[#E9EBF0]"
        role="progressbar"
        aria-label={vi.home.budget}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(status.ratio * 100)}
      >
        <div
          className={`h-full rounded-full transition-[width] duration-200 ${status.over ? 'bg-danger' : 'bg-primary'}`}
          style={{ width: `${status.ratio * 100}%` }}
        />
      </div>
      <div className="text-[13px] font-semibold">
        {vi.home.remaining}:{' '}
        <Money
          value={status.remaining}
          className={status.remaining < 0 ? 'text-danger-ink' : undefined}
        />
      </div>
    </button>
  );
}

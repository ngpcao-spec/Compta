import { useState } from 'react';
import { useNavigate } from 'react-router';
import { ChevronDown, ChevronLeft, ChevronRight, Eye, EyeOff, Ellipsis } from 'lucide-react';
import { MonthPicker } from '@/components/MonthPicker';
import { Money } from '@/components/Money';
import { useToast } from '@/components/Toast';
import { useHideAmounts } from '@/db/hooks';
import { setHideAmounts } from '@/db/repo/profile';
import { vi } from '@/i18n/vi';
import { addMonths, formatMonthVi } from '@/lib/dates';
import { exportCsv } from '@/features/more/exportCsv';

interface Props {
  month: string;
  onMonthChange: (m: string) => void;
  income: number;
  expense: number;
}

export function HomeHeader({ month, onMonthChange, income, expense }: Props) {
  const hidden = useHideAmounts();
  const navigate = useNavigate();
  const toast = useToast();
  const [picker, setPicker] = useState(false);
  const [menu, setMenu] = useState(false);
  const balance = income - expense;

  return (
    <header className="bg-gradient-to-b from-primary to-primary-dark px-4 pb-14 pt-[calc(var(--safe-top)+12px)] text-white">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          <button
            className="tap flex items-center gap-1 rounded-full bg-white/20 px-3 text-sm font-semibold"
            onClick={() => setPicker(true)}
            data-testid="month-pill"
          >
            {formatMonthVi(month)}
            <ChevronDown size={16} />
          </button>
          <button
            className="tap flex items-center justify-center"
            aria-label={vi.home.prevMonth}
            onClick={() => onMonthChange(addMonths(month, -1))}
          >
            <ChevronLeft size={20} />
          </button>
          <button
            className="tap flex items-center justify-center"
            aria-label={vi.home.nextMonth}
            onClick={() => onMonthChange(addMonths(month, 1))}
          >
            <ChevronRight size={20} />
          </button>
        </div>
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
              className="absolute right-0 z-20 w-44 overflow-hidden rounded-xl bg-white text-ink shadow-lg"
              role="menu"
            >
              <button
                role="menuitem"
                className="tap w-full px-4 py-3 text-left text-sm"
                onClick={() => {
                  setMenu(false);
                  void navigate('/more/categories');
                }}
              >
                {vi.home.categories}
              </button>
              <button
                role="menuitem"
                className="tap w-full px-4 py-3 text-left text-sm"
                onClick={async () => {
                  setMenu(false);
                  if (!(await exportCsv())) toast(vi.more.csvEmpty);
                }}
              >
                {vi.home.exportCsv}
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="mt-4 flex items-center gap-2 text-sm opacity-90">
        {vi.home.balance}
        <button
          className="tap flex items-center justify-center"
          aria-label={vi.home.toggleHide}
          onClick={() => void setHideAmounts(!hidden)}
          data-testid="toggle-hide"
        >
          {hidden ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>
      <Money value={balance} className="block text-[40px] font-bold leading-tight" />
      <div className="mt-3 flex gap-8">
        <div>
          <div className="text-xs opacity-90">{vi.home.expense}</div>
          <Money value={expense} className="text-2xl font-bold" />
        </div>
        <div>
          <div className="text-xs opacity-90">{vi.home.income}</div>
          <Money value={income} className="text-2xl font-bold" />
        </div>
      </div>
      <MonthPicker
        open={picker}
        value={month}
        onClose={() => setPicker(false)}
        onPick={onMonthChange}
      />
    </header>
  );
}

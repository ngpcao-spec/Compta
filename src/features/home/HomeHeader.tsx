import { useState } from 'react';
import { useNavigate } from 'react-router';
import { ChevronLeft, ChevronRight, Ellipsis, Eye, EyeOff } from 'lucide-react';
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

const circle = 'flex h-9 w-9 items-center justify-center rounded-full bg-black/[0.14] text-white';

export function HomeHeader({ month, onMonthChange, income, expense }: Props) {
  const hidden = useHideAmounts();
  const navigate = useNavigate();
  const toast = useToast();
  const [picker, setPicker] = useState(false);
  const [menu, setMenu] = useState(false);
  const balance = income - expense;

  return (
    <header className="bg-primary px-4 pb-16 pt-[calc(var(--safe-top)+20px)] text-white">
      <div className="mb-3.5 flex items-center gap-2">
        <button
          className="h-9 rounded-full bg-black/[0.14] px-3.5 text-[15px] font-semibold"
          onClick={() => setPicker(true)}
          data-testid="month-pill"
        >
          {formatMonthVi(month)}
        </button>
        <button
          className={circle}
          aria-label={vi.home.prevMonth}
          onClick={() => onMonthChange(addMonths(month, -1))}
        >
          <ChevronLeft size={18} strokeWidth={2.2} />
        </button>
        <button
          className={circle}
          aria-label={vi.home.nextMonth}
          onClick={() => onMonthChange(addMonths(month, 1))}
        >
          <ChevronRight size={18} strokeWidth={2.2} />
        </button>
        <div className="relative ml-auto">
          <button className={circle} aria-label={vi.common.menu} onClick={() => setMenu((v) => !v)}>
            <Ellipsis size={18} strokeWidth={2.6} />
          </button>
          {menu && (
            <div
              className="absolute right-0 top-11 z-20 w-44 overflow-hidden rounded-xl bg-white text-ink shadow-lg"
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

      <div className="flex items-center gap-1.5 text-sm font-medium">
        {vi.home.balance}
        <button
          className="flex h-7 w-7 items-center justify-center rounded-full bg-black/[0.14]"
          aria-label={vi.home.toggleHide}
          onClick={() => void setHideAmounts(!hidden)}
          data-testid="toggle-hide"
        >
          {hidden ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
      <Money
        value={balance}
        className="mt-1 block text-[40px] font-bold leading-[1.15] tracking-[-0.5px]"
      />
      <div className="mt-2.5 grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-0.5">
          <span className="text-[13px] font-medium">{vi.home.expense}</span>
          <Money value={expense} expense className="text-[22px] font-bold" />
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-[13px] font-medium">{vi.home.income}</span>
          <Money value={income} className="text-[22px] font-bold" />
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

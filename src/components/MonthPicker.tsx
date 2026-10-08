import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { monthOf, parseDateStr } from '@/lib/dates';
import { vi } from '@/i18n/vi';
import { BottomSheet } from './BottomSheet';

interface Props {
  open: boolean;
  value: string;
  onClose: () => void;
  onPick: (month: string) => void;
}

/** Sélecteur mois / année. */
export function MonthPicker({ open, value, onClose, onPick }: Props) {
  const cur = parseDateStr(value);
  const [year, setYear] = useState(cur.y);
  return (
    <BottomSheet open={open} onClose={onClose} title={vi.home.pickMonth}>
      <div className="px-4 pb-4">
        <div className="flex items-center justify-between">
          <button className="tap" aria-label={vi.home.prevMonth} onClick={() => setYear(year - 1)}>
            <ChevronLeft />
          </button>
          <span className="text-lg font-bold" data-testid="picker-year">
            {year}
          </span>
          <button className="tap" aria-label={vi.home.nextMonth} onClick={() => setYear(year + 1)}>
            <ChevronRight />
          </button>
        </div>
        <div className="mt-3 grid grid-cols-4 gap-2">
          {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => {
            const active = year === cur.y && m === cur.m;
            return (
              <button
                key={m}
                onClick={() => {
                  onPick(monthOf(year, m));
                  onClose();
                }}
                className={`tap rounded-xl py-3 text-sm font-semibold ${active ? 'bg-primary text-white' : 'bg-bg'}`}
              >
                {`thg ${m}`}
              </button>
            );
          })}
        </div>
      </div>
    </BottomSheet>
  );
}

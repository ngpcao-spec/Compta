import { NavLink } from 'react-router';
import { Book, ChartPie, LayoutGrid, Plus } from 'lucide-react';
import { vi } from '@/i18n/vi';

const item = ({ isActive }: { isActive: boolean }) =>
  `tap flex flex-col items-center justify-center gap-[3px] text-[11px] ${isActive ? 'font-semibold text-primary' : 'font-medium text-muted'}`;

/** Barre d'onglets fixe ; le bouton central « + » ouvre la saisie. */
export function TabBar() {
  return (
    <nav
      aria-label="Điều hướng"
      className="fixed bottom-0 left-1/2 z-40 grid w-full max-w-[480px] -translate-x-1/2 grid-cols-4 items-center border-t border-[#E4E6EB] bg-white px-2 pt-2 pb-[max(var(--safe-bottom),10px)]"
      style={{ minHeight: 'calc(var(--tabbar-h) + var(--safe-bottom))' }}
    >
      <NavLink to="/" end className={item}>
        <Book size={22} />
        {vi.tabs.home}
      </NavLink>
      <NavLink to="/charts" className={item}>
        <ChartPie size={22} />
        {vi.tabs.charts}
      </NavLink>
      <NavLink
        to="/tx/new"
        aria-label={vi.tabs.add}
        data-testid="add-tx"
        className="-mt-[30px] flex h-14 w-14 items-center justify-center justify-self-center rounded-full bg-primary text-white shadow-[0_6px_16px_rgb(26_110_216/0.35)] active:bg-primary-dark"
      >
        <Plus size={26} strokeWidth={2.4} />
      </NavLink>
      <NavLink to="/more" className={item}>
        <LayoutGrid size={22} />
        {vi.tabs.more}
      </NavLink>
    </nav>
  );
}

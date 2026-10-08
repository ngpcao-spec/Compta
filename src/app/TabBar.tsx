import { NavLink } from 'react-router';
import { BarChart3, BookOpen, Ellipsis, Plus } from 'lucide-react';
import { vi } from '@/i18n/vi';

const item = ({ isActive }: { isActive: boolean }) =>
  `tap flex flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-medium ${isActive ? 'text-link' : 'text-muted'}`;

/** Barre d'onglets fixe ; le bouton central « + » ouvre la saisie. */
export function TabBar() {
  return (
    <nav
      aria-label="Điều hướng"
      className="fixed bottom-0 left-1/2 z-40 flex w-full max-w-[480px] -translate-x-1/2 items-stretch border-t border-divider bg-white pb-[var(--safe-bottom)]"
      style={{ height: 'calc(var(--tabbar-h) + var(--safe-bottom))' }}
    >
      <NavLink to="/" end className={item}>
        <BookOpen size={22} />
        {vi.tabs.home}
      </NavLink>
      <NavLink to="/charts" className={item}>
        <BarChart3 size={22} />
        {vi.tabs.charts}
      </NavLink>
      <div className="flex flex-1 items-center justify-center">
        <NavLink
          to="/tx/new"
          aria-label={vi.tabs.add}
          data-testid="add-tx"
          className="-mt-6 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-white shadow-lg active:bg-primary-dark"
        >
          <Plus size={30} />
        </NavLink>
      </div>
      <NavLink to="/more" className={item}>
        <Ellipsis size={22} />
        {vi.tabs.more}
      </NavLink>
    </nav>
  );
}

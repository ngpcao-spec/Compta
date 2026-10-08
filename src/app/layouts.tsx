import { Outlet } from 'react-router';
import { ChevronLeft } from 'lucide-react';
import { vi } from '@/i18n/vi';
import { AuthProvider } from '@/features/auth/AuthProvider';
import { PwaBanners } from '@/features/pwa/PwaBanners';
import { ToastProvider } from '@/components/Toast';
import { TabBar } from './TabBar';

/** Racine : fournisseurs globaux et bandeaux, colonne centrée de 480 px max. */
export function RootLayout() {
  return (
    <AuthProvider>
      <ToastProvider>
        <div className="mx-auto flex h-full w-full max-w-[480px] flex-col bg-bg shadow-[0_0_0_1px_rgb(0_0_0/0.04)]">
          <PwaBanners />
          <div className="relative min-h-0 flex-1">
            <Outlet />
          </div>
        </div>
      </ToastProvider>
    </AuthProvider>
  );
}

/** Écrans à onglets : contenu défilant au-dessus de la barre. */
export function TabLayout() {
  return (
    <>
      <div
        className="no-scrollbar h-full overflow-y-auto"
        style={{ paddingBottom: 'calc(var(--tabbar-h) + var(--safe-bottom) + 24px)' }}
      >
        <Outlet />
      </div>
      <TabBar />
    </>
  );
}

/** Écrans plein écran (saisie, catégories, tendance). */
export function ScreenHeader({
  title,
  onBack,
  right,
}: {
  title: string;
  onBack: () => void;
  right?: React.ReactNode;
}) {
  return (
    <header
      className="flex items-center justify-between bg-white px-2 pt-[var(--safe-top)]"
      style={{ minHeight: 56 }}
    >
      <button
        className="tap flex items-center px-2 text-link"
        onClick={onBack}
        aria-label={vi.common.back}
      >
        <ChevronLeft size={26} />
      </button>
      <h1 className="text-base font-bold">{title}</h1>
      <div className="flex min-w-[44px] justify-end">{right}</div>
    </header>
  );
}

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
        style={{ paddingBottom: 'calc(var(--tabbar-h) + var(--safe-bottom) + 36px)' }}
      >
        <Outlet />
      </div>
      <TabBar />
    </>
  );
}

interface BarProps {
  title: string;
  /** libellé texte à gauche (« Hủy ») ou, à défaut, une flèche de retour */
  leftLabel?: string;
  onLeft: () => void;
  right?: React.ReactNode;
  children?: React.ReactNode;
}

/** En-tête blanc des écrans plein écran : « Hủy » / titre centré / action à droite, contenu optionnel dessous. */
export function ModalHeader({ title, leftLabel, onLeft, right, children }: BarProps) {
  return (
    <header className="border-b border-divider bg-white px-4 pb-3 pt-[calc(var(--safe-top)+14px)]">
      <div className="flex h-8 items-center">
        <button
          className="tap -ml-1 flex min-w-16 items-center text-left text-base font-medium text-primary"
          onClick={onLeft}
          aria-label={leftLabel ?? vi.common.back}
        >
          {leftLabel ?? <ChevronLeft size={26} />}
        </button>
        <h1 className="flex-1 text-center text-[17px] font-bold">{title}</h1>
        <div className="flex min-w-16 items-center justify-end">{right}</div>
      </div>
      {children && <div className="mt-3.5">{children}</div>}
    </header>
  );
}

/** En-tête simple (titre centré) des écrans à onglets. */
export function TabHeader({ title, right }: { title: string; right?: React.ReactNode }) {
  return (
    <header
      className="relative z-30 flex items-center justify-center bg-white px-4 pt-[var(--safe-top)] shadow-[0_1px_0_var(--divider)]"
      style={{ minHeight: 52 }}
    >
      <h1 className="text-[17px] font-bold">{title}</h1>
      {right && <div className="absolute right-3 top-1/2 -translate-y-1/2">{right}</div>}
    </header>
  );
}

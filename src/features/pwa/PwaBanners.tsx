import { useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { vi } from '@/i18n/vi';
import { useAuth } from '@/features/auth/AuthProvider';
import { useSyncStatus } from '@/sync/status';
import { isIos, isStandalone } from './install';

const IOS_HINT_KEY = 'stc.iosHintShown';

function Banner({
  children,
  tone = 'info',
}: {
  children: React.ReactNode;
  tone?: 'info' | 'warn';
}) {
  return (
    <div
      role="status"
      className={`flex items-center justify-between gap-3 px-4 py-2 text-sm text-white ${tone === 'warn' ? 'bg-danger' : 'bg-[#1F2329]'}`}
    >
      {children}
    </div>
  );
}

/** Bandeaux globaux : nouvelle version, session expirée, aide d'installation iOS. */
export function PwaBanners() {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW();
  const { authExpired } = useSyncStatus();
  const { signInWithGoogle } = useAuth();
  const [iosHint, setIosHint] = useState(() => {
    try {
      return isIos() && !isStandalone() && localStorage.getItem(IOS_HINT_KEY) !== '1';
    } catch {
      return false;
    }
  });

  return (
    <>
      {needRefresh && (
        <Banner>
          <span>{vi.pwa.newVersion}</span>
          <button
            className="tap font-bold underline"
            onClick={() => void updateServiceWorker(true)}
          >
            {vi.pwa.update}
          </button>
        </Banner>
      )}
      {authExpired && (
        <Banner tone="warn">
          <span>{vi.sync.sessionExpired}</span>
          {/* Nouvelle connexion OAuth sans vider la base : les lignes en attente restent. */}
          <button className="tap font-bold underline" onClick={() => void signInWithGoogle()}>
            {vi.sync.signInAgain}
          </button>
        </Banner>
      )}
      {iosHint && (
        <Banner>
          <span>{vi.pwa.iosHint}</span>
          <button
            className="tap font-bold underline"
            onClick={() => {
              try {
                localStorage.setItem(IOS_HINT_KEY, '1');
              } catch {
                /* ignore */
              }
              setIosHint(false);
            }}
          >
            {vi.pwa.dismiss}
          </button>
        </Banner>
      )}
    </>
  );
}

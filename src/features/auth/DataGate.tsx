import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { db } from '@/db/local';
import { vi } from '@/i18n/vi';
import { getEngine, resetEngine } from '@/sync/runtime';
import { useUser } from './AuthProvider';

type Phase = 'booting' | 'ready' | 'failed';

/**
 * Prépare la base locale pour l'utilisateur connecté : vide les données d'un autre compte,
 * fait le pull complet du premier lancement (écran de chargement), puis démarre la synchro.
 */
export function DataGate({ children }: { children: ReactNode }) {
  const user = useUser();
  const [phase, setPhase] = useState<Phase>('booting');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setPhase('booting');
      const previous = await db.getMeta('userId');
      if (previous && previous !== user.id) {
        resetEngine();
        await db.wipe();
      }
      await db.setMeta('userId', user.id);
      const engine = await getEngine({ id: user.id, name: user.name });
      if ((await db.getMeta('initialSyncDone')) !== '1') {
        const outcome = await engine.initialPull();
        if (outcome !== 'ok') {
          if (!cancelled) setPhase('failed');
          return;
        }
        await db.setMeta('initialSyncDone', '1');
      }
      if (cancelled) return;
      engine.start();
      setPhase('ready');
    })().catch(() => !cancelled && setPhase('failed'));
    return () => {
      cancelled = true;
    };
  }, [user.id, user.name, attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  if (phase === 'ready') return <>{children}</>;
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center">
      {phase === 'booting' ? (
        <>
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-muted">{vi.login.firstSync}</p>
        </>
      ) : (
        <>
          <p className="text-muted">{vi.login.error}</p>
          <button
            className="tap rounded-full bg-primary px-6 font-semibold text-white"
            onClick={retry}
          >
            {vi.common.retry}
          </button>
        </>
      )}
    </div>
  );
}

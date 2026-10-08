import { useCallback } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router';
import { monthStart, todayStr } from './dates';

/** Retour à l'écran précédent, ou `fallback` si l'écran a été ouvert directement. */
export function useGoBack(fallback = '/'): () => void {
  const navigate = useNavigate();
  const { key } = useLocation();
  return useCallback(() => {
    if (key !== 'default') void navigate(-1);
    else void navigate(fallback, { replace: true });
  }, [navigate, key, fallback]);
}

/** Mois affiché, porté par `?m=YYYY-MM` (défaut : mois courant). */
export function useMonthParam(): [string, (month: string) => void] {
  const [params, setParams] = useSearchParams();
  const raw = params.get('m');
  const month = raw && /^\d{4}-\d{2}$/.test(raw) ? `${raw}-01` : monthStart(todayStr());
  const set = useCallback(
    (m: string) => setParams({ m: m.slice(0, 7) }, { replace: true }),
    [setParams],
  );
  return [month, set];
}

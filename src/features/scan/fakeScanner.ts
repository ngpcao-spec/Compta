import { readJpegInfo } from './image';
import type { InvokeResult, ScanPayload } from './scanReceipt';

/**
 * Fonction simulée pour les e2e (VITE_E2E=1) : le test pose sa réponse dans
 * `localStorage['stc.e2e.scan']`, p. ex. {"kind":"ok","amount":250000,"categoryName":"Ăn uống",...}.
 */
export async function fakeScan(payload: ScanPayload, signal: AbortSignal): Promise<InvokeResult> {
  const cfg = JSON.parse(localStorage.getItem('stc.e2e.scan') ?? '{"kind":"error"}') as {
    kind: 'ok' | 'error' | 'quota';
    delayMs?: number;
    amount?: number;
    date?: string | null;
    categoryName?: string;
    merchant?: string | null;
    confidence?: number;
  };
  await new Promise<void>((resolve, reject) => {
    const t = setTimeout(resolve, cfg.delayMs ?? 50);
    signal.addEventListener('abort', () => {
      clearTimeout(t);
      reject(new DOMException('annulé', 'AbortError'));
    });
  });
  // le test relit les dimensions de l'image réellement envoyée (compression, orientation)
  const bin = atob(payload.image_base64.slice(0, 200_000));
  const head = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  const info = readJpegInfo(head);
  localStorage.setItem(
    'stc.e2e.scan.last',
    JSON.stringify({ width: info?.width ?? 0, height: info?.height ?? 0 }),
  );
  if (cfg.kind === 'quota') return { ok: false, error: 'quota_exceeded' };
  if (cfg.kind === 'error') return { ok: false, error: 'upstream_error' };
  const cat = payload.categories.find((c) => c.name === cfg.categoryName) ?? payload.categories[0];
  return {
    ok: true,
    result: {
      amount: cfg.amount ?? 0,
      date: cfg.date ?? null,
      category_id: cat?.id ?? '',
      merchant: cfg.merchant ?? null,
      confidence: cfg.confidence ?? 0.9,
    },
  };
}

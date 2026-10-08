import { blobToBase64, compressImage } from './image';
import { interpretScan, type Interpretation, type Prefill } from './normalize';
import type { CategoryRef } from '../../../supabase/functions/scan-receipt/validate';

export interface ScanPayload {
  image_base64: string;
  mime: 'image/jpeg';
  categories: CategoryRef[];
}

export type InvokeResult = { ok: true; result: unknown } | { ok: false; error: string };

export interface ScanDeps {
  compress(file: Blob): Promise<Blob>;
  toBase64(blob: Blob): Promise<string>;
  invoke(payload: ScanPayload, signal: AbortSignal): Promise<InvokeResult>;
}

export type ScanOutcome =
  | Interpretation
  | { kind: 'failed'; reason: 'quota' | 'failed'; prefill: Prefill }
  /** la photo elle-même est illisible (format, taille) : rien n'a été envoyé */
  | { kind: 'image_error' }
  | { kind: 'cancelled' };

export const defaultScanDeps = (invoke: ScanDeps['invoke']): ScanDeps => ({
  compress: async (file) => (await compressImage(file)).blob,
  toBase64: blobToBase64,
  invoke,
});

/**
 * Photo → (compression) → fonction serveur → interprétation. La photo n'existe qu'en mémoire,
 * pendant cet appel : ni stockage ni journal. Annulable par `signal`.
 */
export async function scanReceipt(
  file: Blob,
  categories: readonly CategoryRef[],
  today: string,
  signal: AbortSignal,
  deps: ScanDeps,
): Promise<ScanOutcome> {
  const empty: Prefill = { date: today, note: '' };
  let image_base64: string;
  try {
    image_base64 = await deps.toBase64(await deps.compress(file));
  } catch {
    return signal.aborted ? { kind: 'cancelled' } : { kind: 'image_error' };
  }
  if (signal.aborted) return { kind: 'cancelled' };
  try {
    const res = await deps.invoke(
      { image_base64, mime: 'image/jpeg', categories: [...categories] },
      signal,
    );
    if (signal.aborted) return { kind: 'cancelled' };
    if (!res.ok) {
      return {
        kind: 'failed',
        reason: res.error === 'quota_exceeded' ? 'quota' : 'failed',
        prefill: empty,
      };
    }
    return interpretScan(res.result, categories, today);
  } catch {
    if (signal.aborted) return { kind: 'cancelled' };
    return { kind: 'failed', reason: 'failed', prefill: empty };
  }
}

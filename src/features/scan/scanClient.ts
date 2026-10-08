import { FunctionsHttpError } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import type { InvokeResult, ScanPayload } from './scanReceipt';

const TIMEOUT_MS = 60_000;

/** Appelle l'Edge Function `scan-receipt` (la clé OpenAI reste côté serveur). */
export async function invokeScan(payload: ScanPayload, signal: AbortSignal): Promise<InvokeResult> {
  // Test uniquement : `VITE_E2E` est absent des builds de production, la branche est éliminée.
  if (import.meta.env.VITE_E2E === '1') {
    const { fakeScan } = await import('./fakeScanner');
    return fakeScan(payload, signal);
  }
  const timeout = AbortSignal.timeout(TIMEOUT_MS);
  const { data, error } = await supabase.functions.invoke<{ ok?: boolean; result?: unknown }>(
    'scan-receipt',
    {
      body: payload,
      signal: AbortSignal.any([signal, timeout]),
    },
  );
  if (error) {
    let code = 'failed';
    if (error instanceof FunctionsHttpError) {
      try {
        const body = (await error.context.json()) as { error?: string };
        if (typeof body.error === 'string') code = body.error;
      } catch {
        /* corps illisible : erreur générique */
      }
    }
    return { ok: false, error: code };
  }
  return data?.ok ? { ok: true, result: data.result } : { ok: false, error: 'failed' };
}

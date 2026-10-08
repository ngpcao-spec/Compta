import { describe, expect, it, vi } from 'vitest';
import { scanReceipt, type InvokeResult, type ScanDeps } from './scanReceipt';

const cats = [
  { id: 'c-an', name: 'Ăn uống', type: 'expense' as const },
  { id: 'c-khac', name: 'Khác', type: 'expense' as const },
];
const TODAY = '2026-10-08';
const ok = {
  doc_kind: 'invoice',
  tx_type: 'expense',
  amount: 250000,
  date: '2026-10-07',
  category_id: 'c-an',
  merchant: 'Phở 24',
  confidence: 0.9,
};

function deps(invoke: ScanDeps['invoke']): ScanDeps & { invoke: ReturnType<typeof vi.fn> } {
  return {
    compress: async (f) => f,
    toBase64: async () => 'QUJD',
    invoke: vi.fn(invoke),
  } as ScanDeps & { invoke: ReturnType<typeof vi.fn> };
}

describe('scanReceipt', () => {
  it('envoie l’image compressée en base64 et les catégories, puis interprète la réponse', async () => {
    const d = deps(async () => ({ ok: true, result: ok }) as InvokeResult);
    const out = await scanReceipt(new Blob(['x']), cats, TODAY, new AbortController().signal, d);
    expect(d.invoke).toHaveBeenCalledWith(
      { image_base64: 'QUJD', mime: 'image/jpeg', categories: cats },
      expect.any(AbortSignal),
    );
    expect(out).toMatchObject({
      kind: 'ready',
      draft: { amount: 250000, categoryId: 'c-an', note: 'Phở 24' },
    });
  });

  it('échec de la fonction → saisie manuelle (reason failed)', async () => {
    const d = deps(async () => ({ ok: false, error: 'upstream_error' }));
    const out = await scanReceipt(new Blob(['x']), cats, TODAY, new AbortController().signal, d);
    expect(out).toEqual({ kind: 'failed', reason: 'failed', prefill: { date: TODAY, note: '' } });
  });

  it('quota dépassé → reason quota', async () => {
    const d = deps(async () => ({ ok: false, error: 'quota_exceeded' }));
    const out = await scanReceipt(new Blob(['x']), cats, TODAY, new AbortController().signal, d);
    expect(out).toMatchObject({ kind: 'failed', reason: 'quota' });
  });

  it('exception (réseau, compression) → saisie manuelle', async () => {
    const d = deps(async () => {
      throw new Error('réseau');
    });
    const out = await scanReceipt(new Blob(['x']), cats, TODAY, new AbortController().signal, d);
    expect(out).toMatchObject({ kind: 'failed', reason: 'failed' });
    const broken: ScanDeps = {
      ...d,
      compress: async () => {
        throw new Error('canvas');
      },
    };
    // image illisible (HEIC non décodable, fichier corrompu…) : message dédié, pas de saisie manuelle
    expect(
      await scanReceipt(new Blob(['x']), cats, TODAY, new AbortController().signal, broken),
    ).toEqual({ kind: 'image_error' });
  });

  it('image illisible + annulation → cancelled', async () => {
    const ctrl = new AbortController();
    const broken: ScanDeps = {
      ...deps(async () => ({ ok: false, error: 'upstream_error' })),
      compress: async () => {
        ctrl.abort();
        throw new Error('canvas');
      },
    };
    expect(await scanReceipt(new Blob(['x']), cats, TODAY, ctrl.signal, broken)).toEqual({
      kind: 'cancelled',
    });
  });

  it('annulation : aucun résultat n’est exploité', async () => {
    const ctrl = new AbortController();
    const d = deps(async () => {
      ctrl.abort();
      return { ok: true, result: ok } as InvokeResult;
    });
    expect(await scanReceipt(new Blob(['x']), cats, TODAY, ctrl.signal, d)).toEqual({
      kind: 'cancelled',
    });
    const aborted = deps(async () => {
      throw new DOMException('annulé', 'AbortError');
    });
    const c2 = new AbortController();
    c2.abort();
    expect(await scanReceipt(new Blob(['x']), cats, TODAY, c2.signal, aborted)).toEqual({
      kind: 'cancelled',
    });
  });

  it('confiance faible → saisie manuelle pré-remplie, pas d’enregistrement', async () => {
    const d = deps(async () => ({ ok: true, result: { ...ok, confidence: 0.3 } }));
    const out = await scanReceipt(new Blob(['x']), cats, TODAY, new AbortController().signal, d);
    expect(out).toMatchObject({ kind: 'manual', prefill: { amount: 250000, categoryId: 'c-an' } });
  });
});

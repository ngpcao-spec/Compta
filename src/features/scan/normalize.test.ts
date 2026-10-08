import { describe, expect, it } from 'vitest';
import { interpretScan } from './normalize';

const cats = [
  { id: 'c-an', name: 'Ăn uống' },
  { id: 'c-cf', name: 'Cà phê' },
  { id: 'c-khac', name: 'Khác' },
];
const TODAY = '2026-10-08';
const raw = (over: Record<string, unknown> = {}) => ({
  amount: 250000,
  date: '2026-10-05',
  category_id: 'c-an',
  merchant: 'Highlands Coffee',
  confidence: 0.9,
  ...over,
});

describe('interpretScan', () => {
  it('réponse fiable → prête à enregistrer (marchand en note)', () => {
    expect(interpretScan(raw(), cats, TODAY)).toEqual({
      kind: 'ready',
      draft: {
        amount: 250000,
        date: '2026-10-05',
        categoryId: 'c-an',
        note: 'Highlands Coffee',
        confidence: 0.9,
      },
    });
  });

  it('date null, future ou trop ancienne → aujourd’hui', () => {
    for (const date of [null, '2027-01-01', '2020-01-01', 'n’importe quoi']) {
      const r = interpretScan(raw({ date }), cats, TODAY);
      expect(r.kind === 'ready' && r.draft.date).toBe(TODAY);
    }
  });

  it('marchand absent → note vide ; marchand trop long → 100 caractères', () => {
    const none = interpretScan(raw({ merchant: null }), cats, TODAY);
    expect(none.kind === 'ready' && none.draft.note).toBe('');
    const long = interpretScan(raw({ merchant: 'M'.repeat(250) }), cats, TODAY);
    expect(long.kind === 'ready' && long.draft.note).toHaveLength(100);
  });

  it('catégorie inconnue (ou archivée côté client) → Khác', () => {
    const r = interpretScan(raw({ category_id: 'archivée' }), cats, TODAY);
    expect(r.kind === 'ready' && r.draft.categoryId).toBe('c-khac');
  });

  it('confiance < 0,5 → rien n’est enregistré, saisie manuelle pré-remplie', () => {
    const r = interpretScan(raw({ confidence: 0.49 }), cats, TODAY);
    expect(r).toEqual({
      kind: 'manual',
      prefill: { amount: 250000, date: '2026-10-05', categoryId: 'c-an', note: 'Highlands Coffee' },
    });
    expect(interpretScan(raw({ confidence: 0.5 }), cats, TODAY).kind).toBe('ready');
  });

  it('montant illisible → saisie manuelle sans montant, avec ce qui a été lu', () => {
    for (const amount of [0, -1, 'beaucoup', null]) {
      expect(interpretScan(raw({ amount }), cats, TODAY)).toEqual({
        kind: 'manual',
        prefill: {
          amount: undefined,
          date: '2026-10-05',
          categoryId: 'c-an',
          note: 'Highlands Coffee',
        },
      });
    }
  });

  it('réponse inexploitable → saisie manuelle vide (date du jour)', () => {
    for (const v of [null, undefined, 'texte', 12]) {
      expect(interpretScan(v, cats, TODAY)).toEqual({
        kind: 'manual',
        prefill: { amount: undefined, date: TODAY, categoryId: undefined, note: '' },
      });
    }
  });
});

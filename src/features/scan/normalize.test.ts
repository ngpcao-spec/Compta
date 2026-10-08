import { describe, expect, it } from 'vitest';
import { interpretScan } from './normalize';
import type { CategoryRef } from '../../../supabase/functions/scan-receipt/validate';

const cats: CategoryRef[] = [
  { id: 'c-an', name: 'Ăn uống', type: 'expense' },
  { id: 'c-cf', name: 'Cà phê', type: 'expense' },
  { id: 'c-khac', name: 'Khác', type: 'expense' },
  { id: 'c-luong', name: 'Lương', type: 'income' },
  { id: 'c-tnk', name: 'Thu nhập khác', type: 'income' },
];
const TODAY = '2026-10-08';
const raw = (over: Record<string, unknown> = {}) => ({
  amount: 250000,
  date: '2026-10-05',
  category_id: 'c-an',
  doc_kind: 'invoice',
  tx_type: 'expense',
  merchant: 'Highlands Coffee',
  vat_included: true,
  confidence: 0.9,
  ...over,
});

describe('interpretScan', () => {
  it('réponse fiable → prête à enregistrer (marchand en note)', () => {
    expect(interpretScan(raw(), cats, TODAY)).toEqual({
      kind: 'ready',
      draft: {
        txType: 'expense',
        docKind: 'invoice',
        amount: 250000,
        date: '2026-10-05',
        categoryId: 'c-an',
        note: 'Highlands Coffee',
        vatExcluded: false,
        confidence: 0.9,
      },
    });
  });

  it('facture MM Mega Market hors TVA : Ăn uống, préfixe (chưa VAT) et numéro de facture en note', () => {
    const r = interpretScan(
      raw({
        amount: 1020331,
        date: null,
        category_id: 'c-an', // fromages, lait… l'IA choisit selon les articles
        merchant: 'HĐ #ISR06000025498',
        vat_included: false,
        confidence: 0.85,
      }),
      cats,
      TODAY,
    );
    expect(r).toEqual({
      kind: 'ready',
      draft: {
        txType: 'expense',
        docKind: 'invoice',
        amount: 1020331,
        date: TODAY,
        categoryId: 'c-an',
        note: '(chưa VAT) HĐ #ISR06000025498',
        vatExcluded: true,
        confidence: 0.85,
      },
    });
  });

  it('facture TTC classique : aucun préfixe, pas d’avertissement TVA', () => {
    const r = interpretScan(raw({ vat_included: true, merchant: 'Co.opmart' }), cats, TODAY);
    expect(r.kind === 'ready' && r.draft.note).toBe('Co.opmart');
    expect(r.kind === 'ready' && r.draft.vatExcluded).toBe(false);
  });

  it('TVA non mentionnée (null) : traité comme TTC, sans préfixe', () => {
    const r = interpretScan(raw({ vat_included: null }), cats, TODAY);
    expect(r.kind === 'ready' && r.draft.note).toBe('Highlands Coffee');
    expect(r.kind === 'ready' && r.draft.vatExcluded).toBe(false);
  });

  it('hors TVA sans libellé : la note est juste le préfixe ; total borné à 100 caractères', () => {
    const none = interpretScan(raw({ vat_included: false, merchant: null }), cats, TODAY);
    expect(none.kind === 'ready' && none.draft.note).toBe('(chưa VAT)');
    const long = interpretScan(
      raw({ vat_included: false, merchant: 'M'.repeat(250) }),
      cats,
      TODAY,
    );
    expect(long.kind === 'ready' && long.draft.note).toHaveLength(100);
    expect(long.kind === 'ready' && long.draft.note.startsWith('(chưa VAT) M')).toBe(true);
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
      prefill: {
        type: 'expense',
        amount: 250000,
        date: '2026-10-05',
        categoryId: 'c-an',
        note: 'Highlands Coffee',
      },
    });
    expect(interpretScan(raw({ confidence: 0.5 }), cats, TODAY).kind).toBe('ready');
  });

  it('montant illisible → saisie manuelle sans montant, avec ce qui a été lu', () => {
    for (const amount of [0, -1, 'beaucoup', null]) {
      expect(interpretScan(raw({ amount }), cats, TODAY)).toEqual({
        kind: 'manual',
        prefill: {
          type: 'expense',
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

  describe('notifications bancaires / e-wallet', () => {
    const bank = (over: Record<string, unknown> = {}) => ({
      doc_kind: 'bank_notification',
      tx_type: 'income',
      amount: 3500000,
      date: '2026-10-07',
      category_id: 'c-tnk',
      merchant: 'CAO MINH NHAN - Chuyen tien',
      vat_included: null,
      confidence: 0.93,
      ...over,
    });

    it('SMS NamABank « nop 3.500.000VND » : revenu de 3 500 000 le 07/10/2026, sans numéro de compte', () => {
      // SMS : « NamABank: TK 4010…0007 nop 3.500.000VND luc 21:36 07/10/2026. So du 3.617.661VND. ND: CAO MINH NHAN Chuyen tien »
      const r = interpretScan(bank(), cats, TODAY);
      expect(r).toEqual({
        kind: 'ready',
        draft: {
          txType: 'income',
          docKind: 'bank_notification',
          amount: 3500000, // le montant du virement, jamais le solde 3.617.661
          date: '2026-10-07',
          categoryId: 'c-tnk', // pas un salaire : catégorie de secours des revenus
          note: 'CAO MINH NHAN - Chuyen tien',
          vatExcluded: false,
          confidence: 0.93,
        },
      });
      expect(r.kind === 'ready' && r.draft.note).not.toMatch(/4010|0007/);
    });

    it('même si l’IA recopie le numéro de compte, la note est nettoyée', () => {
      for (const merchant of [
        'TK 4010…0007 CAO MINH NHAN Chuyen tien',
        'CAO MINH NHAN Chuyen tien TK 4010****0007',
        'STK: 40100000007 - CAO MINH NHAN - Chuyen tien',
        'Số TK 4010...0007 CAO MINH NHAN Chuyen tien',
      ]) {
        const r = interpretScan(bank({ merchant }), cats, TODAY);
        const note = r.kind === 'ready' ? r.draft.note : '';
        expect(note).not.toMatch(/\d{4}|TK|…|\*\*/i);
        expect(note).toContain('CAO MINH NHAN');
        expect(note).toContain('Chuyen tien');
      }
    });

    it('SMS de débit : dépense, catégorie de la liste des dépenses', () => {
      const r = interpretScan(
        bank({
          tx_type: 'expense',
          amount: 250000,
          category_id: 'c-an',
          merchant: 'Thanh toan GRAB',
        }),
        cats,
        TODAY,
      );
      expect(r.kind).toBe('ready');
      expect(r.kind === 'ready' && r.draft).toMatchObject({
        txType: 'expense',
        amount: 250000,
        categoryId: 'c-an',
        note: 'Thanh toan GRAB',
      });
    });

    it('virement de salaire : « Lương »', () => {
      const r = interpretScan(
        bank({ category_id: 'c-luong', merchant: 'CONG TY ABC - Luong thang 9' }),
        cats,
        TODAY,
      );
      expect(r.kind === 'ready' && r.draft).toMatchObject({
        txType: 'income',
        categoryId: 'c-luong',
      });
    });

    it('capture MoMo de paiement : dépense, pas de TVA, montant du paiement', () => {
      const r = interpretScan(
        bank({
          tx_type: 'expense',
          amount: 89000,
          date: '2026-10-08',
          category_id: 'c-khac',
          merchant: 'Thanh toán Highlands Coffee',
          vat_included: false, // ne concerne pas les notifications : ignoré
        }),
        cats,
        TODAY,
      );
      expect(r.kind === 'ready' && r.draft).toMatchObject({
        txType: 'expense',
        docKind: 'bank_notification',
        amount: 89000,
        categoryId: 'c-khac',
        note: 'Thanh toán Highlands Coffee',
        vatExcluded: false,
      });
    });

    it('catégorie d’un autre type que le sens détecté → catégorie de secours du bon type', () => {
      // revenu détecté mais l'IA a donné une catégorie de dépense
      const r = interpretScan(bank({ category_id: 'c-an' }), cats, TODAY);
      expect(r.kind === 'ready' && r.draft.categoryId).toBe('c-tnk');
      const d = interpretScan(bank({ tx_type: 'expense', category_id: 'c-luong' }), cats, TODAY);
      expect(d.kind === 'ready' && d.draft.categoryId).toBe('c-khac');
    });

    it('plusieurs transactions / document « other » / sens inconnu : rien d’enregistré, saisie vide', () => {
      const empty = { kind: 'manual', prefill: { date: TODAY, note: '' } };
      expect(
        interpretScan(bank({ doc_kind: 'other', amount: 0, confidence: 0 }), cats, TODAY),
      ).toEqual(empty);
      // même avec un montant et une confiance élevés : « other » n'est jamais enregistré
      expect(interpretScan(bank({ doc_kind: 'other', confidence: 0.99 }), cats, TODAY)).toEqual(
        empty,
      );
      expect(interpretScan(bank({ doc_kind: 'mystère' }), cats, TODAY)).toEqual(empty);
      expect(interpretScan(bank({ tx_type: null }), cats, TODAY).kind).toBe('manual');
    });

    it('confiance faible sur un revenu : saisie manuelle sur l’onglet Thu nhập', () => {
      const r = interpretScan(bank({ confidence: 0.3 }), cats, TODAY);
      expect(r).toEqual({
        kind: 'manual',
        prefill: {
          type: 'income',
          amount: 3500000,
          date: '2026-10-07',
          categoryId: 'c-tnk',
          note: 'CAO MINH NHAN - Chuyen tien',
        },
      });
    });
  });
});

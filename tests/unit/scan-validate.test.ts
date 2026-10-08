import { describe, expect, it } from 'vitest';
import {
  normalizeDate,
  resolveCategory,
  stripAccountNumbers,
  todayInVietnam,
  validateScan,
  type CategoryRef,
} from '../../supabase/functions/scan-receipt/validate';

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

describe('validateScan', () => {
  it('accepte une réponse valide', () => {
    expect(validateScan(raw(), cats, TODAY)).toEqual({
      doc_kind: 'invoice',
      tx_type: 'expense',
      amount: 250000,
      date: '2026-10-05',
      category_id: 'c-an',
      merchant: 'Highlands Coffee',
      vat_included: true,
      confidence: 0.9,
    });
  });

  it('vat_included : booléen conservé, tout le reste → null', () => {
    expect(validateScan(raw({ vat_included: false }), cats, TODAY)?.vat_included).toBe(false);
    expect(validateScan(raw({ vat_included: true }), cats, TODAY)?.vat_included).toBe(true);
    for (const v of [null, undefined, 'false', 0, 1, {}]) {
      expect(validateScan(raw({ vat_included: v }), cats, TODAY)?.vat_included).toBeNull();
    }
  });

  it('arrondit le montant et refuse les montants illisibles', () => {
    expect(validateScan(raw({ amount: 250000.4 }), cats, TODAY)?.amount).toBe(250000);
    for (const amount of [0, -5, NaN, Infinity, '250000', null, undefined, 1e14]) {
      expect(validateScan(raw({ amount }), cats, TODAY)).toBeNull();
    }
  });

  it('catégorie inconnue → « Khác »', () => {
    expect(validateScan(raw({ category_id: 'inventée' }), cats, TODAY)?.category_id).toBe('c-khac');
    expect(validateScan(raw({ category_id: 42 }), cats, TODAY)?.category_id).toBe('c-khac');
  });

  it('refuse si ni la catégorie ni « Khác » ne sont disponibles', () => {
    expect(
      validateScan(
        raw({ category_id: 'x' }),
        [{ id: 'c-an', name: 'Ăn uống', type: 'expense' }],
        TODAY,
      ),
    ).toBeNull();
  });

  it('« Khác » est reconnu sans tenir compte de la casse et des espaces', () => {
    expect(resolveCategory('x', [{ id: 'k', name: '  khác ', type: 'expense' }])).toBe('k');
  });

  it('confiance bornée à 0..1, inconnue = 0', () => {
    expect(validateScan(raw({ confidence: 7 }), cats, TODAY)?.confidence).toBe(1);
    expect(validateScan(raw({ confidence: -1 }), cats, TODAY)?.confidence).toBe(0);
    expect(validateScan(raw({ confidence: 'haute' }), cats, TODAY)?.confidence).toBe(0);
  });

  it('marchand : nettoyé, tronqué à 100 caractères, vide → null', () => {
    expect(validateScan(raw({ merchant: '  Phở   24 ' }), cats, TODAY)?.merchant).toBe('Phở 24');
    expect(validateScan(raw({ merchant: 'x'.repeat(300) }), cats, TODAY)?.merchant).toHaveLength(
      100,
    );
    expect(validateScan(raw({ merchant: '   ' }), cats, TODAY)?.merchant).toBeNull();
    expect(validateScan(raw({ merchant: 12 }), cats, TODAY)?.merchant).toBeNull();
  });

  it('refuse ce qui n’est pas un objet', () => {
    for (const v of [null, undefined, 'texte', 12, []])
      expect(validateScan(v, cats, TODAY)).toBeNull();
  });
});

describe('normalizeDate', () => {
  it('garde une date récente valide, y compris aujourd’hui', () => {
    expect(normalizeDate('2026-10-08', TODAY)).toBe('2026-10-08');
    expect(normalizeDate('2025-10-08', TODAY)).toBe('2025-10-08');
  });
  it('rejette le futur, plus d’un an, le format et les dates impossibles', () => {
    expect(normalizeDate('2026-10-09', TODAY)).toBeNull();
    expect(normalizeDate('2025-10-07', TODAY)).toBeNull();
    expect(normalizeDate('08/10/2026', TODAY)).toBeNull();
    expect(normalizeDate('2026-02-30', TODAY)).toBeNull();
    expect(normalizeDate(null, TODAY)).toBeNull();
    expect(normalizeDate(20261008, TODAY)).toBeNull();
  });
});

describe('todayInVietnam', () => {
  it('bascule au jour suivant à 17h UTC (minuit à Hô Chi Minh)', () => {
    expect(todayInVietnam(new Date('2026-10-08T16:59:00Z'))).toBe('2026-10-08');
    expect(todayInVietnam(new Date('2026-10-08T17:00:00Z'))).toBe('2026-10-09');
  });
});

describe('notifications bancaires', () => {
  const bank = (over: Record<string, unknown> = {}) =>
    raw({
      doc_kind: 'bank_notification',
      tx_type: 'income',
      amount: 3500000,
      date: '2026-10-07',
      category_id: 'c-tnk',
      merchant: 'CAO MINH NHAN - Chuyen tien',
      vat_included: true,
      ...over,
    });

  it('revenu validé avec la catégorie de la liste des revenus', () => {
    expect(validateScan(bank(), cats, TODAY)).toEqual({
      doc_kind: 'bank_notification',
      tx_type: 'income',
      amount: 3500000,
      date: '2026-10-07',
      category_id: 'c-tnk',
      merchant: 'CAO MINH NHAN - Chuyen tien',
      vat_included: null,
      confidence: 0.9,
    });
  });

  it('une facture est toujours une dépense, même si l’IA répond « income »', () => {
    const r = validateScan(raw({ tx_type: 'income', category_id: 'c-luong' }), cats, TODAY);
    expect(r).toMatchObject({ doc_kind: 'invoice', tx_type: 'expense', category_id: 'c-khac' });
  });

  it('réponse sans doc_kind ni tx_type (ancien format) : facture / dépense', () => {
    const old = { amount: 1000, date: null, category_id: 'c-an', merchant: null, confidence: 0.9 };
    expect(validateScan(old, cats, TODAY)).toMatchObject({
      doc_kind: 'invoice',
      tx_type: 'expense',
    });
  });

  it('« other », doc_kind inconnu, sens absent ou invalide → null', () => {
    expect(validateScan(bank({ doc_kind: 'other' }), cats, TODAY)).toBeNull();
    expect(validateScan(bank({ doc_kind: 'sms' }), cats, TODAY)).toBeNull();
    expect(validateScan(bank({ doc_kind: null }), cats, TODAY)).toBeNull();
    for (const tx_type of [undefined, null, 'virement', 1]) {
      expect(validateScan(bank({ tx_type }), cats, TODAY)).toBeNull();
    }
  });

  it('montant illisible (0, solde absent…) → null', () => {
    expect(validateScan(bank({ amount: 0 }), cats, TODAY)).toBeNull();
  });

  it('catégorie de secours par type : « Khác » (dépense), « Thu nhập khác » (revenu)', () => {
    expect(resolveCategory('x', cats, 'expense')).toBe('c-khac');
    expect(resolveCategory('x', cats, 'income')).toBe('c-tnk');
    expect(resolveCategory('c-luong', cats, 'income')).toBe('c-luong');
    expect(resolveCategory('c-luong', cats, 'expense')).toBe('c-khac'); // mauvais type
    expect(
      resolveCategory(
        'x',
        cats.filter((c) => c.type === 'expense'),
        'income',
      ),
    ).toBeNull();
  });

  it('stripAccountNumbers : retire comptes et cartes, garde le contenu', () => {
    expect(stripAccountNumbers('CAO MINH NHAN Chuyen tien')).toBe('CAO MINH NHAN Chuyen tien');
    expect(stripAccountNumbers('TK 4010…0007 CAO MINH NHAN')).toBe('CAO MINH NHAN');
    expect(stripAccountNumbers('Thẻ ****1234 thanh toan GRAB')).toBe('thanh toan GRAB');
    expect(stripAccountNumbers('CK 0901234567 ve nha')).toBe('CK ve nha');
    expect(stripAccountNumbers('4010000007')).toBe('');
  });

  it('une note de notification qui ne contient que des chiffres de compte devient null', () => {
    expect(validateScan(bank({ merchant: 'TK 4010…0007' }), cats, TODAY)?.merchant).toBeNull();
  });

  it('le numéro de facture d’une facture est conservé', () => {
    expect(validateScan(raw({ merchant: 'HĐ #ISR06000025498' }), cats, TODAY)?.merchant).toBe(
      'HĐ #ISR06000025498',
    );
  });
});

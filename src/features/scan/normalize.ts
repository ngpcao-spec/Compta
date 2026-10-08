import {
  CONFIDENCE_MIN,
  MERCHANT_MAX,
  normalizeAmount,
  normalizeDate,
  normalizeMerchant,
  resolveCategory,
  validateScan,
  type CategoryRef,
} from '../../../supabase/functions/scan-receipt/validate';

export interface Draft {
  amount: number;
  /** YYYY-MM-DD ; aujourd'hui si la facture n'en donne pas */
  date: string;
  categoryId: string;
  /** nom du marchand, ≤ 100 caractères */
  note: string;
  confidence: number;
}

/** Ce qui a pu être lu, pour pré-remplir la saisie manuelle. */
export interface Prefill {
  amount?: number;
  date: string;
  categoryId?: string;
  note: string;
}

export type Interpretation = { kind: 'ready'; draft: Draft } | { kind: 'manual'; prefill: Prefill };

/**
 * Seconde validation côté client (la fonction a déjà validé) : montant, catégorie de dépense
 * existante (sinon « Khác »), date (sinon aujourd'hui), marchand en note.
 * Confiance < 0,5 ou résultat inutilisable → saisie manuelle pré-remplie, rien n'est enregistré.
 */
export function interpretScan(
  raw: unknown,
  categories: readonly CategoryRef[],
  today: string,
): Interpretation {
  const result = validateScan(raw, categories, today);
  if (result && result.confidence >= CONFIDENCE_MIN) {
    return {
      kind: 'ready',
      draft: {
        amount: result.amount,
        date: result.date ?? today,
        categoryId: result.category_id,
        note: (result.merchant ?? '').slice(0, MERCHANT_MAX),
        confidence: result.confidence,
      },
    };
  }
  const r = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {};
  return {
    kind: 'manual',
    prefill: {
      amount: normalizeAmount(r.amount) ?? undefined,
      date: normalizeDate(r.date, today) ?? today,
      // « Khác » seulement si l'IA a bien proposé une catégorie (inconnue) ; sinon rien de présélectionné.
      categoryId:
        typeof r.category_id === 'string'
          ? (resolveCategory(r.category_id, categories) ?? undefined)
          : undefined,
      note: normalizeMerchant(r.merchant) ?? '',
    },
  };
}

import {
  CONFIDENCE_MIN,
  NO_VAT_PREFIX,
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
  /** note ≤ 100 caractères : (chưa VAT) éventuel + commerçant / n° de facture / type d'achat */
  note: string;
  /** la facture indique explicitement que le montant est hors TVA */
  vatExcluded: boolean;
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

/** Note de la dépense : « (chưa VAT) » devant le libellé quand le montant est hors TVA. */
function buildNote(label: string | null, vatExcluded: boolean): string {
  const base = label ?? '';
  const note = vatExcluded ? `${NO_VAT_PREFIX} ${base}`.trim() : base;
  return note.slice(0, MERCHANT_MAX);
}

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
        note: buildNote(result.merchant, result.vat_included === false),
        vatExcluded: result.vat_included === false,
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

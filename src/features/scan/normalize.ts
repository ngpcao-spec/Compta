import {
  CONFIDENCE_MIN,
  NO_VAT_PREFIX,
  MERCHANT_MAX,
  normalizeAmount,
  normalizeDate,
  normalizeDocKind,
  normalizeMerchant,
  normalizeTxType,
  resolveCategory,
  validateScan,
  type CategoryRef,
  type DocKind,
  type TxKind,
} from '../../../supabase/functions/scan-receipt/validate';

export interface Draft {
  /** sens détecté par l'IA : prime sur l'onglet ouvert */
  txType: TxKind;
  docKind: DocKind;
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
  /** sens détecté, s'il est connu (sinon l'onglet ouvert est conservé) */
  type?: TxKind;
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
        txType: result.tx_type,
        docKind: result.doc_kind,
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
  const kind = normalizeDocKind(r.doc_kind);
  // « other » : rien d'exploitable (pas une facture, plusieurs transactions…) → saisie vide
  if (kind === null) return { kind: 'manual', prefill: { date: today, note: '' } };
  // sens connu seulement si la réponse en parle : sinon on garde l'onglet ouvert
  const type =
    kind === 'bank_notification' || typeof r.tx_type === 'string'
      ? (normalizeTxType(r.tx_type, kind) ?? undefined)
      : undefined;
  return {
    kind: 'manual',
    prefill: {
      type,
      amount: normalizeAmount(r.amount) ?? undefined,
      date: normalizeDate(r.date, today) ?? today,
      // catégorie de secours seulement si l'IA a bien proposé une catégorie (inconnue) ; sinon rien de présélectionné.
      categoryId:
        typeof r.category_id === 'string'
          ? (resolveCategory(r.category_id, categories, type ?? 'expense') ?? undefined)
          : undefined,
      note: normalizeMerchant(r.merchant) ?? '',
    },
  };
}

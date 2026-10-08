// Logique pure (aucune API Deno) : partagée par l'Edge Function, le client et les tests.

export type TxKind = 'expense' | 'income';
export type DocKind = 'invoice' | 'bank_notification';

export interface CategoryRef {
  id: string;
  name: string;
  type: TxKind;
}

export interface ScanResult {
  /** facture ou notification bancaire / e-wallet (« other » n'est jamais renvoyé : rien à enregistrer) */
  doc_kind: DocKind;
  /** dépense pour une facture ; dépense ou revenu pour une notification bancaire */
  tx_type: TxKind;
  amount: number;
  /** YYYY-MM-DD, ni future ni plus vieille d'un an ; sinon null */
  date: string | null;
  category_id: string;
  /** Libellé de la note : commerçant, sinon numéro de facture, sinon type d'achat (≤ 100 car.) */
  merchant: string | null;
  /** true : total TTC ; false : la facture dit explicitement « chưa bao gồm VAT » ; null : inconnu */
  vat_included: boolean | null;
  /** 0..1 */
  confidence: number;
}

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const DAILY_LIMIT = 30;
/** Catégorie de secours de chaque type. */
export const FALLBACK_CATEGORY_NAMES: Record<TxKind, string> = {
  expense: 'Khác',
  income: 'Thu nhập khác',
};
export const MAX_AMOUNT = 9_999_999_999_999;
export const MERCHANT_MAX = 100;
export const CONFIDENCE_MIN = 0.5;
/** Préfixe de la note quand la facture indique un montant hors TVA. */
export const NO_VAT_PREFIX = '(chưa VAT)';

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Date du jour au Vietnam (UTC+7), `YYYY-MM-DD`. */
export function todayInVietnam(now: Date): string {
  return new Date(now.getTime() + 7 * 3600_000).toISOString().slice(0, 10);
}

function isRealDate(s: string): boolean {
  const m = DATE_RE.exec(s);
  if (!m) return false;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return d.toISOString().slice(0, 10) === s;
}

/** Date lue sur la facture : valide si réelle, ≤ aujourd'hui et ≥ aujourd'hui − 1 an, sinon null. */
export function normalizeDate(value: unknown, today: string): string | null {
  if (typeof value !== 'string') return null;
  const s = value.trim();
  if (!isRealDate(s) || s > today) return null;
  const limit = `${Number(today.slice(0, 4)) - 1}${today.slice(4)}`;
  return s < limit ? null : s;
}

export function normalizeAmount(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  const n = Math.round(value);
  return n > 0 && n <= MAX_AMOUNT ? n : null;
}

/**
 * Catégorie renvoyée si elle est dans la liste du type voulu, sinon la catégorie de secours de ce
 * type (« Khác » / « Thu nhập khác ») ; null si ni l'une ni l'autre.
 */
export function resolveCategory(
  value: unknown,
  categories: readonly CategoryRef[],
  type: TxKind = 'expense',
): string | null {
  if (typeof value === 'string' && categories.some((c) => c.id === value && c.type === type)) {
    return value;
  }
  const fallback = categories.find(
    (c) =>
      c.type === type &&
      c.name.trim().toLowerCase() === FALLBACK_CATEGORY_NAMES[type].toLowerCase(),
  );
  return fallback?.id ?? null;
}

/**
 * Retire d'une note de notification bancaire tout ce qui ressemble à un numéro de compte ou de
 * carte : « TK 4010…0007 », « ****0007 », tout mot contenant 4 chiffres ou plus. (Pas appliqué
 * aux factures : leur numéro de facture est une note légitime.)
 */
export function stripAccountNumbers(note: string): string {
  return note
    .replace(
      /(?<![\p{L}\p{N}])(?:s[oố]\s*)?(?:stk|tk|tài\s*khoản|tai\s*khoan|acc(?:ount)?|a\/c|thẻ|card)(?![\p{L}\p{N}])[\s.:#-]*\S*\d\S*/giu,
      ' ',
    )
    .replace(/\S*(?:\d{4,}|[*•xX.…]{2,}\d{2,})\S*/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^[\s\-–:;,.]+|[\s\-–:;,.]+$/g, '');
}

const DOC_KINDS: readonly string[] = ['invoice', 'bank_notification'];

export function normalizeMerchant(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const s = value.trim().replace(/\s+/g, ' ');
  return s === '' ? null : s.slice(0, MERCHANT_MAX);
}

/**
 * Nature du document lue par l'IA. Absente (réponse ancienne) → facture ; « other » ou valeur
 * inconnue → null : rien à enregistrer.
 */
export function normalizeDocKind(value: unknown): DocKind | null {
  if (value === undefined) return 'invoice';
  return typeof value === 'string' && DOC_KINDS.includes(value) ? (value as DocKind) : null;
}

/**
 * Sens de l'opération. Une facture est toujours une dépense ; pour une notification bancaire
 * le sens doit être explicite (sinon null : on ne devine pas entre dépense et revenu).
 */
export function normalizeTxType(value: unknown, kind: DocKind): TxKind | null {
  if (kind === 'invoice') return 'expense';
  return value === 'income' || value === 'expense' ? value : null;
}

function normalizeConfidence(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

/**
 * Valide et normalise la réponse brute de l'IA. Retourne null si elle est inutilisable
 * (pas un objet, montant illisible ou non positif, aucune catégorie possible).
 */
export function validateScan(
  raw: unknown,
  categories: readonly CategoryRef[],
  today: string,
): ScanResult | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const r = raw as Record<string, unknown>;
  const doc_kind = normalizeDocKind(r.doc_kind);
  if (doc_kind === null) return null;
  const tx_type = normalizeTxType(r.tx_type, doc_kind);
  if (tx_type === null) return null;
  const amount = normalizeAmount(r.amount);
  if (amount === null) return null;
  const category_id = resolveCategory(r.category_id, categories, tx_type);
  if (category_id === null) return null;
  const merchant = normalizeMerchant(r.merchant);
  const bank = doc_kind === 'bank_notification';
  return {
    doc_kind,
    tx_type,
    amount,
    date: normalizeDate(r.date, today),
    category_id,
    merchant: bank && merchant ? normalizeMerchant(stripAccountNumbers(merchant)) : merchant,
    // la TVA ne concerne que les factures
    vat_included: !bank && typeof r.vat_included === 'boolean' ? r.vat_included : null,
    confidence: normalizeConfidence(r.confidence),
  };
}

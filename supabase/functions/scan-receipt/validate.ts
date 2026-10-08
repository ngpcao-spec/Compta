// Logique pure (aucune API Deno) : partagée par l'Edge Function, le client et les tests.

export interface CategoryRef {
  id: string;
  name: string;
}

export interface ScanResult {
  amount: number;
  /** YYYY-MM-DD, ni future ni plus vieille d'un an ; sinon null */
  date: string | null;
  category_id: string;
  merchant: string | null;
  /** 0..1 */
  confidence: number;
}

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const DAILY_LIMIT = 30;
export const FALLBACK_CATEGORY_NAME = 'Khác';
export const MAX_AMOUNT = 9_999_999_999_999;
export const MERCHANT_MAX = 100;
export const CONFIDENCE_MIN = 0.5;

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

/** Catégorie renvoyée si elle est dans la liste, sinon « Khác » ; null si ni l'une ni l'autre. */
export function resolveCategory(value: unknown, categories: readonly CategoryRef[]): string | null {
  if (typeof value === 'string' && categories.some((c) => c.id === value)) return value;
  const fallback = categories.find(
    (c) => c.name.trim().toLowerCase() === FALLBACK_CATEGORY_NAME.toLowerCase(),
  );
  return fallback?.id ?? null;
}

export function normalizeMerchant(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const s = value.trim().replace(/\s+/g, ' ');
  return s === '' ? null : s.slice(0, MERCHANT_MAX);
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
  const amount = normalizeAmount(r.amount);
  if (amount === null) return null;
  const category_id = resolveCategory(r.category_id, categories);
  if (category_id === null) return null;
  return {
    amount,
    date: normalizeDate(r.date, today),
    category_id,
    merchant: normalizeMerchant(r.merchant),
    confidence: normalizeConfidence(r.confidence),
  };
}

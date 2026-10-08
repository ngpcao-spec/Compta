/** Parseur d'expressions arithmétiques du clavier-calculatrice (sans eval). */
export type EvalResult =
  | { ok: true; value: number }
  | { ok: false; error: 'syntax' | 'negative' | 'divzero' | 'overflow' };

export const MAX_DIGITS = 13;

type Tok = { t: 'num'; v: number } | { t: 'op'; v: '+' | '-' | '*' | '/' };

function tokenize(src: string): Tok[] | null {
  const toks: Tok[] = [];
  let i = 0;
  while (i < src.length) {
    const ch = src[i] as string;
    if (ch >= '0' && ch <= '9') {
      let j = i;
      while (j < src.length && (src[j] as string) >= '0' && (src[j] as string) <= '9') j++;
      toks.push({ t: 'num', v: Number(src.slice(i, j)) });
      i = j;
    } else if (ch === '+') {
      toks.push({ t: 'op', v: '+' });
      i++;
    } else if (ch === '-' || ch === '−') {
      toks.push({ t: 'op', v: '-' });
      i++;
    } else if (ch === '×' || ch === '*' || ch === 'x') {
      toks.push({ t: 'op', v: '*' });
      i++;
    } else if (ch === '÷' || ch === '/') {
      toks.push({ t: 'op', v: '/' });
      i++;
    } else if (ch === ',' || ch === ' ') {
      i++;
    } else {
      return null;
    }
  }
  return toks;
}

/** Priorités usuelles (× ÷ avant + −), résultat arrondi à l'entier, négatif interdit. */
export function evaluate(src: string): EvalResult {
  const toks = tokenize(src);
  if (!toks || toks.length === 0) return { ok: false, error: 'syntax' };
  let pos = 0;
  let divZero = false;

  const term = (): number | null => {
    const first = toks[pos];
    if (!first || first.t !== 'num') return null;
    pos++;
    let acc = first.v;
    for (;;) {
      const op = toks[pos];
      if (!op || op.t !== 'op' || (op.v !== '*' && op.v !== '/')) break;
      const rhs = toks[pos + 1];
      if (!rhs || rhs.t !== 'num') return null;
      pos += 2;
      if (op.v === '*') acc *= rhs.v;
      else if (rhs.v === 0) divZero = true;
      else acc /= rhs.v;
    }
    return acc;
  };

  let acc = term();
  if (acc === null) return { ok: false, error: 'syntax' };
  for (;;) {
    const op = toks[pos];
    if (!op) break;
    if (op.t !== 'op' || (op.v !== '+' && op.v !== '-')) return { ok: false, error: 'syntax' };
    pos++;
    const rhs = term();
    if (rhs === null) return { ok: false, error: 'syntax' };
    acc = op.v === '+' ? acc + rhs : acc - rhs;
  }
  if (divZero) return { ok: false, error: 'divzero' };
  const value = Math.round(acc);
  if (value < 0) return { ok: false, error: 'negative' };
  if (!Number.isFinite(value) || String(value).length > MAX_DIGITS)
    return { ok: false, error: 'overflow' };
  return { ok: true, value };
}

export function hasOperator(src: string): boolean {
  return /[+\-−×÷*/]/.test(src);
}

/** Ajoute un caractère à l'expression en respectant les règles de saisie. */
export function appendToExpr(expr: string, key: string): string {
  const isOp = /^[+−×÷]$/.test(key);
  const last = expr.slice(-1);
  if (isOp) {
    if (expr === '') return expr;
    if (/[+−×÷]/.test(last)) return expr.slice(0, -1) + key;
    return expr + key;
  }
  // chiffres : pas de zéros en tête, 13 chiffres max par nombre
  const m = /(\d*)$/.exec(expr);
  const cur = m?.[1] ?? '';
  const add = key === '000' ? (cur === '' || cur === '0' ? '' : '000') : key;
  if (add === '') return expr;
  if (cur === '0' && key !== '000') return expr.slice(0, -1) + add;
  if ((cur + add).length > MAX_DIGITS) return expr;
  return expr + add;
}

export function backspace(expr: string): string {
  return expr.slice(0, -1);
}

/** Affichage avec séparateurs de milliers sur chaque nombre. */
export function formatExpr(expr: string): string {
  return expr.replace(/\d+/g, (n) => n.replace(/\B(?=(\d{3})+(?!\d))/g, ','));
}

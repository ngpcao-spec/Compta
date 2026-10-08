export const MASK = '******';

/** Seule fonction de formatage des montants : `28,750,000`, sans symbole. */
export function formatVnd(n: number): string {
  const v = Math.round(n);
  const sign = v < 0 ? '-' : '';
  return (
    sign +
    Math.abs(v)
      .toString()
      .replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  );
}

/** Montant affiché, éventuellement masqué. `expense` ajoute le préfixe `-`. */
export function displayAmount(
  n: number,
  opts: { hidden?: boolean; expense?: boolean } = {},
): string {
  if (opts.hidden) return MASK;
  const s = formatVnd(Math.abs(n));
  return opts.expense && n !== 0 ? `-${s}` : formatVnd(n);
}

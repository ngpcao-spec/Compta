/** Toutes les dates métier sont des chaînes `YYYY-MM-DD` (jour local), jamais des fuseaux. */
const pad = (n: number) => String(n).padStart(2, '0');

export function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
export function todayStr(now: Date = new Date()): string {
  return toDateStr(now);
}
export function parseDateStr(s: string): { y: number; m: number; d: number } {
  const [y, m, d] = s.split('-').map(Number);
  return { y: y ?? 1970, m: m ?? 1, d: d ?? 1 };
}
/** `YYYY-MM-01` pour toute date. */
export function monthStart(s: string): string {
  const { y, m } = parseDateStr(s);
  return `${y}-${pad(m)}-01`;
}
export function addMonths(month: string, delta: number): string {
  const { y, m } = parseDateStr(month);
  const idx = y * 12 + (m - 1) + delta;
  return `${Math.floor(idx / 12)}-${pad((idx % 12) + 1)}-01`;
}
export function monthOf(y: number, m: number): string {
  return `${y}-${pad(m)}-01`;
}
export function daysInMonth(month: string): number {
  const { y, m } = parseDateStr(month);
  return new Date(y, m, 0).getDate();
}
export function monthEnd(month: string): string {
  const { y, m } = parseDateStr(month);
  return `${y}-${pad(m)}-${pad(daysInMonth(month))}`;
}
export function compareMonths(a: string, b: string): number {
  return monthStart(a).localeCompare(monthStart(b));
}
/** `thg 1 2026` */
export function formatMonthVi(month: string): string {
  const { y, m } = parseDateStr(month);
  return `thg ${m} ${y}`;
}
/** `ngày 2 thg 1, 2026` */
export function formatDayHeader(date: string): string {
  const { y, m, d } = parseDateStr(date);
  return `ngày ${d} thg ${m}, ${y}`;
}
/** `02/01/2026` pour les champs de saisie. */
export function formatDayShort(date: string): string {
  const { y, m, d } = parseDateStr(date);
  return `${pad(d)}/${pad(m)}/${y}`;
}
/** Jours écoulés pour la moyenne journalière : mois courant = jour courant, passé = tous, futur = 0. */
export function elapsedDays(month: string, today: string): number {
  const c = compareMonths(month, today);
  if (c > 0) return 0;
  if (c < 0) return daysInMonth(month);
  return parseDateStr(today).d;
}
/** Mois écoulés d'une année pour la moyenne mensuelle : année passée = 12, courante = mois courant, future = 0. */
export function elapsedMonths(year: number, today: string): number {
  const { y, m } = parseDateStr(today);
  if (year < y) return 12;
  if (year > y) return 0;
  return m;
}

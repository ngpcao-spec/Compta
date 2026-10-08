import { describe, expect, it } from 'vitest';
import {
  addMonths,
  daysInMonth,
  elapsedDays,
  elapsedMonths,
  formatDayHeader,
  formatMonthVi,
  monthStart,
  monthEnd,
} from './dates';

describe('dates', () => {
  it('formate en vietnamien', () => {
    expect(formatMonthVi('2026-01-01')).toBe('thg 1 2026');
    expect(formatDayHeader('2026-01-02')).toBe('ngày 2 thg 1, 2026');
  });
  it('navigue entre les mois', () => {
    expect(addMonths('2026-01-01', -1)).toBe('2025-12-01');
    expect(addMonths('2025-12-01', 1)).toBe('2026-01-01');
    expect(addMonths('2026-03-01', 14)).toBe('2027-05-01');
    expect(monthStart('2026-07-19')).toBe('2026-07-01');
    expect(monthEnd('2026-02-01')).toBe('2026-02-28');
  });
  it('compte les jours', () => {
    expect(daysInMonth('2024-02-01')).toBe(29);
    expect(daysInMonth('2026-01-01')).toBe(31);
  });
  it('jours écoulés', () => {
    expect(elapsedDays('2026-01-01', '2026-01-08')).toBe(8);
    expect(elapsedDays('2025-12-01', '2026-01-08')).toBe(31);
    expect(elapsedDays('2026-02-01', '2026-01-08')).toBe(0);
  });
  it('mois écoulés', () => {
    expect(elapsedMonths(2026, '2026-07-19')).toBe(7);
    expect(elapsedMonths(2025, '2026-07-19')).toBe(12);
    expect(elapsedMonths(2027, '2026-07-19')).toBe(0);
  });
});

import { describe, expect, it } from 'vitest';
import { displayAmount, formatVnd, MASK } from './money';

describe('formatVnd', () => {
  it('sépare les milliers par des virgules', () => {
    expect(formatVnd(28750000)).toBe('28,750,000');
    expect(formatVnd(0)).toBe('0');
    expect(formatVnd(999)).toBe('999');
    expect(formatVnd(1000)).toBe('1,000');
    expect(formatVnd(-9250000)).toBe('-9,250,000');
  });
  it('arrondit à l’entier', () => {
    expect(formatVnd(4625000.4)).toBe('4,625,000');
  });
});

describe('displayAmount', () => {
  it('masque et préfixe', () => {
    expect(displayAmount(100, { hidden: true })).toBe(MASK);
    expect(displayAmount(4800000, { expense: true })).toBe('-4,800,000');
    expect(displayAmount(0, { expense: true })).toBe('0');
    expect(displayAmount(38000000)).toBe('38,000,000');
  });
});

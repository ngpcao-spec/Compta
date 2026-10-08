import { describe, expect, it } from 'vitest';
import { appendToExpr, backspace, evaluate, formatExpr } from './expr';

describe('evaluate', () => {
  it('respecte les priorités', () => {
    expect(evaluate('2+3×4')).toEqual({ ok: true, value: 14 });
    expect(evaluate('20−6÷3')).toEqual({ ok: true, value: 18 });
    expect(evaluate('100000+50000×2')).toEqual({ ok: true, value: 200000 });
  });
  it('arrondit à l’entier', () => {
    expect(evaluate('10÷4')).toEqual({ ok: true, value: 3 });
    expect(evaluate('1÷3×10')).toEqual({ ok: true, value: 3 });
  });
  it('accepte les opérateurs ASCII', () => {
    expect(evaluate('2*3+1')).toEqual({ ok: true, value: 7 });
    expect(evaluate('9-4/2')).toEqual({ ok: true, value: 7 });
  });
  it('rejette les erreurs', () => {
    expect(evaluate('')).toEqual({ ok: false, error: 'syntax' });
    expect(evaluate('+3')).toEqual({ ok: false, error: 'syntax' });
    expect(evaluate('3+')).toEqual({ ok: false, error: 'syntax' });
    expect(evaluate('3++4')).toEqual({ ok: false, error: 'syntax' });
    expect(evaluate('5÷0')).toEqual({ ok: false, error: 'divzero' });
    expect(evaluate('3−5')).toEqual({ ok: false, error: 'negative' });
    expect(evaluate('abc')).toEqual({ ok: false, error: 'syntax' });
    expect(evaluate('9999999999999×10')).toEqual({ ok: false, error: 'overflow' });
  });
  it('évalue un nombre seul', () => {
    expect(evaluate('1200000')).toEqual({ ok: true, value: 1200000 });
    expect(evaluate('0')).toEqual({ ok: true, value: 0 });
  });
});

describe('saisie', () => {
  it('construit une expression', () => {
    let e = '';
    for (const k of ['1', '2', '000', '+', '5']) e = appendToExpr(e, k);
    expect(e).toBe('12000+5');
  });
  it('remplace un opérateur final et ignore un opérateur en tête', () => {
    expect(appendToExpr('', '+')).toBe('');
    expect(appendToExpr('5+', '×')).toBe('5×');
  });
  it('gère les zéros en tête et la limite de 13 chiffres', () => {
    expect(appendToExpr('', '0')).toBe('0');
    expect(appendToExpr('0', '000')).toBe('0');
    expect(appendToExpr('0', '7')).toBe('7');
    expect(appendToExpr('1234567890123', '4')).toBe('1234567890123');
    expect(appendToExpr('1234567890', '000')).toBe('1234567890000');
    expect(appendToExpr('12345678901', '000')).toBe('12345678901');
  });
  it('efface et formate', () => {
    expect(backspace('12+3')).toBe('12+');
    expect(formatExpr('1200000+3500')).toBe('1,200,000+3,500');
  });
});

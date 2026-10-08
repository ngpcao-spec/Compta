import { useState } from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi as vitest } from 'vitest';
import { AmountKeypad } from './AmountKeypad';

afterEach(cleanup);

function Harness({
  onSubmit,
  onError,
}: {
  onSubmit: (n: number) => void;
  onError?: (m: string) => void;
}) {
  const [expr, setExpr] = useState('');
  return (
    <>
      <output data-testid="expr">{expr}</output>
      <AmountKeypad expr={expr} onExprChange={setExpr} onSubmit={onSubmit} onError={onError} />
    </>
  );
}
const click = (id: string) => fireEvent.click(screen.getByTestId(id));
const tap = (id: string) => {
  fireEvent.pointerDown(screen.getByTestId(id));
  fireEvent.pointerUp(screen.getByTestId(id));
};

describe('AmountKeypad', () => {
  it('saisit un montant et le valide', () => {
    const submit = vitest.fn();
    render(<Harness onSubmit={submit} />);
    for (const k of ['key-1', 'key-2', 'key-000']) click(k);
    click('key-ok');
    expect(submit).toHaveBeenCalledWith(12000);
  });

  it('évalue une expression avant de valider', () => {
    const submit = vitest.fn();
    render(<Harness onSubmit={submit} />);
    for (const k of ['key-5', 'key-000']) click(k);
    tap('key-plus');
    click('key-3');
    click('key-000');
    expect(screen.getByTestId('expr').textContent).toBe('5000+3000');
    click('key-ok');
    expect(submit).toHaveBeenCalledWith(8000);
    expect(screen.getByTestId('expr').textContent).toBe('8000');
  });

  it('appui long : × et ÷', () => {
    vitest.useFakeTimers();
    const submit = vitest.fn();
    render(<Harness onSubmit={submit} />);
    click('key-6');
    fireEvent.pointerDown(screen.getByTestId('key-plus'));
    act(() => vitest.advanceTimersByTime(450));
    fireEvent.pointerUp(screen.getByTestId('key-plus'));
    click('key-7');
    expect(screen.getByTestId('expr').textContent).toBe('6×7');
    fireEvent.pointerDown(screen.getByTestId('key-minus'));
    act(() => vitest.advanceTimersByTime(450));
    fireEvent.pointerUp(screen.getByTestId('key-minus'));
    click('key-2');
    expect(screen.getByTestId('expr').textContent).toBe('6×7÷2');
    click('key-equals');
    expect(screen.getByTestId('expr').textContent).toBe('21');
    vitest.useRealTimers();
  });

  it('retour arrière et erreur sans valider', () => {
    const submit = vitest.fn();
    const err = vitest.fn();
    render(<Harness onSubmit={submit} onError={err} />);
    click('key-4');
    click('key-5');
    click('key-back');
    expect(screen.getByTestId('expr').textContent).toBe('4');
    tap('key-minus');
    click('key-9');
    click('key-ok');
    expect(submit).not.toHaveBeenCalled();
    expect(err).toHaveBeenCalled();
  });
});

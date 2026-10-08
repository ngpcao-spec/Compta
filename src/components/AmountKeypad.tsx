import { useRef } from 'react';
import { Check, Delete } from 'lucide-react';
import { appendToExpr, backspace, evaluate, type EvalResult } from '@/lib/expr';
import { vi } from '@/i18n/vi';

interface Props {
  expr: string;
  onExprChange: (expr: string) => void;
  /** appelé par ✓ avec la valeur évaluée */
  onSubmit: (value: number) => void;
  onError?: (message: string) => void;
  /** désactive ✓ (ex. montant nul ou catégorie manquante) */
  okDisabled?: boolean;
}

const ERRORS: Record<Extract<EvalResult, { ok: false }>['error'], string> = {
  syntax: vi.keypad.errSyntax,
  negative: vi.keypad.errNegative,
  divzero: vi.keypad.errDivzero,
  overflow: vi.keypad.errOverflow,
};

function buzz() {
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function')
    navigator.vibrate(10);
}

const keyClass =
  'tap flex h-14 items-center justify-center rounded-xl bg-white text-xl font-semibold active:bg-[#E6E8EE] select-none';

/** Touche à double fonction : tap = `tap`, appui long = `long` (+× et −÷). */
function DualKey({
  id,
  label,
  tap,
  long,
  onKey,
}: {
  id: string;
  label: string;
  tap: string;
  long: string;
  onKey: (k: string) => void;
}) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const didLong = useRef(false);
  const clear = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };
  return (
    <button
      type="button"
      className={`${keyClass} text-2xl text-link`}
      data-testid={id}
      aria-label={`${tap} ${long}`}
      onPointerDown={() => {
        didLong.current = false;
        clear();
        timer.current = setTimeout(() => {
          didLong.current = true;
          onKey(long);
        }, 400);
      }}
      onPointerUp={() => {
        clear();
        if (!didLong.current) onKey(tap);
      }}
      onPointerLeave={clear}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onKey(tap);
        }
      }}
    >
      {label}
    </button>
  );
}

/** Clavier-calculatrice partagé (saisie de transaction et de budget). */
export function AmountKeypad({ expr, onExprChange, onSubmit, onError, okDisabled }: Props) {
  const press = (k: string) => {
    buzz();
    onExprChange(appendToExpr(expr, k));
  };

  const equals = (): number | null => {
    const r = evaluate(expr === '' ? '0' : expr);
    if (!r.ok) {
      onError?.(ERRORS[r.error]);
      return null;
    }
    onExprChange(String(r.value));
    return r.value;
  };

  const digit = (k: string) => (
    <button
      key={k}
      type="button"
      className={keyClass}
      onClick={() => press(k)}
      data-testid={`key-${k}`}
    >
      {k}
    </button>
  );

  return (
    <div className="grid grid-cols-4 gap-2 bg-[#F2F3F7] p-2" role="group" aria-label={vi.tx.amount}>
      {digit('7')}
      {digit('8')}
      {digit('9')}
      <DualKey id="key-plus" label="+×" tap="+" long="×" onKey={press} />
      {digit('4')}
      {digit('5')}
      {digit('6')}
      <DualKey id="key-minus" label="−÷" tap="−" long="÷" onKey={press} />
      {digit('1')}
      {digit('2')}
      {digit('3')}
      <button
        type="button"
        className={keyClass}
        aria-label={vi.keypad.backspace}
        data-testid="key-back"
        onClick={() => {
          buzz();
          onExprChange(backspace(expr));
        }}
      >
        <Delete size={22} />
      </button>
      {digit('000')}
      {digit('0')}
      <button
        type="button"
        className={keyClass}
        aria-label={vi.keypad.equals}
        data-testid="key-equals"
        onClick={equals}
      >
        =
      </button>
      <button
        type="button"
        disabled={okDisabled}
        className="tap flex h-14 items-center justify-center rounded-xl bg-primary text-white active:bg-primary-dark disabled:opacity-40"
        aria-label={vi.keypad.ok}
        data-testid="key-ok"
        onClick={() => {
          buzz();
          const v = equals();
          if (v !== null) onSubmit(v);
        }}
      >
        <Check size={26} />
      </button>
    </div>
  );
}

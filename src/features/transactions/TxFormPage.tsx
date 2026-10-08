import { useMemo, useRef, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router';
import { Calendar, PenLine, Pencil, Trash2 } from 'lucide-react';
import { AmountKeypad } from '@/components/AmountKeypad';
import { CategoryIcon } from '@/components/CategoryIcon';
import { ConfirmSheet } from '@/components/ConfirmSheet';
import { ScanReceiptButton } from '@/features/scan/ScanReceiptButton';
import type { Prefill } from '@/features/scan/normalize';
import { Segmented } from '@/components/Segmented';
import { useToast } from '@/components/Toast';
import { useCategories, useTransaction } from '@/db/hooks';
import {
  createTransaction,
  deleteTransaction,
  NOTE_MAX,
  updateTransaction,
} from '@/db/repo/transactions';
import type { Transaction, TxType } from '@/db/types';
import { ModalHeader } from '@/app/layouts';
import { vi } from '@/i18n/vi';
import { formatDayShort, todayStr } from '@/lib/dates';
import { evaluate, formatExpr, hasOperator } from '@/lib/expr';
import { formatVnd } from '@/lib/money';
import { useGoBack } from '@/lib/nav';

interface FormInit {
  type: TxType;
  categoryId: string | null;
  expr: string;
  note: string;
  date: string;
}

function initFrom(tx: Transaction | null): FormInit {
  return tx
    ? {
        type: tx.type,
        categoryId: tx.category_id,
        expr: String(tx.amount),
        note: tx.note ?? '',
        date: tx.occurred_on,
      }
    : { type: 'expense', categoryId: null, expr: '', note: '', date: todayStr() };
}

/** Saisie / édition d'une transaction (`/tx/new`, `/tx/:id`). */
export function TxFormPage() {
  const { id } = useParams();
  const editing = id !== undefined && id !== 'new';
  const existing = useTransaction(editing ? id : undefined);
  if (editing && existing === undefined) return <div className="h-full" aria-busy="true" />;
  if (editing && existing === null) return <Navigate to="/" replace />;
  return (
    <TxForm key={id ?? 'new'} id={editing ? id : undefined} init={initFrom(existing ?? null)} />
  );
}

function TxForm({ id, init }: { id: string | undefined; init: FormInit }) {
  const editing = id !== undefined;
  const goBack = useGoBack('/');
  const navigate = useNavigate();
  const toast = useToast();
  const dateRef = useRef<HTMLInputElement>(null);

  const [type, setType] = useState<TxType>(init.type);
  const [categoryId, setCategoryId] = useState<string | null>(init.categoryId);
  const [expr, setExpr] = useState(init.expr);
  const [note, setNote] = useState(init.note);
  const [date, setDate] = useState(init.date);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scanMessage, setScanMessage] = useState<string | null>(null);
  const expenseCategories = useCategories('expense');

  const activeQ = useCategories(type);
  const archivedQ = useCategories(type, true);
  const categories = useMemo(
    () => [...(activeQ ?? []), ...(archivedQ ?? []).filter((c) => c.id === categoryId)],
    [activeQ, archivedQ, categoryId],
  );
  const selected = categories.find((c) => c.id === categoryId);

  const preview = evaluate(expr === '' ? '0' : expr);
  const value = preview.ok ? preview.value : 0;
  const valid = categoryId !== null && value > 0;
  const operator = hasOperator(expr);
  const bigText =
    operator && preview.ok ? formatVnd(preview.value) : expr === '' ? '0' : formatExpr(expr);

  const save = async (amount: number) => {
    if (!categoryId || amount <= 0) return;
    try {
      const input = { categoryId, amount, note, occurredOn: date };
      if (editing && id) await updateTransaction(id, input);
      else await createTransaction(input);
      toast(vi.tx.saved);
      goBack();
    } catch {
      setError(vi.login.error);
    }
  };

  /** Scan raté ou douteux : saisie manuelle pré-remplie avec ce qui a été lu. */
  const applyPrefill = (p: Prefill, message: string) => {
    setType('expense');
    setCategoryId(p.categoryId ?? null);
    setExpr(p.amount ? String(p.amount) : '');
    setNote(p.note);
    setDate(p.date);
    setScanMessage(message);
  };

  const openDate = () => {
    const el = dateRef.current;
    if (!el) return;
    try {
      el.showPicker();
    } catch {
      el.focus();
      el.click();
    }
  };

  return (
    <div className="relative flex h-full flex-col overflow-hidden bg-bg">
      <ModalHeader
        title={editing ? vi.tx.editTitle : vi.tx.newTitle}
        leftLabel={vi.common.cancel}
        onLeft={goBack}
        right={
          editing ? (
            <button
              className="tap flex items-center justify-center text-danger-ink"
              aria-label={vi.tx.delete}
              onClick={() => setConfirmDelete(true)}
              data-testid="delete-tx"
            >
              <Trash2 size={20} />
            </button>
          ) : undefined
        }
      >
        <Segmented
          label={vi.tx.pickCategory}
          value={type}
          onChange={(t) => {
            setType(t);
            setCategoryId(null);
          }}
          options={[
            { value: 'expense', label: vi.tx.expense },
            { value: 'income', label: vi.tx.income },
          ]}
        />
      </ModalHeader>

      <div
        className="no-scrollbar min-h-0 flex-1 overflow-y-auto px-3 pt-5"
        style={{ paddingBottom: categoryId ? 460 : 16 }}
      >
        {!editing && (
          <div className="mb-5 px-1">
            <ScanReceiptButton
              categories={expenseCategories ?? []}
              onManual={applyPrefill}
              onError={setScanMessage}
              onDone={goBack}
            />
          </div>
        )}
        {scanMessage && (
          <p
            role="alert"
            className="mx-1 mb-4 rounded-xl bg-[#FFF4E0] px-3 py-2.5 text-sm font-medium text-[#8A5A00]"
            data-testid="scan-message"
          >
            {scanMessage}
          </p>
        )}
        <ul className="grid grid-cols-4 gap-x-1 gap-y-5">
          {categories.map((c) => {
            const isSelected = c.id === categoryId;
            return (
              <li key={c.id}>
                <button
                  className={`flex w-full flex-col items-center gap-2 text-[13px] ${categoryId && !isSelected ? 'opacity-[0.55]' : ''} ${isSelected ? 'font-semibold' : ''}`}
                  aria-pressed={isSelected}
                  onClick={() => setCategoryId(c.id)}
                  data-testid="cat-cell"
                >
                  <span
                    className={`rounded-full ${isSelected ? 'p-[3px] outline outline-2 outline-primary' : 'p-[3px]'}`}
                  >
                    <CategoryIcon icon={c.icon} color={c.color} size={52} />
                  </span>
                  <span className="w-full truncate text-center">{c.name}</span>
                </button>
              </li>
            );
          })}
          <li>
            <button
              className="flex w-full flex-col items-center gap-2 text-[13px]"
              onClick={() => void navigate('/more/categories')}
            >
              <span className="p-[3px]">
                <span className="flex h-[52px] w-[52px] items-center justify-center rounded-full border-[1.5px] border-dashed border-[#9AA0A8] bg-white text-[#4B5563]">
                  <Pencil size={20} />
                </span>
              </span>
              <span>{vi.tx.edit}</span>
            </button>
          </li>
        </ul>
        {!categoryId && (
          <p className="mt-6 text-center text-[13px] text-muted">
            {vi.tx.scrollHint(categories.length)}
          </p>
        )}
      </div>

      {selected && (
        <section
          className="absolute inset-x-0 bottom-0 z-10 flex flex-col gap-3 rounded-t-[24px] bg-white px-4 pb-[max(var(--safe-bottom),28px)] pt-2.5 shadow-[0_-8px_30px_rgb(0_0_0/0.10)]"
          aria-label={vi.tx.amount}
        >
          <div className="h-[5px] w-10 self-center rounded-full bg-[#D5D8DE]" />
          <div className="flex items-center gap-3">
            <span
              className="flex h-9 items-center gap-2 rounded-full py-0 pl-1 pr-3 text-sm font-semibold"
              style={{ background: `${selected.color}26` }}
            >
              <CategoryIcon icon={selected.icon} color={selected.color} size={28} />
              {selected.name}
            </span>
            <div className="flex min-w-0 flex-1 flex-col items-end gap-0.5">
              {operator && (
                <span className="max-w-full truncate text-sm text-muted" data-testid="expr-display">
                  {formatExpr(expr).replace(/([+−×÷])/g, ' $1 ')}
                </span>
              )}
              <span
                className="max-w-full truncate text-[34px] font-bold leading-tight tracking-[-0.5px]"
                data-testid="amount-display"
              >
                {bigText}
              </span>
            </div>
          </div>

          <div className="flex gap-2">
            <label className="flex h-11 min-w-0 flex-1 items-center gap-2 rounded-xl bg-bg px-3 text-muted">
              <PenLine size={18} />
              <input
                value={note}
                maxLength={NOTE_MAX}
                onChange={(e) => setNote(e.target.value)}
                placeholder={vi.tx.note}
                aria-label={vi.tx.note}
                className="min-w-0 flex-1 border-0 bg-transparent text-[15px] text-ink outline-none placeholder:text-muted"
              />
            </label>
            <div className="relative">
              <button
                type="button"
                className="flex h-11 items-center gap-1.5 whitespace-nowrap rounded-xl bg-bg px-3 text-sm font-semibold"
                onClick={openDate}
                data-testid="date-button"
              >
                <Calendar size={18} className="text-primary" />
                {date === todayStr() ? vi.common.today : formatDayShort(date)}
              </button>
              <input
                ref={dateRef}
                type="date"
                value={date}
                onChange={(e) => e.target.value && setDate(e.target.value)}
                aria-label={vi.tx.date}
                tabIndex={-1}
                className="pointer-events-none absolute inset-0 h-full w-full opacity-0"
              />
            </div>
          </div>
          {error && (
            <p role="alert" className="text-sm text-danger-ink">
              {error}
            </p>
          )}
          <AmountKeypad
            expr={expr}
            onExprChange={setExpr}
            onSubmit={(v) => void save(v)}
            onError={setError}
            okDisabled={!valid}
          />
        </section>
      )}

      <ConfirmSheet
        open={confirmDelete}
        title={vi.home.deleteConfirm}
        confirmLabel={vi.common.delete}
        danger
        onCancel={() => setConfirmDelete(false)}
        onConfirm={async () => {
          setConfirmDelete(false);
          if (id) await deleteTransaction(id);
          toast(vi.home.deleted);
          goBack();
        }}
      />
    </div>
  );
}

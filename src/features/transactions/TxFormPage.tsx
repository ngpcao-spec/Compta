import { useMemo, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router';
import { Pencil, Trash2 } from 'lucide-react';
import { AmountKeypad } from '@/components/AmountKeypad';
import { CategoryIcon } from '@/components/CategoryIcon';
import { ConfirmSheet } from '@/components/ConfirmSheet';
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
import { ScreenHeader } from '@/app/layouts';
import { vi } from '@/i18n/vi';
import { todayStr } from '@/lib/dates';
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

  const [type, setType] = useState<TxType>(init.type);
  const [categoryId, setCategoryId] = useState<string | null>(init.categoryId);
  const [expr, setExpr] = useState(init.expr);
  const [note, setNote] = useState(init.note);
  const [date, setDate] = useState(init.date);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeQ = useCategories(type);
  const archivedQ = useCategories(type, true);
  const categories = useMemo(
    () => [...(activeQ ?? []), ...(archivedQ ?? []).filter((c) => c.id === categoryId)],
    [activeQ, archivedQ, categoryId],
  );

  const preview = evaluate(expr === '' ? '0' : expr);
  const value = preview.ok ? preview.value : 0;
  const valid = categoryId !== null && value > 0;

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

  return (
    <div className="flex h-full flex-col bg-bg">
      <ScreenHeader
        title={editing ? vi.tx.editTitle : vi.tx.newTitle}
        onBack={goBack}
        right={
          editing ? (
            <button
              className="tap flex items-center justify-center text-danger"
              aria-label={vi.tx.delete}
              onClick={() => setConfirmDelete(true)}
              data-testid="delete-tx"
            >
              <Trash2 size={20} />
            </button>
          ) : undefined
        }
      />
      <div className="px-4 py-3">
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
      </div>

      <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto px-2 pb-4">
        <ul className="grid grid-cols-4 gap-y-3">
          {categories.map((c) => {
            const selected = c.id === categoryId;
            return (
              <li key={c.id}>
                <button
                  className="tap flex w-full flex-col items-center gap-1 py-1"
                  aria-pressed={selected}
                  onClick={() => setCategoryId(c.id)}
                  data-testid="cat-cell"
                >
                  <span className={`rounded-full p-0.5 ${selected ? 'ring-2 ring-primary' : ''}`}>
                    <CategoryIcon icon={c.icon} color={c.color} size={48} />
                  </span>
                  <span
                    className={`w-full truncate text-center text-xs ${selected ? 'font-semibold text-link' : ''}`}
                  >
                    {c.name}
                  </span>
                </button>
              </li>
            );
          })}
          <li>
            <button
              className="tap flex w-full flex-col items-center gap-1 py-1"
              onClick={() => void navigate('/more/categories')}
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#E6E8EE] text-muted">
                <Pencil size={20} />
              </span>
              <span className="text-xs">{vi.tx.edit}</span>
            </button>
          </li>
        </ul>
      </div>

      {categoryId && (
        <section className="shrink-0 border-t border-divider bg-white" aria-label={vi.tx.amount}>
          <div className="px-4 pt-3">
            <div className="flex items-baseline justify-between gap-3">
              <span className="truncate text-3xl font-bold text-link" data-testid="amount-display">
                {expr === '' ? '0' : formatExpr(expr)}
              </span>
              {hasOperator(expr) && preview.ok && (
                <span className="shrink-0 text-sm text-muted">= {formatVnd(preview.value)}</span>
              )}
            </div>
            <div className="mt-2 flex items-center gap-2 pb-2">
              <input
                value={note}
                maxLength={NOTE_MAX}
                onChange={(e) => setNote(e.target.value)}
                placeholder={vi.tx.note}
                aria-label={vi.tx.note}
                className="min-h-[44px] min-w-0 flex-1 rounded-xl bg-bg px-3 text-sm outline-none focus:ring-2 focus:ring-primary"
              />
              <input
                type="date"
                value={date}
                onChange={(e) => e.target.value && setDate(e.target.value)}
                aria-label={vi.tx.date}
                className="min-h-[44px] rounded-xl bg-bg px-2 text-sm outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            {error && (
              <p role="alert" className="pb-1 text-sm text-danger">
                {error}
              </p>
            )}
          </div>
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

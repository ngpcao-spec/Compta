import { useState } from 'react';
import { Navigate, useParams, useSearchParams } from 'react-router';
import { CategoryIcon } from '@/components/CategoryIcon';
import { COLOR_PALETTE, ICON_NAMES, iconFor } from '@/components/icons';
import { Segmented } from '@/components/Segmented';
import { useToast } from '@/components/Toast';
import { useCategory } from '@/db/hooks';
import { CATEGORY_NAME_MAX, createCategory, updateCategory } from '@/db/repo/categories';
import type { Category, TxType } from '@/db/types';
import { ScreenHeader } from '@/app/layouts';
import { vi } from '@/i18n/vi';
import { useGoBack } from '@/lib/nav';

interface Init {
  type: TxType;
  name: string;
  icon: string;
  color: string;
}

/** Création / édition d'une catégorie (`/more/categories/new` ou `/:id`). */
export function CategoryEditPage() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const editing = id !== undefined && id !== 'new';
  const existing = useCategory(editing ? id : undefined);
  if (editing && existing === undefined) return <div className="h-full" aria-busy="true" />;
  if (editing && existing === null) return <Navigate to="/more/categories" replace />;
  const fromRow = (c: Category): Init => ({
    type: c.type,
    name: c.name,
    icon: c.icon,
    color: c.color,
  });
  const init: Init = existing
    ? fromRow(existing)
    : {
        type: params.get('type') === 'income' ? 'income' : 'expense',
        name: '',
        icon: 'tag',
        color: COLOR_PALETTE[8] ?? '#2196F3',
      };
  return <CategoryForm key={id ?? 'new'} id={editing ? id : undefined} init={init} />;
}

function CategoryForm({ id, init }: { id: string | undefined; init: Init }) {
  const editing = id !== undefined;
  const goBack = useGoBack('/more/categories');
  const toast = useToast();

  const [type, setType] = useState<TxType>(init.type);
  const [name, setName] = useState(init.name);
  const [icon, setIcon] = useState(init.icon);
  const [color, setColor] = useState<string>(init.color);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    if (name.trim() === '') {
      setError(vi.categories.nameRequired);
      return;
    }
    try {
      if (editing && id) await updateCategory(id, { name, icon, color });
      else await createCategory(type, { name, icon, color });
      toast(vi.categories.saved);
      goBack();
    } catch {
      setError(vi.login.error);
    }
  };

  return (
    <div className="flex h-full flex-col">
      <ScreenHeader
        title={editing ? vi.categories.editTitle : vi.categories.newTitle}
        onBack={goBack}
        right={
          <button
            className="tap px-2 font-semibold text-link"
            onClick={() => void save()}
            data-testid="save-category"
          >
            {vi.common.save}
          </button>
        }
      />
      <div className="no-scrollbar min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
        <div className="flex justify-center">
          <CategoryIcon icon={icon} color={color} size={72} />
        </div>

        <div className="card p-3">
          <label className="text-xs font-semibold text-muted" htmlFor="cat-name">
            {vi.categories.name}
          </label>
          <input
            id="cat-name"
            value={name}
            maxLength={CATEGORY_NAME_MAX}
            onChange={(e) => {
              setName(e.target.value);
              setError(null);
            }}
            className="mt-1 min-h-[44px] w-full bg-transparent text-base outline-none"
            autoFocus={!editing}
          />
          <div className="text-right text-xs text-muted">
            {name.length}/{CATEGORY_NAME_MAX}
          </div>
          {error && (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          )}
        </div>

        <div className="card p-3">
          <div className="mb-2 text-xs font-semibold text-muted">{vi.categories.type}</div>
          <Segmented
            value={type}
            onChange={editing ? () => undefined : setType}
            options={[
              { value: 'expense', label: vi.categories.expenseTab },
              { value: 'income', label: vi.categories.incomeTab },
            ]}
          />
        </div>

        <div className="card p-3">
          <div className="mb-2 text-xs font-semibold text-muted">{vi.categories.color}</div>
          <div
            className="grid grid-cols-8 gap-2"
            role="radiogroup"
            aria-label={vi.categories.color}
          >
            {COLOR_PALETTE.map((c) => (
              <button
                key={c}
                role="radio"
                aria-checked={c === color}
                aria-label={c}
                onClick={() => setColor(c)}
                className={`h-9 w-9 rounded-full ${c === color ? 'ring-2 ring-offset-2 ring-ink' : ''}`}
                style={{ background: c }}
              />
            ))}
          </div>
        </div>

        <div className="card p-3">
          <div className="mb-2 text-xs font-semibold text-muted">{vi.categories.icon}</div>
          <div className="grid grid-cols-6 gap-2" role="radiogroup" aria-label={vi.categories.icon}>
            {ICON_NAMES.map((n) => {
              const Icon = iconFor(n);
              const on = n === icon;
              return (
                <button
                  key={n}
                  role="radio"
                  aria-checked={on}
                  aria-label={n}
                  onClick={() => setIcon(n)}
                  className={`tap flex items-center justify-center rounded-xl ${on ? 'text-white' : 'bg-bg text-ink'}`}
                  style={on ? { background: color } : undefined}
                >
                  <Icon size={22} />
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

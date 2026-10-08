import { useState } from 'react';
import { Navigate, useParams, useSearchParams } from 'react-router';
import { CategoryIcon } from '@/components/CategoryIcon';
import { COLOR_PALETTE, ICON_NAMES, iconFor } from '@/components/icons';
import { Segmented } from '@/components/Segmented';
import { useToast } from '@/components/Toast';
import { useCategory } from '@/db/hooks';
import {
  CATEGORY_NAME_MAX,
  createCategory,
  setCategoryArchived,
  updateCategory,
} from '@/db/repo/categories';
import type { Category, TxType } from '@/db/types';
import { ModalHeader } from '@/app/layouts';
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
        color: COLOR_PALETTE[3] ?? '#1E88E5',
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
      <ModalHeader
        title={editing ? vi.categories.editTitle : vi.categories.newTitle}
        leftLabel={vi.common.cancel}
        onLeft={goBack}
        right={
          <button
            className="tap text-base font-bold text-primary"
            onClick={() => void save()}
            data-testid="save-category"
          >
            {vi.common.save}
          </button>
        }
      />
      <div className="no-scrollbar min-h-0 flex-1 space-y-3 overflow-y-auto p-4 pb-10">
        <div className="card flex items-center gap-4 p-4">
          <CategoryIcon icon={icon} color={color} size={56} />
          <div className="min-w-0 flex-1">
            <label className="text-[13px] text-muted" htmlFor="cat-name">
              {vi.categories.name} ·{' '}
              {type === 'expense' ? vi.categories.expenseTab : vi.categories.incomeTab}
            </label>
            <input
              id="cat-name"
              value={name}
              maxLength={CATEGORY_NAME_MAX}
              onChange={(e) => {
                setName(e.target.value);
                setError(null);
              }}
              className="mt-1 block min-h-[40px] w-full border-0 border-b-2 border-primary bg-transparent text-[22px] font-semibold outline-none"
              autoFocus={!editing}
            />
            {error && (
              <p role="alert" className="mt-1 text-sm text-danger-ink">
                {error}
              </p>
            )}
          </div>
        </div>

        {!editing && (
          <div className="card p-4">
            <div className="mb-2 text-base font-bold">{vi.categories.type}</div>
            <Segmented
              value={type}
              onChange={setType}
              options={[
                { value: 'expense', label: vi.categories.expenseTab },
                { value: 'income', label: vi.categories.incomeTab },
              ]}
            />
          </div>
        )}

        <div className="card p-4">
          <div className="mb-3 text-base font-bold">{vi.categories.colorTitle}</div>
          <div
            className="grid grid-cols-8 gap-x-2 gap-y-3"
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
                className={`h-8 w-8 justify-self-center rounded-full ${c === color ? 'outline outline-[3px] outline-offset-2 outline-ink' : ''}`}
                style={{ background: c }}
              />
            ))}
          </div>
        </div>

        <div className="card p-4">
          <div className="mb-3 text-base font-bold">{vi.categories.iconTitle}</div>
          <div
            className="no-scrollbar grid max-h-[176px] grid-cols-6 gap-2 overflow-y-auto"
            role="radiogroup"
            aria-label={vi.categories.icon}
          >
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
                  className={`flex h-[46px] items-center justify-center rounded-xl ${on ? 'text-white' : 'bg-bg text-ink'}`}
                  style={on ? { background: color } : undefined}
                >
                  <Icon size={22} />
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-center text-[13px] text-muted">{vi.categories.scrollIcons}</p>
        </div>

        {editing && id && (
          <button
            className="card tap w-full py-3.5 text-base font-bold text-danger-ink"
            data-testid="archive-category"
            onClick={async () => {
              await setCategoryArchived(id, true);
              goBack();
            }}
          >
            {vi.categories.archiveThis}
          </button>
        )}
      </div>
    </div>
  );
}

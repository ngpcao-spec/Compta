import { useState } from 'react';
import { useNavigate } from 'react-router';
import { ArrowUpDown, ChevronDown, ChevronLeft, Ellipsis, GripVertical, Plus } from 'lucide-react';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { BottomSheet } from '@/components/BottomSheet';
import { CategoryIcon } from '@/components/CategoryIcon';
import { Segmented } from '@/components/Segmented';
import { useCategories } from '@/db/hooks';
import { reorderCategories, setCategoryArchived } from '@/db/repo/categories';
import type { Category, TxType } from '@/db/types';
import { vi } from '@/i18n/vi';
import { useGoBack } from '@/lib/nav';

function CategoryCard({
  category,
  reorder,
  onMenu,
}: {
  category: Category;
  reorder: boolean;
  onMenu: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: category.id,
    disabled: !reorder,
  });
  return (
    <li
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 10 : undefined,
      }}
      className={`card flex items-center gap-3 px-3 py-2 ${isDragging ? 'shadow-lg' : ''}`}
      data-testid="category-card"
    >
      <CategoryIcon icon={category.icon} color={category.color} />
      <span className="min-w-0 flex-1 truncate font-medium">{category.name}</span>
      {reorder ? (
        <button
          className="tap flex touch-none items-center justify-center text-muted"
          aria-label={vi.categories.dragHandle}
          data-testid="drag-handle"
          {...attributes}
          {...listeners}
        >
          <GripVertical />
        </button>
      ) : (
        <button
          className="tap flex items-center justify-center text-muted"
          aria-label={`${vi.common.menu} ${category.name}`}
          onClick={onMenu}
        >
          <Ellipsis />
        </button>
      )}
    </li>
  );
}

export function CategoriesPage() {
  const goBack = useGoBack('/more');
  const navigate = useNavigate();
  const [type, setType] = useState<TxType>('expense');
  const [reorder, setReorder] = useState(false);
  const [menuFor, setMenuFor] = useState<Category | null>(null);
  const [showHidden, setShowHidden] = useState(false);
  const expense = useCategories('expense') ?? [];
  const income = useCategories('income') ?? [];
  const hidden = useCategories(type, true) ?? [];
  const list = type === 'expense' ? expense : income;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const from = list.findIndex((c) => c.id === active.id);
    const to = list.findIndex((c) => c.id === over.id);
    if (from < 0 || to < 0) return;
    void reorderCategories(arrayMove(list, from, to).map((c) => c.id));
  };

  return (
    <div className="flex h-full flex-col">
      <header
        className="flex items-center justify-between bg-white px-2 pt-[var(--safe-top)]"
        style={{ minHeight: 56 }}
      >
        <button className="tap flex items-center text-link" onClick={goBack}>
          <ChevronLeft size={26} />
          <span className="text-sm">{vi.tabs.more}</span>
        </button>
        <h1 className="text-base font-bold">{vi.categories.title}</h1>
        <div className="flex">
          {reorder ? (
            <button
              className="tap px-3 font-semibold text-link"
              onClick={() => setReorder(false)}
              data-testid="reorder-done"
            >
              {vi.categories.reorderDone}
            </button>
          ) : (
            <>
              <button
                className="tap flex items-center justify-center"
                aria-label={vi.categories.sort}
                onClick={() => setReorder(true)}
                data-testid="reorder-toggle"
              >
                <ArrowUpDown size={20} />
              </button>
              <button
                className="tap flex items-center justify-center text-link"
                aria-label={vi.categories.add}
                onClick={() => void navigate(`/more/categories/new?type=${type}`)}
                data-testid="add-category"
              >
                <Plus size={24} />
              </button>
            </>
          )}
        </div>
      </header>

      <div className="px-4 py-3">
        <Segmented
          value={type}
          onChange={setType}
          options={[
            { value: 'expense', label: `${vi.categories.expenseTab}(${expense.length})` },
            { value: 'income', label: `${vi.categories.incomeTab}(${income.length})` },
          ]}
        />
      </div>

      <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto px-4 pb-8">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={list.map((c) => c.id)} strategy={verticalListSortingStrategy}>
            <ul className="space-y-2">
              {list.map((c) => (
                <CategoryCard
                  key={c.id}
                  category={c}
                  reorder={reorder}
                  onMenu={() => setMenuFor(c)}
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>

        {hidden.length > 0 && !reorder && (
          <section className="mt-6">
            <button
              className="tap flex w-full items-center justify-between text-sm font-semibold text-muted"
              aria-expanded={showHidden}
              onClick={() => setShowHidden((v) => !v)}
              data-testid="hidden-toggle"
            >
              {`${vi.categories.hidden} (${hidden.length})`}
              <ChevronDown size={18} className={showHidden ? 'rotate-180' : ''} />
            </button>
            {showHidden && (
              <ul className="mt-2 space-y-2">
                {hidden.map((c) => (
                  <li key={c.id} className="card flex items-center gap-3 px-3 py-2 opacity-80">
                    <CategoryIcon icon={c.icon} color={c.color} />
                    <span className="min-w-0 flex-1 truncate">{c.name}</span>
                    <button
                      className="tap rounded-full px-3 text-sm font-semibold text-link"
                      onClick={() => void setCategoryArchived(c.id, false)}
                    >
                      {vi.categories.restore}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
      </div>

      <BottomSheet open={menuFor !== null} onClose={() => setMenuFor(null)} title={menuFor?.name}>
        <div className="px-2 pb-4">
          <button
            className="tap w-full px-4 py-3 text-left"
            onClick={() => {
              const id = menuFor?.id;
              setMenuFor(null);
              if (id) void navigate(`/more/categories/${id}`);
            }}
          >
            {vi.categories.editItem}
          </button>
          <button
            className="tap w-full px-4 py-3 text-left"
            onClick={() => {
              const id = menuFor?.id;
              setMenuFor(null);
              if (id) void setCategoryArchived(id, true);
            }}
          >
            {vi.categories.archive}
          </button>
        </div>
      </BottomSheet>
    </div>
  );
}

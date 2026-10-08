import type { Category, TxType } from '../types';
import { db } from '../local';
import { newId, nowIso, requireUserId, touched } from './common';

export const CATEGORY_NAME_MAX = 30;

export interface CategoryInput {
  name: string;
  icon: string;
  color: string;
}

function validate(input: Partial<CategoryInput>): void {
  if (input.name !== undefined) {
    const n = input.name.trim();
    if (n.length < 1 || n.length > CATEGORY_NAME_MAX) throw new Error('Tên danh mục không hợp lệ');
  }
  if (input.color !== undefined && !/^#[0-9A-Fa-f]{6}$/.test(input.color))
    throw new Error('Màu không hợp lệ');
}

export async function createCategory(type: TxType, input: CategoryInput): Promise<Category> {
  validate(input);
  const userId = await requireUserId();
  const siblings = await db.categories.where('type').equals(type).toArray();
  const next = siblings.reduce((m, c) => Math.max(m, c.sort_order), -1) + 1;
  const ts = nowIso();
  const row: Category = {
    id: newId(),
    user_id: userId,
    type,
    name: input.name.trim(),
    icon: input.icon,
    color: input.color,
    sort_order: next,
    archived: false,
    created_at: ts,
    updated_at: ts,
    deleted_at: null,
    server_updated_at: ts,
    _dirty: 1,
  };
  await db.categories.add(row);
  touched();
  return row;
}

export async function updateCategory(id: string, patch: Partial<CategoryInput>): Promise<void> {
  validate(patch);
  const clean = { ...patch, ...(patch.name !== undefined ? { name: patch.name.trim() } : {}) };
  await db.categories.update(id, { ...clean, updated_at: nowIso(), _dirty: 1 });
  touched();
}

export async function setCategoryArchived(id: string, archived: boolean): Promise<void> {
  await db.categories.update(id, { archived, updated_at: nowIso(), _dirty: 1 });
  touched();
}

/** `orderedIds` = catégories actives d'un type dans le nouvel ordre. */
export async function reorderCategories(orderedIds: readonly string[]): Promise<void> {
  const ts = nowIso();
  await db.transaction('rw', db.categories, async () => {
    for (const [index, id] of orderedIds.entries()) {
      const cur = await db.categories.get(id);
      if (cur && cur.sort_order !== index) {
        await db.categories.update(id, { sort_order: index, updated_at: ts, _dirty: 1 });
      }
    }
  });
  touched();
}

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '../local';
import { onLocalWrite } from '../events';
import {
  createCategory,
  reorderCategories,
  setCategoryArchived,
  updateCategory,
} from './categories';
import { createTransaction, deleteTransaction, updateTransaction } from './transactions';
import { applyDefaultBudget, setMonthBudget } from './budgets';
import { setHideAmounts } from './profile';
import { deterministicUuid } from './common';

const U = '11111111-1111-4111-8111-111111111111';
const palette = { icon: 'tag', color: '#112233' };

beforeEach(async () => {
  await db.wipe();
  await db.setMeta('userId', U);
  await db.profiles.add({
    id: U,
    display_name: 'A',
    avatar_url: null,
    hide_amounts: false,
    default_budget: null,
    updated_at: '2026-01-01T00:00:00.000Z',
    server_updated_at: '2026-01-01T00:00:00.000Z',
    _dirty: 0,
  });
});

describe('catégories', () => {
  it('crée à la fin, marque _dirty et notifie', async () => {
    const spy = vi.fn();
    const off = onLocalWrite(spy);
    const a = await createCategory('expense', { name: ' Ăn ', ...palette });
    const b = await createCategory('expense', { name: 'Cà phê', ...palette });
    const c = await createCategory('income', { name: 'Lương', ...palette });
    off();
    expect([a.sort_order, b.sort_order, c.sort_order]).toEqual([0, 1, 0]);
    expect(a.name).toBe('Ăn');
    expect(a._dirty).toBe(1);
    expect(spy).toHaveBeenCalledTimes(3);
  });
  it('valide nom et couleur', async () => {
    await expect(createCategory('expense', { name: '', ...palette })).rejects.toThrow();
    await expect(createCategory('expense', { name: 'x'.repeat(31), ...palette })).rejects.toThrow();
    await expect(
      createCategory('expense', { name: 'ok', icon: 'tag', color: 'red' }),
    ).rejects.toThrow();
  });
  it('renomme, réordonne, archive', async () => {
    const a = await createCategory('expense', { name: 'A', ...palette });
    const b = await createCategory('expense', { name: 'B', ...palette });
    const c = await createCategory('expense', { name: 'C', ...palette });
    await updateCategory(a.id, { name: 'A2' });
    await reorderCategories([c.id, a.id, b.id]);
    await setCategoryArchived(b.id, true);
    const rows = (await db.categories.toArray()).sort((x, y) => x.sort_order - y.sort_order);
    expect(rows.map((r) => r.name)).toEqual(['C', 'A2', 'B']);
    expect(rows.find((r) => r.id === b.id)?.archived).toBe(true);
    await setCategoryArchived(b.id, false);
    expect((await db.categories.get(b.id))?.archived).toBe(false);
  });
});

describe('transactions', () => {
  it('déduit le type de la catégorie et valide', async () => {
    const inc = await createCategory('income', { name: 'Lương', ...palette });
    const t = await createTransaction({
      categoryId: inc.id,
      amount: 38000000,
      note: '  ',
      occurredOn: '2026-01-02',
    });
    expect(t).toMatchObject({ type: 'income', note: null, user_id: U, _dirty: 1 });
    await expect(
      createTransaction({ categoryId: inc.id, amount: 0, note: '', occurredOn: '2026-01-02' }),
    ).rejects.toThrow();
    await expect(
      createTransaction({ categoryId: inc.id, amount: 1.5, note: '', occurredOn: '2026-01-02' }),
    ).rejects.toThrow();
    await expect(
      createTransaction({
        categoryId: inc.id,
        amount: 5,
        note: 'x'.repeat(101),
        occurredOn: '2026-01-02',
      }),
    ).rejects.toThrow();
    await expect(
      createTransaction({ categoryId: 'nope', amount: 5, note: '', occurredOn: '2026-01-02' }),
    ).rejects.toThrow();
  });
  it('modifie (y compris le type via la catégorie) et supprime logiquement', async () => {
    const exp = await createCategory('expense', { name: 'Ăn', ...palette });
    const inc = await createCategory('income', { name: 'Lương', ...palette });
    const t = await createTransaction({
      categoryId: exp.id,
      amount: 100,
      note: 'a',
      occurredOn: '2026-01-02',
    });
    await updateTransaction(t.id, {
      categoryId: inc.id,
      amount: 200,
      note: 'b',
      occurredOn: '2026-01-03',
    });
    expect(await db.transactions.get(t.id)).toMatchObject({
      type: 'income',
      amount: 200,
      note: 'b',
      occurred_on: '2026-01-03',
    });
    await deleteTransaction(t.id);
    const row = await db.transactions.get(t.id);
    expect(row?.deleted_at).not.toBeNull();
    expect(row?._dirty).toBe(1);
  });
});

describe('budgets', () => {
  it('identifiant déterministe par utilisateur et mois', async () => {
    const a = await deterministicUuid(`${U}:2026-01-01`);
    expect(a).toBe(await deterministicUuid(`${U}:2026-01-01`));
    expect(a).not.toBe(await deterministicUuid(`${U}:2026-02-01`));
    expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });
  it('crée, met à jour, supprime (0) et ressuscite la même ligne', async () => {
    await setMonthBudget('2026-01-15', 18000000);
    let rows = await db.budgets.toArray();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ month: '2026-01-01', amount: 18000000, deleted_at: null });
    await setMonthBudget('2026-01-01', 20000000);
    await setMonthBudget('2026-01-01', 0);
    rows = await db.budgets.toArray();
    expect(rows).toHaveLength(1);
    expect(rows[0]?.deleted_at).not.toBeNull();
    await setMonthBudget('2026-01-01', 5);
    rows = await db.budgets.toArray();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ amount: 5, deleted_at: null });
  });
  it('« tháng sau » met à jour le défaut du profil et efface l’exception du mois', async () => {
    await setMonthBudget('2026-02-01', 1);
    await applyDefaultBudget('2026-02-01', 20000000);
    expect((await db.profiles.get(U))?.default_budget).toBe(20000000);
    expect((await db.budgets.toArray())[0]?.deleted_at).not.toBeNull();
    await applyDefaultBudget('2026-02-01', 0);
    expect((await db.profiles.get(U))?.default_budget).toBeNull();
  });
});

describe('profil', () => {
  it('bascule le masquage', async () => {
    await setHideAmounts(true);
    expect(await db.profiles.get(U)).toMatchObject({ hide_amounts: true, _dirty: 1 });
  });
});

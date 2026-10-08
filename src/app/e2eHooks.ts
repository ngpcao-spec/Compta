import { db } from '@/db/local';
import { setMonthBudget } from '@/db/repo/budgets';
import { createTransaction } from '@/db/repo/transactions';
import { DEMO_BUDGET, DEMO_TXS } from '@/sync/demoData';
import { currentEngine } from '@/sync/runtime';

/** Crochets réservés aux tests e2e (VITE_E2E=1), chargés dynamiquement par main.tsx. */
async function seedDemo(): Promise<void> {
  const cats = await db.categories.toArray();
  for (const t of DEMO_TXS) {
    const c = cats.find((x) => x.name === t.category && x.type === t.type && !x.deleted_at);
    if (!c) throw new Error(`catégorie introuvable : ${t.category}`);
    await createTransaction({
      categoryId: c.id,
      amount: t.amount,
      note: t.note ?? '',
      occurredOn: t.date,
    });
  }
  await setMonthBudget(DEMO_BUDGET.month, DEMO_BUDGET.amount);
}

export function installE2EHooks(): void {
  (window as unknown as { __stc: unknown }).__stc = {
    seedDemo,
    syncNow: async () => currentEngine()?.syncNow(),
    pending: () => db.countPending(),
  };
}

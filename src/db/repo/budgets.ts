import { db } from '../local';
import { monthStart } from '@/lib/dates';
import { deterministicUuid, nowIso, requireUserId, touched } from './common';

/**
 * Définit (ou supprime si 0) le budget d'une exception de mois.
 * Identifiant déterministe par (utilisateur, mois) : deux appareils ne peuvent pas créer
 * deux lignes pour le même mois (contrainte unique côté serveur).
 */
export async function setMonthBudget(month: string, amount: number): Promise<void> {
  if (!Number.isInteger(amount) || amount < 0) throw new Error('Ngân sách không hợp lệ');
  const userId = await requireUserId();
  const m = monthStart(month);
  const id = await deterministicUuid(`${userId}:${m}`);
  const ts = nowIso();
  const cur = await db.budgets.get(id);
  if (amount === 0) {
    if (cur && !cur.deleted_at)
      await db.budgets.update(id, { deleted_at: ts, updated_at: ts, _dirty: 1 });
  } else if (cur) {
    await db.budgets.update(id, { amount, deleted_at: null, updated_at: ts, _dirty: 1 });
  } else {
    await db.budgets.add({
      id,
      user_id: userId,
      month: m,
      amount,
      updated_at: ts,
      deleted_at: null,
      server_updated_at: ts,
      _dirty: 1,
    });
  }
  touched();
}

/** « Áp dụng cho các tháng sau » : met à jour le budget par défaut du profil et efface l'exception du mois. */
export async function applyDefaultBudget(month: string, amount: number): Promise<void> {
  const userId = await requireUserId();
  const ts = nowIso();
  // L'identifiant est calculé hors transaction : crypto.subtle n'est pas une promesse Dexie.
  const id = await deterministicUuid(`${userId}:${monthStart(month)}`);
  await db.transaction('rw', db.profiles, db.budgets, async () => {
    await db.profiles.update(userId, {
      default_budget: amount > 0 ? amount : null,
      updated_at: ts,
      _dirty: 1,
    });
    const cur = await db.budgets.get(id);
    if (cur && !cur.deleted_at)
      await db.budgets.update(id, { deleted_at: ts, updated_at: ts, _dirty: 1 });
  });
  touched();
}

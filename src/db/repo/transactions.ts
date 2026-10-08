import type { Transaction } from '../types';
import { db } from '../local';
import { newId, nowIso, requireUserId, touched } from './common';

export const NOTE_MAX = 100;
export const MAX_AMOUNT = 9_999_999_999_999;

export interface TransactionInput {
  categoryId: string;
  amount: number;
  note: string;
  occurredOn: string;
}

async function checked(input: TransactionInput) {
  if (!Number.isInteger(input.amount) || input.amount <= 0 || input.amount > MAX_AMOUNT) {
    throw new Error('Số tiền không hợp lệ');
  }
  if (input.note.length > NOTE_MAX) throw new Error('Ghi chú quá dài');
  const cat = await db.categories.get(input.categoryId);
  if (!cat) throw new Error('Danh mục không tồn tại');
  return cat;
}

export async function createTransaction(input: TransactionInput): Promise<Transaction> {
  const cat = await checked(input);
  const userId = await requireUserId();
  const ts = nowIso();
  const row: Transaction = {
    id: newId(),
    user_id: userId,
    category_id: cat.id,
    type: cat.type,
    amount: input.amount,
    note: input.note.trim() === '' ? null : input.note.trim(),
    occurred_on: input.occurredOn,
    created_at: ts,
    updated_at: ts,
    deleted_at: null,
    server_updated_at: ts,
    _dirty: 1,
  };
  await db.transactions.add(row);
  touched();
  return row;
}

export async function updateTransaction(id: string, input: TransactionInput): Promise<void> {
  const cat = await checked(input);
  await db.transactions.update(id, {
    category_id: cat.id,
    type: cat.type,
    amount: input.amount,
    note: input.note.trim() === '' ? null : input.note.trim(),
    occurred_on: input.occurredOn,
    updated_at: nowIso(),
    _dirty: 1,
  });
  touched();
}

/** Suppression logique uniquement. */
export async function deleteTransaction(id: string): Promise<void> {
  const ts = nowIso();
  await db.transactions.update(id, { deleted_at: ts, updated_at: ts, _dirty: 1 });
  touched();
}

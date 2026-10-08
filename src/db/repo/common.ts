import { db } from '../local';
import { emitLocalWrite } from '../events';

export const nowIso = (): string => new Date().toISOString();
export const newId = (): string => crypto.randomUUID();

export async function requireUserId(): Promise<string> {
  const id = await db.getMeta('userId');
  if (!id) throw new Error('Aucun utilisateur connecté');
  return id;
}

export function touched(): void {
  emitLocalWrite();
}

export { deterministicUuid } from '@/lib/uuid';

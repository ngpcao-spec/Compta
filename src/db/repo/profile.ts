import { db } from '../local';
import { nowIso, requireUserId, touched } from './common';

export async function setHideAmounts(hide: boolean): Promise<void> {
  const userId = await requireUserId();
  await db.profiles.update(userId, { hide_amounts: hide, updated_at: nowIso(), _dirty: 1 });
  touched();
}

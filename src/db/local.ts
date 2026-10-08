import Dexie, { type EntityTable } from 'dexie';
import type { Budget, Category, Profile, Transaction } from './types';

export interface MetaRow {
  key: string;
  value: string;
}

export class LocalDb extends Dexie {
  profiles!: EntityTable<Profile, 'id'>;
  categories!: EntityTable<Category, 'id'>;
  transactions!: EntityTable<Transaction, 'id'>;
  budgets!: EntityTable<Budget, 'id'>;
  meta!: EntityTable<MetaRow, 'key'>;

  constructor(name = 'so-thu-chi') {
    super(name);
    // IndexedDB ne peut pas indexer `null` : l'index composé [deleted_at+occurred_on] de la spec
    // exclurait toutes les lignes actives ; on indexe occurred_on et on filtre deleted_at.
    this.version(1).stores({
      profiles: 'id, _dirty',
      categories: 'id, type, sort_order, _dirty',
      transactions: 'id, occurred_on, category_id, _dirty',
      budgets: 'id, month, _dirty',
      meta: 'key',
    });
  }

  /** Vide toutes les données (déconnexion / changement d'utilisateur). */
  async wipe(): Promise<void> {
    await this.transaction(
      'rw',
      [this.profiles, this.categories, this.transactions, this.budgets, this.meta],
      async () => {
        await Promise.all([
          this.profiles.clear(),
          this.categories.clear(),
          this.transactions.clear(),
          this.budgets.clear(),
          this.meta.clear(),
        ]);
      },
    );
  }

  async getMeta(key: string): Promise<string | undefined> {
    return (await this.meta.get(key))?.value;
  }
  async setMeta(key: string, value: string): Promise<void> {
    await this.meta.put({ key, value });
  }

  async countPending(): Promise<number> {
    const counts = await Promise.all([
      this.profiles.where('_dirty').equals(1).count(),
      this.categories.where('_dirty').equals(1).count(),
      this.budgets.where('_dirty').equals(1).count(),
      this.transactions.where('_dirty').equals(1).count(),
    ]);
    return counts.reduce((a, b) => a + b, 0);
  }
}

export const db = new LocalDb();

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LocalDb } from '@/db/local';
import type { Category, Transaction } from '@/db/types';
import { createSyncEngine } from './engine';
import { createFakeServer, type FakeServer } from './fakeTransport';
import { createStatusStore } from './status';
import type { SyncTransport } from './transport';

const U = '11111111-1111-4111-8111-111111111111';
let n = 0;
let db: LocalDb;
let server: FakeServer;

const cat = (id: string, over: Partial<Category> = {}): Category => ({
  id,
  user_id: U,
  type: 'expense',
  name: id,
  icon: 'tag',
  color: '#112233',
  sort_order: 0,
  archived: false,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
  deleted_at: null,
  server_updated_at: '2026-01-01T00:00:00.000Z',
  _dirty: 1,
  ...over,
});
const tx = (id: string, categoryId: string, over: Partial<Transaction> = {}): Transaction => ({
  id,
  user_id: U,
  category_id: categoryId,
  type: 'expense',
  amount: 1000,
  note: null,
  occurred_on: '2026-01-02',
  created_at: '2026-01-02T00:00:00.000Z',
  updated_at: '2026-01-02T00:00:00.000Z',
  deleted_at: null,
  server_updated_at: '2026-01-02T00:00:00.000Z',
  _dirty: 1,
  ...over,
});
const uid = (i: number) => `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`;

function engine(
  opts: { transport?: SyncTransport; refreshAuth?: () => Promise<boolean>; online?: boolean } = {},
) {
  const status = createStatusStore();
  const eng = createSyncEngine({
    db,
    transport: opts.transport ?? server,
    refreshAuth: opts.refreshAuth ?? (async () => false),
    status,
    isOnline: () => opts.online ?? true,
    now: () => new Date('2026-03-01T08:20:00.000Z'),
  });
  return { eng, status };
}

beforeEach(() => {
  db = new LocalDb(`test-${++n}`);
  server = createFakeServer({ isOnline: () => true });
});

describe('push', () => {
  it('pousse catégories avant transactions et efface _dirty', async () => {
    await db.categories.add(cat('c1'));
    await db.transactions.add(tx('t1', 'c1'));
    const order: string[] = [];
    const spy: SyncTransport = {
      pull: server.pull,
      upsert: async (t, r) => {
        order.push(t);
        await server.upsert(t, r);
      },
    };
    const { eng, status } = engine({ transport: spy });
    expect(await eng.syncNow()).toBe('ok');
    expect(order).toEqual(['categories', 'transactions']);
    expect((await db.categories.get('c1'))?._dirty).toBe(0);
    expect((await db.transactions.get('t1'))?._dirty).toBe(0);
    expect(server.rows('transactions')).toHaveLength(1);
    expect(status.get()).toMatchObject({
      state: 'idle',
      pending: 0,
      lastSyncAt: '2026-03-01T08:20:00.000Z',
    });
  });

  it('n’envoie rien quand tout est synchronisé', async () => {
    await db.categories.add(cat('c1'));
    const { eng } = engine();
    await eng.syncNow();
    const before = server.calls.upsert;
    await eng.syncNow();
    expect(server.calls.upsert).toBe(before);
  });

  it('découpe en lots de 200', async () => {
    await db.categories.add(cat('c1'));
    await db.transactions.bulkAdd(Array.from({ length: 450 }, (_, i) => tx(uid(i + 1), 'c1')));
    const { eng } = engine();
    await eng.syncNow();
    // 1 appel catégories + 3 appels transactions
    expect(server.calls.upsert).toBe(4);
    expect(server.rows('transactions')).toHaveLength(450);
  });

  it('garde _dirty si la ligne a changé pendant l’envoi', async () => {
    await db.categories.add(cat('c1'));
    const racing: SyncTransport = {
      pull: server.pull,
      upsert: async (t, r) => {
        await server.upsert(t, r);
        if (t === 'categories')
          await db.categories.update('c1', {
            name: 'edited',
            updated_at: '2026-02-01T00:00:00.000Z',
            _dirty: 1,
          });
      },
    };
    await engine({ transport: racing }).eng.syncNow();
    expect((await db.categories.get('c1'))?._dirty).toBe(1);
    await engine().eng.syncNow();
    expect(server.rows('categories').find((c) => c.id === 'c1')?.name).toBe('edited');
    expect((await db.categories.get('c1'))?._dirty).toBe(0);
  });
});

describe('pull', () => {
  it('récupère profil et 40 catégories au premier lancement puis seulement les nouveautés', async () => {
    server.signUp(U, 'Alice');
    const { eng } = engine();
    expect(await eng.initialPull()).toBe('ok');
    expect(await db.categories.count()).toBe(40);
    expect((await db.profiles.get(U))?.display_name).toBe('Alice');
    expect(await db.categories.where('_dirty').equals(1).count()).toBe(0);

    await server.upsert('categories', [{ ...cat('serverCat'), _dirty: undefined } as never]);
    await eng.syncNow();
    expect(await db.categories.count()).toBe(41);
  });

  it('pagine au-delà de 1000 lignes', async () => {
    await server.upsert(
      'categories',
      Array.from({ length: 1500 }, (_, i) => ({ ...cat(uid(i + 1)), _dirty: undefined })) as never,
    );
    const { eng } = engine();
    await eng.initialPull();
    expect(await db.categories.count()).toBe(1500);
  });

  it('reçoit les suppressions logiques', async () => {
    await db.categories.add(cat('c1', { _dirty: 0 }));
    await server.upsert('categories', [
      {
        ...cat('c1'),
        updated_at: '2026-02-01T00:00:00.000Z',
        deleted_at: '2026-02-01T00:00:00.000Z',
        _dirty: undefined,
      },
    ] as never);
    await engine().eng.syncNow();
    expect((await db.categories.get('c1'))?.deleted_at).not.toBeNull();
  });
});

describe('conflits (dernier écrit gagne)', () => {
  it('la modification locale plus récente l’emporte', async () => {
    await server.upsert('categories', [
      {
        ...cat('c1', { name: 'serveur' }),
        updated_at: '2026-02-01T00:00:00.000Z',
        _dirty: undefined,
      },
    ] as never);
    await db.categories.add(cat('c1', { name: 'local', updated_at: '2026-02-02T00:00:00.000Z' }));
    await engine().eng.syncNow();
    expect((await db.categories.get('c1'))?.name).toBe('local');
    expect(server.rows('categories')[0]?.name).toBe('local');
  });

  it('la version serveur plus récente écrase la ligne locale', async () => {
    await server.upsert('categories', [
      {
        ...cat('c1', { name: 'serveur' }),
        updated_at: '2026-02-05T00:00:00.000Z',
        _dirty: undefined,
      },
    ] as never);
    await db.categories.add(cat('c1', { name: 'local', updated_at: '2026-02-02T00:00:00.000Z' }));
    await engine().eng.syncNow();
    expect((await db.categories.get('c1'))?.name).toBe('serveur');
    expect((await db.categories.get('c1'))?._dirty).toBe(0);
    expect(server.rows('categories')[0]?.name).toBe('serveur');
  });
});

describe('erreurs et reprise', () => {
  it('erreur réseau : données gardées, reprise au déclencheur suivant', async () => {
    await db.categories.add(cat('c1'));
    const { eng, status } = engine();
    server.failNext('network');
    expect(await eng.syncNow()).toBe('offline');
    expect(status.get()).toMatchObject({ state: 'offline', pending: 1 });
    expect(await db.categories.get('c1')).toBeDefined();
    expect(await eng.syncNow()).toBe('ok');
    expect(status.get()).toMatchObject({ state: 'idle', pending: 0 });
    expect(server.rows('categories')).toHaveLength(1);
  });

  it('erreur serveur : état error, puis reprise', async () => {
    await db.categories.add(cat('c1'));
    const { eng, status } = engine();
    server.failNext('server');
    expect(await eng.syncNow()).toBe('error');
    expect(status.get().state).toBe('error');
    expect(await eng.syncNow()).toBe('ok');
  });

  it('401 : rafraîchit la session puis réessaie', async () => {
    await db.categories.add(cat('c1'));
    const refresh = vi.fn(async () => true);
    const { eng } = engine({ refreshAuth: refresh });
    server.failNext('auth');
    expect(await eng.syncNow()).toBe('ok');
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(server.rows('categories')).toHaveLength(1);
  });

  it('401 non récupérable : bandeau, rien n’est effacé', async () => {
    await db.categories.add(cat('c1'));
    const { eng, status } = engine({ refreshAuth: async () => false });
    server.failNext('auth', 5);
    expect(await eng.syncNow()).toBe('auth');
    expect(status.get()).toMatchObject({ authExpired: true, state: 'error', pending: 1 });
    expect((await db.categories.get('c1'))?._dirty).toBe(1);
  });

  it('hors ligne : aucun appel réseau', async () => {
    await db.categories.add(cat('c1'));
    const { eng, status } = engine({ online: false });
    expect(await eng.syncNow()).toBe('offline');
    expect(server.calls).toEqual({ upsert: 0, pull: 0 });
    expect(status.get()).toMatchObject({ state: 'offline', pending: 1 });
  });
});

describe('verrou', () => {
  it('une seule synchro à la fois (promesse partagée)', async () => {
    await db.categories.add(cat('c1'));
    const { eng } = engine();
    const [a, b] = await Promise.all([eng.syncNow(), eng.syncNow()]);
    expect([a, b]).toEqual(['ok', 'ok']);
    expect(server.calls.upsert).toBe(1);
  });
});

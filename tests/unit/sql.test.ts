// @vitest-environment node
import { readdirSync, readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { beforeAll, describe, expect, it } from 'vitest';
import { DEFAULT_CATEGORIES } from '../../src/sync/defaultCategories';

const migrationsDir = new URL('../../supabase/migrations/', import.meta.url);
// Toutes les migrations, dans l'ordre des fichiers.
const migrations = readdirSync(migrationsDir)
  .filter((f) => f.endsWith('.sql'))
  .sort()
  .map((f) => readFileSync(new URL(f, migrationsDir), 'utf8'));

const A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

let db: PGlite;

async function as(user: string | null) {
  await db.exec('reset role');
  if (user) {
    await db.exec(
      `set role authenticated; select set_config('request.jwt.claim.sub', '${user}', false)`,
    );
  } else {
    await db.exec(`set role anon; select set_config('request.jwt.claim.sub', '', false)`);
  }
}

async function catId(user: string, type: 'expense' | 'income', name: string): Promise<string> {
  await db.exec('reset role');
  const r = await db.query<{ id: string }>(
    'select id from categories where user_id=$1 and type=$2 and name=$3',
    [user, type, name],
  );
  const id = r.rows[0]?.id;
  if (!id) throw new Error('category not found');
  return id;
}

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create schema auth;
    create table auth.users (id uuid primary key, raw_user_meta_data jsonb);
    create function auth.uid() returns uuid language sql stable
      as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema public, auth to anon, authenticated;
    grant execute on function auth.uid() to anon, authenticated;
  `);
  for (const m of migrations) await db.exec(m);
  await db.exec(
    `insert into auth.users values ('${A}', '{"full_name":"Alice","avatar_url":"https://x/a.png"}'), ('${B}', '{}')`,
  );
});

describe('inscription', () => {
  it('crée le profil et 35 + 5 catégories', async () => {
    await db.exec('reset role');
    const prof = await db.query<{ display_name: string; avatar_url: string }>(
      'select * from profiles where id=$1',
      [A],
    );
    expect(prof.rows[0]).toMatchObject({ display_name: 'Alice', avatar_url: 'https://x/a.png' });
    const counts = await db.query<{ type: string; n: number }>(
      'select type, count(*)::int n from categories where user_id=$1 group by type order by type',
      [A],
    );
    expect(counts.rows).toEqual([
      { type: 'expense', n: 35 },
      { type: 'income', n: 5 },
    ]);
  });
  it('numérote sort_order de 0 à n par type et reprend la liste de SPEC §4', async () => {
    await db.exec('reset role');
    const r = await db.query<{
      type: string;
      name: string;
      icon: string;
      color: string;
      sort_order: number;
    }>(
      'select type, name, icon, color, sort_order from categories where user_id=$1 order by type, sort_order',
      [A],
    );
    const expected = DEFAULT_CATEGORIES.map((c) => ({ ...c }));
    for (const t of ['expense', 'income'] as const) {
      const rows = r.rows.filter((x) => x.type === t);
      expect(rows.map((x) => x.sort_order)).toEqual(rows.map((_, i) => i));
      expect(rows.map(({ type, name, icon, color }) => ({ type, name, icon, color }))).toEqual(
        expected.filter((c) => c.type === t),
      );
    }
  });
});

describe('RLS', () => {
  it('un utilisateur ne voit pas les données d’un autre', async () => {
    const cat = await catId(A, 'expense', 'Ăn uống');
    await as(A);
    await db.query(
      `insert into transactions (id, user_id, category_id, type, amount, occurred_on) values ($1,$2,$3,'expense',1200000,'2026-01-02')`,
      [uuid(1), A, cat],
    );
    expect((await db.query('select * from transactions')).rows).toHaveLength(1);
    expect((await db.query('select * from categories')).rows).toHaveLength(40);

    await as(B);
    expect((await db.query('select * from transactions')).rows).toHaveLength(0);
    expect((await db.query('select * from categories')).rows).toHaveLength(40);
    expect((await db.query('select * from categories where user_id=$1', [A])).rows).toHaveLength(0);
    expect((await db.query('select * from profiles')).rows).toHaveLength(1);
  });
  it('refuse d’écrire pour un autre utilisateur', async () => {
    const catB = await catId(B, 'expense', 'Ăn uống');
    await as(A);
    await expect(
      db.query(`insert into budgets (id, user_id, month, amount) values ($1,$2,'2026-01-01',5)`, [
        uuid(50),
        B,
      ]),
    ).rejects.toThrow();
    await expect(
      db.query(
        `insert into transactions (id,user_id,category_id,type,amount,occurred_on) values ($1,$2,$3,'expense',1,'2026-01-01')`,
        [uuid(51), B, catB],
      ),
    ).rejects.toThrow();
  });
  it('un upsert ne peut pas écraser la ligne d’un autre', async () => {
    await as(B);
    await expect(
      db.query(
        `insert into budgets (id, user_id, month, amount) values ($1,$2,'2026-01-01',5)
         on conflict (id) do update set amount = excluded.amount`,
        [uuid(60), B],
      ),
    ).resolves.toBeDefined();
    await as(A);
    await expect(
      db.query(
        `insert into budgets (id, user_id, month, amount) values ($1,$2,'2026-01-01',9)
         on conflict (id) do update set amount = excluded.amount, user_id = excluded.user_id`,
        [uuid(60), A],
      ),
    ).rejects.toThrow();
  });
  it('interdit DELETE et l’accès anonyme', async () => {
    await as(A);
    await expect(db.query('delete from transactions')).rejects.toThrow(/permission denied/);
    await as(null);
    await expect(db.query('select * from transactions')).rejects.toThrow(/permission denied/);
  });
  it('un update visant la ligne d’un autre ne modifie rien', async () => {
    await as(B);
    const r = await db.query(`update transactions set amount = 1 where id = $1 returning id`, [
      uuid(1),
    ]);
    expect(r.rows).toHaveLength(0);
  });
});

describe('triggers', () => {
  it('dernier écrit gagne et server_updated_at avance', async () => {
    const cat = await catId(A, 'expense', 'Cà phê');
    await as(A);
    await db.query(
      `insert into transactions (id,user_id,category_id,type,amount,occurred_on,updated_at) values ($1,$2,$3,'expense',100,'2026-02-01','2026-02-01T10:00:00Z')`,
      [uuid(2), A, cat],
    );
    const first = (
      await db.query<{ s: string }>(
        'select server_updated_at::text s from transactions where id=$1',
        [uuid(2)],
      )
    ).rows[0]?.s;

    await db.query(
      `update transactions set amount=50, updated_at='2026-02-01T09:00:00Z' where id=$1`,
      [uuid(2)],
    );
    let row = (
      await db.query<{ amount: string; s: string }>(
        'select amount, server_updated_at::text s from transactions where id=$1',
        [uuid(2)],
      )
    ).rows[0];
    expect(Number(row?.amount)).toBe(100); // l'écriture plus ancienne est ignorée
    expect(row?.s).not.toBe(first);

    await db.query(
      `update transactions set amount=300, updated_at='2026-02-01T11:00:00Z' where id=$1`,
      [uuid(2)],
    );
    row = (
      await db.query<{ amount: string; s: string }>(
        'select amount, server_updated_at::text s from transactions where id=$1',
        [uuid(2)],
      )
    ).rows[0];
    expect(Number(row?.amount)).toBe(300);
  });
  it('le type de transaction doit égaler celui de la catégorie', async () => {
    const cat = await catId(A, 'expense', 'Game');
    await as(A);
    await expect(
      db.query(
        `insert into transactions (id,user_id,category_id,type,amount,occurred_on) values ($1,$2,$3,'income',1,'2026-01-01')`,
        [uuid(3), A, cat],
      ),
    ).rejects.toThrow(/match/);
  });
  it('la catégorie doit appartenir au même utilisateur', async () => {
    const catB = await catId(B, 'expense', 'Game');
    await as(A);
    await expect(
      db.query(
        `insert into transactions (id,user_id,category_id,type,amount,occurred_on) values ($1,$2,$3,'expense',1,'2026-01-01')`,
        [uuid(4), A, catB],
      ),
    ).rejects.toThrow();
  });
});

describe('contraintes', () => {
  it('valide montant, note, couleur, mois de budget', async () => {
    const cat = await catId(A, 'expense', 'Thuế');
    await as(A);
    const ins = (id: number, amount: number, note: string | null) =>
      db.query(
        `insert into transactions (id,user_id,category_id,type,amount,note,occurred_on) values ($1,$2,$3,'expense',$4,$5,'2026-01-01')`,
        [uuid(id), A, cat, amount, note],
      );
    await expect(ins(70, 0, null)).rejects.toThrow();
    await expect(ins(71, 10000000000000, null)).rejects.toThrow();
    await expect(ins(72, 5, 'x'.repeat(101))).rejects.toThrow();
    await expect(ins(73, 9999999999999, 'x'.repeat(100))).resolves.toBeDefined();
    await expect(
      db.query(
        `insert into categories (id,user_id,type,name,icon,color) values ($1,$2,'expense','X','tag','red')`,
        [uuid(74), A],
      ),
    ).rejects.toThrow();
    await expect(
      db.query(`insert into budgets (id,user_id,month,amount) values ($1,$2,'2026-01-15',5)`, [
        uuid(75),
        A,
      ]),
    ).rejects.toThrow();
    await db.query(`insert into budgets (id,user_id,month,amount) values ($1,$2,'2026-03-01',5)`, [
      uuid(76),
      A,
    ]);
    await expect(
      db.query(`insert into budgets (id,user_id,month,amount) values ($1,$2,'2026-03-01',6)`, [
        uuid(77),
        A,
      ]),
    ).rejects.toThrow();
  });
  it('la suppression d’un utilisateur efface tout (cascade)', async () => {
    await db.exec('reset role');
    await db.query('delete from auth.users where id=$1', [B]);
    for (const t of ['profiles', 'categories', 'budgets', 'transactions']) {
      const col = t === 'profiles' ? 'id' : 'user_id';
      const r = await db.query<{ n: number }>(`select count(*)::int n from ${t} where ${col}=$1`, [
        B,
      ]);
      expect(r.rows[0]?.n).toBe(0);
    }
  });
});

describe('receipt_scans (quota des scans de factures)', () => {
  const insertScan = (user: string, at: string) =>
    db.query('insert into receipt_scans (user_id, created_at) values ($1, $2)', [user, at]);

  it('chaque utilisateur ne lit que ses scans, sans pouvoir écrire', async () => {
    await db.exec('reset role');
    await insertScan(A, '2026-10-08T01:00:00Z'); // écriture « service » (rôle propriétaire)
    await insertScan(A, '2026-10-08T02:00:00Z');
    await as(A);
    expect((await db.query('select * from receipt_scans')).rows).toHaveLength(2);
    await expect(insertScan(A, '2026-10-08T03:00:00Z')).rejects.toThrow(/permission denied/);
    await expect(db.query('update receipt_scans set created_at = now()')).rejects.toThrow(
      /permission denied/,
    );
    await expect(db.query('delete from receipt_scans')).rejects.toThrow(/permission denied/);
  });

  it('un autre utilisateur ne voit rien ; l’accès anonyme est refusé', async () => {
    await db.exec('reset role');
    await db.exec(`insert into auth.users values ('cccccccc-cccc-4ccc-8ccc-cccccccccccc', '{}')`);
    await as('cccccccc-cccc-4ccc-8ccc-cccccccccccc');
    expect((await db.query('select * from receipt_scans')).rows).toHaveLength(0);
    await as(null);
    await expect(db.query('select * from receipt_scans')).rejects.toThrow(/permission denied/);
  });

  it('ne contient que user_id et created_at, et disparaît avec le compte', async () => {
    await db.exec('reset role');
    const cols = await db.query<{ column_name: string }>(
      `select column_name from information_schema.columns where table_name = 'receipt_scans' order by ordinal_position`,
    );
    expect(cols.rows.map((c) => c.column_name)).toEqual(['user_id', 'created_at']);
    await db.query('delete from auth.users where id = $1', [A]);
    expect(
      (await db.query('select * from receipt_scans where user_id = $1', [A])).rows,
    ).toHaveLength(0);
  });
});

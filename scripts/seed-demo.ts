/**
 * Peuple le compte de test avec le jeu de démonstration (SPEC §12).
 * Usage : SUPABASE_URL=… SUPABASE_ANON_KEY=… npm run seed:demo
 * (compte par défaut : celui de supabase/seed.sql ; TEST_EMAIL / TEST_PASSWORD pour en changer)
 */
import { createClient } from '@supabase/supabase-js';
import { DEMO_BUDGET, DEMO_TXS } from '../src/sync/demoData';
import { deterministicUuid } from '../src/lib/uuid';

const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? 'http://127.0.0.1:54321';
const key = process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY;
if (!key) throw new Error('SUPABASE_ANON_KEY (ou VITE_SUPABASE_ANON_KEY) est requis');

const supabase = createClient(url, key, { auth: { persistSession: false } });

const { data: auth, error: authError } = await supabase.auth.signInWithPassword({
  email: process.env.TEST_EMAIL ?? 'test@sothuchi.local',
  password: process.env.TEST_PASSWORD ?? 'test-password-123',
});
if (authError || !auth.user) throw authError ?? new Error('connexion impossible');
const userId = auth.user.id;

const { data: cats, error: catError } = await supabase
  .from('categories')
  .select('id,name,type')
  .eq('user_id', userId);
if (catError) throw catError;

const now = new Date().toISOString();
const rows = DEMO_TXS.map((t) => {
  const cat = cats.find((c) => c.name === t.category && c.type === t.type);
  if (!cat) throw new Error(`catégorie introuvable : ${t.category}`);
  return {
    id: crypto.randomUUID(),
    user_id: userId,
    category_id: cat.id,
    type: t.type,
    amount: t.amount,
    note: t.note ?? null,
    occurred_on: t.date,
    updated_at: now,
  };
});

const { error: txError } = await supabase.from('transactions').insert(rows);
if (txError) throw txError;

const { error: budgetError } = await supabase.from('budgets').upsert({
  id: await deterministicUuid(`${userId}:${DEMO_BUDGET.month}`),
  user_id: userId,
  month: DEMO_BUDGET.month,
  amount: DEMO_BUDGET.amount,
  updated_at: now,
});
if (budgetError) throw budgetError;

console.log(`OK : ${rows.length} transactions et le budget de janvier 2026 ajoutés.`);

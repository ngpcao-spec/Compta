// Edge Function `scan-receipt` (SPEC §3.10) : lit une facture avec l'API OpenAI.
// La clé OPENAI_API_KEY reste côté serveur ; l'image n'est ni stockée ni journalisée.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { handleScan } from './handler.ts';

const admin = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  {
    auth: { persistSession: false, autoRefreshToken: false },
  },
);

Deno.serve((req) =>
  handleScan(req, {
    env: {
      OPENAI_API_KEY: Deno.env.get('OPENAI_API_KEY'),
      OPENAI_MODEL: Deno.env.get('OPENAI_MODEL'),
      OPENAI_REASONING_EFFORT: Deno.env.get('OPENAI_REASONING_EFFORT'),
    },
    now: () => new Date(),
    async getUserId(token) {
      const { data, error } = await admin.auth.getUser(token);
      return error || !data.user ? null : data.user.id;
    },
    async countRecentScans(userId, sinceIso) {
      const { count, error } = await admin
        .from('receipt_scans')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .gte('created_at', sinceIso);
      if (error) throw new Error('quota_check_failed');
      return count ?? 0;
    },
    async recordScan(userId) {
      const { error } = await admin.from('receipt_scans').insert({ user_id: userId });
      if (error) throw new Error('quota_record_failed');
    },
    fetchOpenAI: (url, init) => fetch(url, init),
  }),
);

-- Quota de scans de factures (SPEC §3.10) : un enregistrement par scan, rien d'autre.
-- Aucune donnée de la facture n'est conservée : seulement qui a scanné, et quand.
create table public.receipt_scans (
  user_id uuid not null references auth.users on delete cascade,
  created_at timestamptz not null default clock_timestamp(),
  primary key (user_id, created_at)
);

alter table public.receipt_scans enable row level security;

-- Lecture de ses propres lignes seulement ; l'écriture se fait par la clé service
-- (Edge Function `scan-receipt`), qui contourne RLS. Aucun accès anonyme.
create policy receipt_scans_select on public.receipt_scans for select to authenticated
  using (user_id = (select auth.uid()));

revoke all on public.receipt_scans from anon, authenticated;
grant select on public.receipt_scans to authenticated;

-- ============================================================
-- REIZ — Phase 4 & 5 : signalement, blocage, suppression de
-- compte, waitlist landing page
-- ============================================================
-- ⚠️ À exécuter dans Supabase : Dashboard → SQL Editor → Run.
--    (Après le script security-rls.sql déjà exécuté.)
-- ============================================================

-- ---------- 1. SIGNALEMENTS (exigé par l'App Store pour le contenu utilisateur) ----------
create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references auth.users(id) on delete cascade,
  update_id uuid,
  reported_user_id uuid,
  reason text,
  created_at timestamptz default now()
);
alter table public.reports enable row level security;
drop policy if exists reports_insert on public.reports;
create policy reports_insert on public.reports
  for insert to authenticated with check (reporter_id = auth.uid());
-- Pas de policy SELECT : seuls toi (dashboard) et le service role lisent les signalements.

-- ---------- 2. BLOCAGES ----------
create table if not exists public.blocks (
  blocker_id uuid not null references auth.users(id) on delete cascade,
  blocked_id uuid not null,
  created_at timestamptz default now(),
  primary key (blocker_id, blocked_id)
);
alter table public.blocks enable row level security;
drop policy if exists blocks_select on public.blocks;
drop policy if exists blocks_insert on public.blocks;
drop policy if exists blocks_delete on public.blocks;
create policy blocks_select on public.blocks
  for select to authenticated using (blocker_id = auth.uid());
create policy blocks_insert on public.blocks
  for insert to authenticated with check (blocker_id = auth.uid() and blocker_id <> blocked_id);
create policy blocks_delete on public.blocks
  for delete to authenticated using (blocker_id = auth.uid());

-- ---------- 3. Visibilité v2 : les bloqués ne se voient plus ----------
create or replace function public.can_see_update(p_update_id uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from updates u
    left join objectives o on o.id = u.objective_id
    where u.id = p_update_id
      and (
        u.user_id = auth.uid()
        or (
          -- règle de visibilité de l'objectif
          (
            (o.id is not null and o.visibility = 'public')
            or (o.id is not null and o.visibility = 'friends' and public.is_friend(auth.uid(), u.user_id))
            or (o.id is null and public.is_friend(auth.uid(), u.user_id))
          )
          -- et aucun blocage dans un sens ou l'autre
          and not exists (
            select 1 from blocks b
            where (b.blocker_id = auth.uid() and b.blocked_id = u.user_id)
               or (b.blocker_id = u.user_id and b.blocked_id = auth.uid())
          )
        )
      )
  );
$$;

-- ---------- 4. Supprimer son post = supprimer aussi les réactions
--             et commentaires des autres SUR ce post ----------
drop policy if exists reactions_delete on public.reactions;
create policy reactions_delete on public.reactions
  for delete to authenticated using (
    user_id = auth.uid()
    or exists (select 1 from public.updates u where u.id = update_id and u.user_id = auth.uid())
  );
drop policy if exists comments_delete on public.comments;
create policy comments_delete on public.comments
  for delete to authenticated using (
    user_id = auth.uid()
    or exists (select 1 from public.updates u where u.id = update_id and u.user_id = auth.uid())
  );

-- ---------- 5. WAITLIST (landing page) ----------
create table if not exists public.waitlist (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  created_at timestamptz default now()
);
alter table public.waitlist enable row level security;
drop policy if exists waitlist_insert on public.waitlist;
-- Tout visiteur (non connecté) peut s'inscrire ; personne ne peut lire la liste depuis le client.
create policy waitlist_insert on public.waitlist
  for insert to anon with check (true);

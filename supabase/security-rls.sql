-- ============================================================
-- REIZ — Sécurité serveur (Row Level Security)
-- ============================================================
-- ⚠️ À exécuter À LA MAIN dans Supabase : Dashboard → SQL Editor
--    → coller tout ce fichier → Run. Puis teste l'app entière
--    (feed, profil, amis, post, commentaires, réactions).
--
-- Ce que fait ce script :
--   1. Supprime toutes les policies existantes sur les 6 tables
--      (pour repartir d'un état connu et cohérent).
--   2. Active RLS partout.
--   3. Recrée des policies strictes alignées sur le produit :
--      - chacun ne modifie que SES données ;
--      - un post n'est visible que selon la visibilité de son
--        objectif (public / amis / privé) ;
--      - commentaires et réactions suivent la visibilité du post.
--
-- Limites connues (notées pour la Phase 4 de l'audit) :
--   - la colonne users.push_token reste lisible par les comptes
--     connectés → à déplacer dans une table dédiée plus tard ;
--   - le bucket Storage "updates" est public → passer en URLs
--     signées plus tard (le rendre privé maintenant casserait
--     toutes les images déjà affichées).
-- ============================================================

-- ---------- 0. Fonctions utilitaires ----------
-- security definer : ces fonctions court-circuitent RLS en interne,
-- ce qui évite les récursions entre tables.

create or replace function public.is_friend(a uuid, b uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from friendships f
    where f.status = 'accepted'
      and ((f.requester_id = a and f.receiver_id = b)
        or (f.requester_id = b and f.receiver_id = a))
  );
$$;

-- Règle unique de visibilité d'un post, utilisée par updates,
-- comments et reactions :
--   auteur → toujours ; objectif public → tout le monde ;
--   objectif "friends" → amis ; objectif privé → auteur seul ;
--   pas d'objectif lié → amis.
create or replace function public.can_see_update(p_update_id uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from updates u
    left join objectives o on o.id = u.objective_id
    where u.id = p_update_id
      and (
        u.user_id = auth.uid()
        or (o.id is not null and o.visibility = 'public')
        or (o.id is not null and o.visibility = 'friends' and public.is_friend(auth.uid(), u.user_id))
        or (o.id is null and public.is_friend(auth.uid(), u.user_id))
      )
  );
$$;

-- ---------- 1. Purge des policies existantes ----------
do $$
declare p record;
begin
  for p in
    select schemaname, tablename, policyname from pg_policies
    where schemaname = 'public'
      and tablename in ('users','objectives','updates','friendships','comments','reactions')
  loop
    execute format('drop policy %I on %I.%I', p.policyname, p.schemaname, p.tablename);
  end loop;
end $$;

-- ---------- 2. Activation RLS ----------
alter table public.users       enable row level security;
alter table public.objectives  enable row level security;
alter table public.updates     enable row level security;
alter table public.friendships enable row level security;
alter table public.comments    enable row level security;
alter table public.reactions   enable row level security;

-- ---------- 3. USERS ----------
-- Lecture : nécessaire à la recherche d'amis et aux profils.
create policy users_select on public.users
  for select to authenticated using (true);
-- Chacun ne crée / modifie que SON profil.
create policy users_insert on public.users
  for insert to authenticated with check (id = auth.uid());
create policy users_update on public.users
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- ---------- 4. OBJECTIVES ----------
create policy objectives_select on public.objectives
  for select to authenticated using (
    user_id = auth.uid()
    or visibility = 'public'
    or (visibility = 'friends' and public.is_friend(auth.uid(), user_id))
  );
create policy objectives_insert on public.objectives
  for insert to authenticated with check (user_id = auth.uid());
create policy objectives_update on public.objectives
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy objectives_delete on public.objectives
  for delete to authenticated using (user_id = auth.uid());

-- ---------- 5. UPDATES (posts) ----------
create policy updates_select on public.updates
  for select to authenticated using (public.can_see_update(id));
create policy updates_insert on public.updates
  for insert to authenticated with check (user_id = auth.uid());
create policy updates_update on public.updates
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy updates_delete on public.updates
  for delete to authenticated using (user_id = auth.uid());

-- ---------- 6. FRIENDSHIPS ----------
create policy friendships_select on public.friendships
  for select to authenticated using (requester_id = auth.uid() or receiver_id = auth.uid());
-- On ne peut envoyer une demande qu'en son nom, jamais à soi-même.
create policy friendships_insert on public.friendships
  for insert to authenticated with check (
    requester_id = auth.uid()
    and requester_id <> receiver_id
    and status = 'pending'
  );
-- Seul le destinataire accepte la demande.
create policy friendships_update on public.friendships
  for update to authenticated using (receiver_id = auth.uid()) with check (receiver_id = auth.uid());
-- Refuser une demande ou retirer un ami : les deux parties peuvent.
create policy friendships_delete on public.friendships
  for delete to authenticated using (requester_id = auth.uid() or receiver_id = auth.uid());

-- ---------- 7. COMMENTS ----------
create policy comments_select on public.comments
  for select to authenticated using (public.can_see_update(update_id));
create policy comments_insert on public.comments
  for insert to authenticated with check (user_id = auth.uid() and public.can_see_update(update_id));
create policy comments_delete on public.comments
  for delete to authenticated using (user_id = auth.uid());

-- ---------- 8. REACTIONS ----------
create policy reactions_select on public.reactions
  for select to authenticated using (public.can_see_update(update_id));
create policy reactions_insert on public.reactions
  for insert to authenticated with check (user_id = auth.uid() and public.can_see_update(update_id));
create policy reactions_delete on public.reactions
  for delete to authenticated using (user_id = auth.uid());

-- ---------- 9. Anti-doublon de réactions ----------
-- Empêche deux réactions identiques (double-tap rapide).
do $$ begin
  alter table public.reactions
    add constraint reactions_unique_per_user unique (update_id, user_id, type);
exception
  when duplicate_object then null;
  when duplicate_table then null;
end $$;

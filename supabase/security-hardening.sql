-- ============================================================
-- REIZ — Durcissement sécurité avant mise en production
-- ============================================================
-- À exécuter dans Supabase : Dashboard → SQL Editor → Run.
-- (Après security-rls.sql et phase4-5.sql.)
-- ============================================================

-- ---------- 1. push_token : illisible depuis le client ----------
-- Avant : la policy users_select autorise "using (true)", donc n'importe quel
-- compte connecté pouvait lire la colonne push_token de TOUS les utilisateurs.
-- Un jeton Expo suffit à envoyer une notification à un téléphone : c'était un
-- vecteur de spam de masse.
--
-- RLS filtre les lignes, pas les colonnes. On utilise donc les droits colonne
-- de Postgres. L'app n'écrit le token que sur son propre compte (policy
-- users_update), et les edge functions le lisent via service_role, qui n'est
-- pas soumis à ces droits.
revoke select (push_token) on public.users from authenticated;
revoke select (push_token) on public.users from anon;

-- Vérification (doit renvoyer 0 ligne) :
--   select push_token from public.users limit 1;  -- exécuté en tant qu'utilisateur connecté

-- ---------- 2. Anti-spam sur la waitlist ----------
-- La policy waitlist_insert accepte tout visiteur anonyme sans limite.
-- On borne au moins la taille et le format de l'email pour éviter le
-- remplissage de la table avec des chaînes arbitraires.
do $$ begin
  alter table public.waitlist
    add constraint waitlist_email_valide
    check (char_length(email) between 5 and 254 and email like '%_@_%.__%');
exception
  when duplicate_object then null;
end $$;

-- ---------- 3. Bornes de longueur côté serveur ----------
-- L'app limite déjà les champs (maxLength), mais un client modifié peut
-- envoyer n'importe quoi directement à l'API : on double la protection en base.
do $$ begin
  alter table public.comments
    add constraint comments_content_len check (char_length(content) between 1 and 500);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.updates
    add constraint updates_caption_len check (caption is null or char_length(caption) <= 300);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.updates
    add constraint updates_progress_range check (progress_value between 0 and 100);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.objectives
    add constraint objectives_title_len check (char_length(title) between 1 and 80);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.users
    add constraint users_full_name_len check (char_length(full_name) between 1 and 40);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.reports
    add constraint reports_reason_len check (reason is null or char_length(reason) <= 200);
exception when duplicate_object then null; end $$;

-- ---------- 4. Réactions : limiter aux emojis proposés ----------
-- Empêche d'injecter du texte arbitraire dans le champ "type" d'une réaction,
-- qui est affiché tel quel dans le feed des autres utilisateurs.
do $$ begin
  alter table public.reactions
    add constraint reactions_type_len check (char_length(type) between 1 and 8);
exception when duplicate_object then null; end $$;

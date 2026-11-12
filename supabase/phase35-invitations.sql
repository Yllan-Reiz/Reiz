-- Phase 35 (12/11/2026) : lien d'invitation personnel et ami automatique (1.4).
--
-- Avant : le lien portait le @pseudo et ne créait qu'une demande en attente ; après une installation depuis
-- l'App Store, le lien était perdu et le nouvel inscrit arrivait sans ami.
-- Maintenant :
--   1. chaque compte a un CODE secret (table invite_codes, lisible par personne : seulement par fonctions). Le lien
--      est https://reiz-landing.netlify.app/invite.html?c=CODE. Le pseudo ne suffit plus : on ne devient pas ami
--      avec quelqu'un en devinant son nom.
--   2. accept_invite(code) : un compte de moins de 48 h qui arrive avec un code devient ami tout de suite avec
--      celui qui l'a invité (qui reçoit une notification). Un compte plus ancien envoie une simple demande.
--   3. lien différé : la page d'invitation note le clic (invite_click), l'app le retrouve à l'inscription
--      (claim_invite) par le réseau d'où vient la demande. Seule une empreinte de l'adresse est gardée (jamais
--      l'adresse), 48 h au plus, et la reconnaissance ne joue que s'il n'y a qu'un seul lien possible dans l'heure.
--   4. les lignes anonymes de la table events pour deux noms précis (l'écran d'inscription, avant tout compte).
--
-- Rien n'est modifié dans les tables existantes, sauf deux policies ajoutées. Annulation en bas du fichier.

begin;

-- ---------------------------------------------------------------- 1. Codes d'invitation
create table if not exists public.invite_codes (
  user_id uuid primary key references public.users(id) on delete cascade,
  code text not null unique,
  created_at timestamptz not null default now()
);
alter table public.invite_codes enable row level security;
-- Aucune policy : ni l'app ni un visiteur ne lisent cette table. Tout passe par les fonctions ci-dessous.
revoke all on public.invite_codes from anon, authenticated;

-- Mon code (créé à la première demande). 10 caractères tirés d'un UUID aléatoire.
create or replace function public.my_invite_code()
returns text
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_uid uuid := auth.uid();
  v_code text;
begin
  if v_uid is null then return null; end if;
  select code into v_code from invite_codes where user_id = v_uid;
  if v_code is not null then return v_code; end if;
  if not exists (select 1 from users where id = v_uid) then return null; end if;
  for i in 1..5 loop
    v_code := substr(replace(gen_random_uuid()::text, '-', ''), 1, 10);
    begin
      insert into invite_codes (user_id, code) values (v_uid, v_code);
      return v_code;
    exception when unique_violation then
      -- Soit ce code existe déjà (on retire), soit un autre appel vient de créer le mien (on le rend).
      select code into v_code from invite_codes where user_id = v_uid;
      if v_code is not null then return v_code; end if;
    end;
  end loop;
  return null;
end $$;
revoke all on function public.my_invite_code() from public, anon;
grant execute on function public.my_invite_code() to authenticated;

-- ---------------------------------------------------------------- 2. Accepter une invitation
-- Renvoie { status, name } :
--   friends   : amis tout de suite (compte de moins de 48 h)        requested : demande envoyée (compte plus ancien)
--   already   : déjà amis                                           self / unknown / none : rien à faire
--   no_profile : le profil n'est pas encore créé, l'app réessaie juste après
create or replace function public.accept_invite(p_code text, p_via text default 'link')
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_uid uuid := auth.uid();
  v_inviter uuid;
  v_name text;
  v_f record;
  v_fresh boolean;
  v_id uuid;
  v_via text := case when p_via in ('link', 'deferred') then p_via else 'link' end;
begin
  if v_uid is null or p_code is null then return jsonb_build_object('status', 'none'); end if;
  select user_id into v_inviter from invite_codes where code = lower(trim(p_code));
  if v_inviter is null then return jsonb_build_object('status', 'unknown'); end if;
  if v_inviter = v_uid then return jsonb_build_object('status', 'self'); end if;
  select created_at > now() - interval '48 hours' into v_fresh from users where id = v_uid;
  if v_fresh is null then return jsonb_build_object('status', 'no_profile'); end if; -- profil pas encore créé : l'app réessaie
  if exists (select 1 from blocks
             where (blocker_id = v_inviter and blocked_id = v_uid) or (blocker_id = v_uid and blocked_id = v_inviter)) then
    return jsonb_build_object('status', 'none');
  end if;
  select split_part(full_name, ' ', 1) into v_name from users where id = v_inviter;

  select id, status, requester_id into v_f from friendships
  where least(requester_id, receiver_id) = least(v_uid, v_inviter)
    and greatest(requester_id, receiver_id) = greatest(v_uid, v_inviter)
  limit 1;
  if v_f.status = 'accepted' then return jsonb_build_object('status', 'already', 'name', v_name); end if;

  -- Compte déjà installé depuis plus de 48 h : le lien vaut une demande d'ami, pas une amitié d'office.
  if not v_fresh then
    if v_f.id is null then
      insert into friendships (requester_id, receiver_id, status) values (v_uid, v_inviter, 'pending');
    elsif v_f.status = 'pending' and v_f.requester_id = v_inviter then
      update friendships set status = 'accepted' where id = v_f.id; -- il m'avait déjà demandé : j'accepte
      return jsonb_build_object('status', 'friends', 'name', v_name);
    end if;
    return jsonb_build_object('status', 'requested', 'name', v_name);
  end if;

  if v_f.id is not null then
    update friendships set status = 'accepted' where id = v_f.id;
    v_id := v_f.id;
  else
    -- Celui qui a partagé son lien est le demandeur, le nouvel inscrit a accepté en s'inscrivant avec.
    insert into friendships (requester_id, receiver_id, status) values (v_inviter, v_uid, 'accepted') returning id into v_id;
  end if;
  if v_id is null then return jsonb_build_object('status', 'none'); end if;

  -- « Léa a rejoint Reiz avec ton lien » : dans l'Activité de celui qui a invité, et en notification.
  insert into notifications (recipient_id, actor_id, type, dedupe_key)
  values (v_inviter, v_uid, 'invite_joined', 'ij:' || v_id)
  on conflict (dedupe_key) do nothing;

  -- Mesure (étape 6) : une ligne pour chacun, écrite ici pour ne dépendre d'aucun téléphone.
  insert into events (user_id, name, screen, props) values
    (v_uid, 'invite_accepted', 'onboarding', jsonb_build_object('role', 'invitee', 'via', v_via)),
    (v_inviter, 'invite_accepted', 'onboarding', jsonb_build_object('role', 'inviter', 'via', v_via));

  return jsonb_build_object('status', 'friends', 'name', v_name);
end $$;
revoke all on function public.accept_invite(text, text) from public, anon;
grant execute on function public.accept_invite(text, text) to authenticated;

-- ---------------------------------------------------------------- 3. Lien différé (clic, puis installation)
create table if not exists public.invite_clicks (
  id bigint generated always as identity primary key,
  code text not null,
  net_hash text not null,           -- empreinte du réseau, jamais l'adresse elle-même
  created_at timestamptz not null default now(),
  claimed_by uuid,
  claimed_at timestamptz
);
create index if not exists invite_clicks_net_idx on public.invite_clicks (net_hash, created_at desc);
alter table public.invite_clicks enable row level security;
revoke all on public.invite_clicks from anon, authenticated;

-- Empreinte du réseau d'où vient la requête. IPv6 : seulement le préfixe du réseau (les 4 premiers groupes),
-- car un même téléphone change de suffixe. Null si l'adresse est inconnue.
create or replace function public.request_net_hash()
returns text
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  h json := nullif(current_setting('request.headers', true), '')::json;
  ip text;
begin
  if h is null then return null; end if;
  ip := trim(coalesce(nullif(h->>'cf-connecting-ip', ''), nullif(h->>'x-real-ip', ''), split_part(coalesce(h->>'x-forwarded-for', ''), ',', 1)));
  if ip is null or ip = '' then return null; end if;
  if position(':' in ip) > 0 then
    ip := array_to_string((string_to_array(ip, ':'))[1:4], ':');
  end if;
  return encode(sha256(convert_to(ip || '|reiz-invite-v1', 'utf8')), 'hex');
exception when others then
  return null;
end $$;
revoke all on function public.request_net_hash() from public, anon, authenticated;

-- Appelée par la page d'invitation, sans compte.
create or replace function public.invite_click(p_code text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_code text := lower(trim(coalesce(p_code, '')));
  v_hash text := request_net_hash();
begin
  if v_hash is null or v_code = '' then return; end if;
  if not exists (select 1 from invite_codes where code = v_code) then return; end if;
  -- Pas plus de 20 clics par heure depuis un même réseau.
  if (select count(*) from invite_clicks where net_hash = v_hash and created_at > now() - interval '1 hour') >= 20 then return; end if;
  insert into invite_clicks (code, net_hash) values (v_code, v_hash);
  delete from invite_clicks where created_at < now() - interval '48 hours';
end $$;
revoke all on function public.invite_click(text) from public;
grant execute on function public.invite_click(text) to anon, authenticated;

-- Appelée par l'app juste après l'inscription, quand aucun lien n'a été reçu directement.
-- Ne joue que pour un compte de moins de 2 h, et seulement si UN SEUL lien a été ouvert depuis ce réseau dans
-- l'heure : au moindre doute (deux liens différents, réseau partagé), on ne devine pas.
create or replace function public.claim_invite()
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_uid uuid := auth.uid();
  v_hash text := request_net_hash();
  v_codes text[];
begin
  if v_uid is null or v_hash is null then return jsonb_build_object('status', 'none'); end if;
  if not exists (select 1 from users where id = v_uid) then return jsonb_build_object('status', 'no_profile'); end if;
  if not exists (select 1 from users where id = v_uid and created_at > now() - interval '2 hours') then
    return jsonb_build_object('status', 'none');
  end if;
  select array_agg(distinct code) into v_codes from invite_clicks
  where net_hash = v_hash and claimed_by is null and created_at > now() - interval '60 minutes';
  if v_codes is null or array_length(v_codes, 1) <> 1 then return jsonb_build_object('status', 'none'); end if;
  update invite_clicks set claimed_by = v_uid, claimed_at = now()
  where net_hash = v_hash and code = v_codes[1] and claimed_by is null;
  return accept_invite(v_codes[1], 'deferred');
end $$;
revoke all on function public.claim_invite() from public, anon;
grant execute on function public.claim_invite() to authenticated;

-- ---------------------------------------------------------------- 4. Mesure avant le compte
-- L'écran d'inscription s'affiche avant qu'un compte existe : ces deux événements partent sans user_id, avec un
-- identifiant d'installation tiré au hasard sur le téléphone (props.install). Rien d'autre n'est accepté d'un visiteur.
alter table public.events alter column user_id drop not null;
drop policy if exists events_insert_anon on public.events;
create policy events_insert_anon on public.events for insert to anon
  with check (user_id is null and name in ('app_first_open', 'onboarding_start'));
grant insert on public.events to anon;

commit;

-- Vérifications :
--   select public.my_invite_code();                       -- (connecté) rend toujours le même code
--   select count(*) from public.invite_codes;
--
-- Annulation :
--   drop function if exists public.claim_invite(), public.invite_click(text), public.accept_invite(text, text),
--     public.my_invite_code(), public.request_net_hash();
--   drop table if exists public.invite_clicks, public.invite_codes;
--   drop policy if exists events_insert_anon on public.events;
--   revoke insert on public.events from anon;
--   (les amitiés créées par invitation restent, comme n'importe quelle amitié)

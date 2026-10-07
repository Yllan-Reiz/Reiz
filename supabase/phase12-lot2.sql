-- ============================================================
-- REIZ — Phase 12 (06-07/10/2026) : lot 2 = défi duo, encouragements, jours d'entraînement, index
-- ============================================================
-- Idempotent : on peut la relancer sans risque. Uniquement des AJOUTS
-- (nouvelle table, nouvelle colonne, nouvelles fonctions) : les builds
-- déjà installés, dont le build 8 en vérification chez Apple, ne sont
-- pas touchés.
--
-- 1. DÉFI DUO : un duel d'une semaine entre deux amis. Celui qui a posté
--    sur le plus de JOURS différents gagne (max 7). Les posts d'objectifs
--    privés ne comptent pas : seul ce que le cercle peut voir compte.
--    La semaine = 7 jours calendaires heure de Paris, le jour de
--    l'acceptation compris.
-- 2. ENCOURAGEMENTS : réglage on/off par personne + journal anti-répétition
--    pour la fonction notify-encouragement.
-- 3. JOURS D'ENTRAÎNEMENT : chaque objectif peut avoir son planning (lun, mer, ven...). Les rappels
--    et les encouragements ne tombent plus les jours de repos.
-- 4. INDEX : accélèrent le fil et les profils (voir la fin du fichier).
-- 5. CONTACTS (version 1.1.0) : retrouver ses contacts déjà sur Reiz, sans jamais envoyer leurs e-mails.
-- ============================================================

-- ---------- 1. Table des défis ----------
create table if not exists public.duo_challenges (
  id uuid primary key default gen_random_uuid(),
  challenger_id uuid not null references public.users(id) on delete cascade,
  opponent_id uuid not null references public.users(id) on delete cascade,
  -- pending = proposé | active = en cours | finished = terminé | declined / cancelled = refusé / retiré
  status text not null default 'pending'
    check (status in ('pending', 'active', 'finished', 'declined', 'cancelled')),
  created_at timestamptz not null default now(),
  starts_at timestamptz,
  ends_at timestamptz,
  -- Scores figés à la fin (pendant le défi ils sont recalculés en direct).
  challenger_score int,
  opponent_score int,
  winner_id uuid references public.users(id) on delete set null,
  check (challenger_id <> opponent_id)
);
create index if not exists duo_challenges_challenger_idx on public.duo_challenges (challenger_id, created_at desc);
create index if not exists duo_challenges_opponent_idx on public.duo_challenges (opponent_id, created_at desc);
-- Un seul défi ouvert (proposé ou en cours) par paire d'amis.
create unique index if not exists duo_challenges_one_open
  on public.duo_challenges (least(challenger_id, opponent_id), greatest(challenger_id, opponent_id))
  where status in ('pending', 'active');

alter table public.duo_challenges enable row level security;
drop policy if exists duo_challenges_select on public.duo_challenges;
-- Chacun ne lit que SES défis. Aucune policy d'écriture : tout passe par les fonctions ci-dessous.
create policy duo_challenges_select on public.duo_challenges
  for select to authenticated using (auth.uid() in (challenger_id, opponent_id));

-- Les notifications peuvent maintenant pointer vers un défi.
alter table public.notifications
  add column if not exists challenge_id uuid references public.duo_challenges(id) on delete cascade;

-- ---------- 2. Score : nombre de jours d'entraînement dans une période ----------
-- Interne : appelée par les autres fonctions, jamais par l'app directement.
create or replace function public.duel_days(p_user uuid, p_from timestamptz, p_to timestamptz)
returns int language sql stable security definer set search_path = public as $$
  select count(distinct (u.created_at at time zone 'Europe/Paris')::date)::int
  from updates u
  join objectives o on o.id = u.objective_id
  where u.user_id = p_user
    and u.created_at >= p_from and u.created_at < p_to
    and o.visibility <> 'private';
$$;
revoke execute on function public.duel_days(uuid, timestamptz, timestamptz) from public, anon, authenticated;

-- ---------- 3. Proposer un défi ----------
create or replace function public.duel_create(p_opponent uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  new_id uuid;
begin
  if me is null then raise exception 'Non connecté'; end if;
  if p_opponent is null or p_opponent = me then raise exception 'Adversaire invalide'; end if;
  if not public.is_friend(me, p_opponent) then raise exception 'Vous devez être amis pour vous défier'; end if;
  if public.is_blocked(me, p_opponent) then raise exception 'Défi impossible'; end if;

  -- Une invitation restée sans réponse 3 jours ne doit pas bloquer la suivante.
  update duo_challenges set status = 'cancelled'
   where status = 'pending' and created_at < now() - interval '3 days'
     and least(challenger_id, opponent_id) = least(me, p_opponent)
     and greatest(challenger_id, opponent_id) = greatest(me, p_opponent);

  insert into duo_challenges (challenger_id, opponent_id) values (me, p_opponent) returning id into new_id;

  insert into notifications (recipient_id, actor_id, type, challenge_id, dedupe_key)
  values (p_opponent, me, 'challenge_invite', new_id, 'chi:' || new_id)
  on conflict (dedupe_key) do nothing;
  return new_id;
exception when unique_violation then
  raise exception 'Un défi est déjà en cours avec cet ami';
end $$;

-- ---------- 4. Accepter ou refuser ----------
create or replace function public.duel_respond(p_id uuid, p_accept boolean)
returns void language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  c record;
  day0 timestamp := date_trunc('day', now() at time zone 'Europe/Paris');
begin
  select * into c from duo_challenges where id = p_id for update;
  if c.id is null or c.opponent_id is distinct from me or c.status <> 'pending' then
    raise exception 'Défi introuvable';
  end if;
  if public.is_blocked(c.challenger_id, me) or not public.is_friend(c.challenger_id, me) then
    raise exception 'Défi impossible';
  end if;

  if p_accept then
    -- 7 jours calendaires heure de Paris, aujourd'hui compris.
    update duo_challenges
       set status = 'active',
           starts_at = day0 at time zone 'Europe/Paris',
           ends_at = (day0 + interval '7 days') at time zone 'Europe/Paris'
     where id = p_id;
    insert into notifications (recipient_id, actor_id, type, challenge_id, dedupe_key)
    values (c.challenger_id, me, 'challenge_accept', p_id, 'cha:' || p_id)
    on conflict (dedupe_key) do nothing;
  else
    update duo_challenges set status = 'declined' where id = p_id;
  end if;
  -- L'invitation est traitée : elle quitte la liste des non lus.
  update notifications set read_at = coalesce(read_at, now()) where dedupe_key = 'chi:' || p_id;
end $$;

-- ---------- 5. Retirer son invitation ----------
create or replace function public.duel_cancel(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid();
begin
  update duo_challenges set status = 'cancelled'
   where id = p_id and challenger_id = me and status = 'pending';
  if found then
    delete from notifications where dedupe_key = 'chi:' || p_id;
  end if;
end $$;

-- ---------- 6. Mes défis (en cours, proposés, terminés depuis moins d'une semaine) ----------
-- Les scores d'un défi en cours sont recalculés à chaque appel. Un défi dont la
-- période est écoulée est déjà rendu « finished » (le push de résultat part le matin).
create or replace function public.duel_list()
returns table (
  id uuid, challenger_id uuid, opponent_id uuid, status text, created_at timestamptz,
  starts_at timestamptz, ends_at timestamptz, challenger_score int, opponent_score int,
  other_id uuid, other_name text, other_avatar text
)
language sql stable security definer set search_path = public as $$
  select c.id, c.challenger_id, c.opponent_id,
         case when c.status = 'active' and c.ends_at <= now() then 'finished' else c.status end,
         c.created_at, c.starts_at, c.ends_at,
         case when c.status = 'finished' then c.challenger_score
              when c.status = 'active' then public.duel_days(c.challenger_id, c.starts_at, c.ends_at)
              else 0 end,
         case when c.status = 'finished' then c.opponent_score
              when c.status = 'active' then public.duel_days(c.opponent_id, c.starts_at, c.ends_at)
              else 0 end,
         o.id, o.full_name, o.avatar_url
  from duo_challenges c
  join users o on o.id = case when c.challenger_id = auth.uid() then c.opponent_id else c.challenger_id end
  where auth.uid() in (c.challenger_id, c.opponent_id)
    and (
      c.status = 'active'
      or (c.status = 'pending' and c.created_at > now() - interval '3 days')
      or (c.status = 'finished' and c.ends_at > now() - interval '7 days')
    )
    and not public.is_blocked(auth.uid(), o.id)
  order by c.created_at desc;
$$;

-- ---------- 7. Clôture (tous les matins) : fige les scores, désigne le gagnant, prévient ----------
create or replace function public.duel_close_due()
returns int language plpgsql security definer set search_path = public as $$
declare
  c record; a int; b int; w uuid; n int := 0;
begin
  update duo_challenges set status = 'cancelled'
   where status = 'pending' and created_at < now() - interval '3 days';

  for c in select * from duo_challenges where status = 'active' and ends_at <= now() for update loop
    a := public.duel_days(c.challenger_id, c.starts_at, c.ends_at);
    b := public.duel_days(c.opponent_id, c.starts_at, c.ends_at);
    w := case when a > b then c.challenger_id when b > a then c.opponent_id else null end;
    update duo_challenges
       set status = 'finished', challenger_score = a, opponent_score = b, winner_id = w
     where id = c.id;

    -- Une notification par participant, rédigée de son point de vue.
    insert into notifications (recipient_id, actor_id, type, challenge_id, preview, dedupe_key) values
      (c.challenger_id, c.opponent_id, 'challenge_result', c.id,
        case when w is null then format('Égalité %s à %s', a, b)
             when w = c.challenger_id then format('Victoire %s à %s', a, b)
             else format('Défaite %s à %s', a, b) end,
        'chr:' || c.id || ':' || c.challenger_id),
      (c.opponent_id, c.challenger_id, 'challenge_result', c.id,
        case when w is null then format('Égalité %s à %s', b, a)
             when w = c.opponent_id then format('Victoire %s à %s', b, a)
             else format('Défaite %s à %s', b, a) end,
        'chr:' || c.id || ':' || c.opponent_id)
    on conflict (dedupe_key) do nothing;
    n := n + 1;
  end loop;
  return n;
end $$;

-- Droits : l'app appelle uniquement les 4 premières ; la clôture n'est lancée que par le cron.
revoke execute on function public.duel_create(uuid)         from public, anon;
revoke execute on function public.duel_respond(uuid, boolean) from public, anon;
revoke execute on function public.duel_cancel(uuid)         from public, anon;
revoke execute on function public.duel_list()               from public, anon;
grant  execute on function public.duel_create(uuid)         to authenticated;
grant  execute on function public.duel_respond(uuid, boolean) to authenticated;
grant  execute on function public.duel_cancel(uuid)         to authenticated;
grant  execute on function public.duel_list()               to authenticated;
revoke execute on function public.duel_close_due()          from public, anon, authenticated;

-- Clôture planifiée : 06:00 UTC = 8 h à Paris l'été, 7 h l'hiver.
select cron.schedule('reiz-defis-fin', '0 6 * * *', 'select public.duel_close_due()');

-- ---------- 8. Encouragements perso ----------
-- Activés par défaut (réglable dans Réglages > Notifications).
alter table public.users add column if not exists notif_encouragement boolean not null default true;

-- Journal des encouragements envoyés : sert à ne jamais répéter le même message
-- et à ne pas dépasser un message tous les 2 jours. Aucune policy = personne ne le
-- lit depuis l'app, seule la fonction serveur y accède.
create table if not exists public.encouragement_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  kind text not null,   -- almost | comeback
  ref text,             -- ex. « <id objectif>:75 » pour ne pas répéter le même palier
  sent_at timestamptz not null default now()
);
create index if not exists encouragement_log_user_idx on public.encouragement_log (user_id, sent_at desc);
alter table public.encouragement_log enable row level security;

-- Planification de notify-encouragement : on recopie la commande du rappel quotidien
-- (URL du projet, clé, secret) en changeant seulement la fonction appelée, pour ne
-- jamais écrire le secret dans ce fichier. 08:30 UTC = 10 h 30 à Paris l'été.
do $$
declare cmd text;
begin
  select command into cmd from cron.job where jobname = 'reiz-rappel-quotidien';
  if cmd is null then
    raise exception 'Job reiz-rappel-quotidien introuvable : rien n''a été planifié pour les encouragements';
  end if;
  perform cron.schedule('reiz-encouragements', '30 8 * * *', replace(cmd, 'notify-daily-reminder', 'notify-encouragement'));
end $$;

-- ---------- 9. Jours d'entraînement ----------
-- 1 = lundi ... 7 = dimanche. Vide (null) = tous les jours, comme avant : aucun objectif existant ne change.
alter table public.objectives add column if not exists training_days smallint[];
do $$ begin
  alter table public.objectives add constraint objectives_training_days_valid
    check (training_days is null or (cardinality(training_days) between 1 and 7 and training_days <@ array[1,2,3,4,5,6,7]::smallint[]));
exception when duplicate_object then null; end $$;

-- ---------- 10. Index (vitesse) ----------
-- Relevé par le diagnostic de performance de Supabase le 07/10/2026 : la table des posts n'avait AUCUN
-- index sur l'auteur, les commentaires aucun sur le post, etc. Un index ne change ni données ni droits,
-- il accélère seulement les lectures. Les tables sont encore petites, la lenteur ressentie vient surtout de
-- l'app (corrigée côté code), mais ça se dégraderait en grossissant.
create index if not exists updates_user_created_idx on public.updates (user_id, created_at desc);
create index if not exists updates_objective_idx on public.updates (objective_id);
create index if not exists comments_update_idx on public.comments (update_id);
create index if not exists comments_user_idx on public.comments (user_id);
create index if not exists friendships_receiver_idx on public.friendships (receiver_id);
create index if not exists objectives_user_idx on public.objectives (user_id);
create index if not exists reactions_user_idx on public.reactions (user_id);
create index if not exists close_friends_friend_idx on public.close_friends (friend_id);
create index if not exists notifications_actor_idx on public.notifications (actor_id);

-- ---------- 11. Retrouver ses contacts (version 1.1.0) ----------
-- L'app n'envoie JAMAIS les adresses e-mail de tes contacts : seulement leur empreinte SHA-256 (en minuscules).
-- Cette fonction renvoie les comptes Reiz dont l'e-mail a une empreinte dans la liste, puis oublie tout :
-- rien n'est enregistré. Réservée aux comptes connectés, 1000 empreintes au maximum par appel, jamais soi-même
-- ni quelqu'un avec qui il y a un blocage. (Un compte Apple en « masquer mon e-mail » n'est pas retrouvable,
-- son adresse réelle n'est pas connue de Reiz.)
create or replace function public.match_contacts(p_hashes text[])
returns table (id uuid, full_name text, username text, avatar_url text, email_hash text)
language sql stable security definer set search_path = public, auth as $$
  select u.id, u.full_name, u.username, u.avatar_url,
         encode(sha256(convert_to(lower(a.email), 'UTF8')), 'hex') as email_hash
  from auth.users a
  join public.users u on u.id = a.id
  where auth.uid() is not null
    and coalesce(cardinality(p_hashes), 0) between 1 and 1000
    and a.email is not null
    and encode(sha256(convert_to(lower(a.email), 'UTF8')), 'hex') = any (p_hashes)
    and u.id <> auth.uid()
    and not public.is_blocked(auth.uid(), u.id)
  limit 300;
$$;
revoke execute on function public.match_contacts(text[]) from public, anon;
grant  execute on function public.match_contacts(text[]) to authenticated;

-- ---------- Vérification (à lancer après) ----------
-- select jobname, schedule from cron.job where jobname in ('reiz-defis-fin', 'reiz-encouragements');
-- select proname from pg_proc where proname like 'duel_%' or proname = 'match_contacts' order by 1;
-- select column_name from information_schema.columns where table_name = 'objectives' and column_name = 'training_days';
-- select indexname from pg_indexes where indexname in ('updates_user_created_idx', 'comments_update_idx');

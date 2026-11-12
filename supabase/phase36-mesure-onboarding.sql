-- Phase 36 (12/11/2026) : l'entonnoir de l'onboarding, pour voir où les gens décrochent (1.4).
-- Les événements sont écrits par l'app (src/lib/track.ts) et, pour l'invitation acceptée, par la base (phase 35).
-- Cette vue les range par jour d'inscription. Elle n'est lisible que depuis le back-office (pas depuis l'app).
--
--   jour               jour d'arrivée (heure de Paris)
--   ecran_prenom       téléphones qui ont vu l'écran du prénom ce jour-là (avant tout compte)
--   comptes            comptes créés ce jour-là avec le nouveau parcours
--   objectif           ... qui ont créé leur objectif dans les 24 h
--   invitation         ... qui ont ouvert au moins un partage de leur lien dans les 7 jours
--   invite_inscrit     ... dont au moins un invité s'est inscrit (ils ont gagné un ami par leur lien)
--   arrive_par_lien    ... arrivés eux-mêmes par le lien de quelqu'un (ami dès l'arrivée)
--   premiere_seance    ... qui ont publié leur première séance dans les 7 jours

create or replace view public.onboarding_funnel
with (security_invoker = true) as
with comptes as (
  select user_id, min(created_at) as at
  from public.events
  where name = 'onboarding_account' and user_id is not null
  group by user_id
),
ecrans as (
  select (created_at at time zone 'Europe/Paris')::date as jour, count(distinct props->>'install') as n
  from public.events
  where name = 'onboarding_start'
  group by 1
),
par_compte as (
  select
    (c.at at time zone 'Europe/Paris')::date as jour,
    c.user_id,
    exists (select 1 from public.events e where e.user_id = c.user_id and e.name = 'objective_created' and e.created_at < c.at + interval '24 hours') as objectif,
    exists (select 1 from public.events e where e.user_id = c.user_id and e.name = 'invite_sent' and e.created_at < c.at + interval '7 days') as invitation,
    exists (select 1 from public.events e where e.user_id = c.user_id and e.name = 'invite_accepted' and e.props->>'role' = 'inviter') as invite_inscrit,
    exists (select 1 from public.events e where e.user_id = c.user_id and e.name = 'invite_accepted' and e.props->>'role' = 'invitee') as arrive_par_lien,
    exists (select 1 from public.events e where e.user_id = c.user_id and e.name = 'first_session' and e.created_at < c.at + interval '7 days') as premiere_seance
  from comptes c
),
jours as (
  select jour from ecrans union select jour from par_compte
)
select
  j.jour,
  coalesce((select n from ecrans x where x.jour = j.jour), 0) as ecran_prenom,
  count(p.user_id) as comptes,
  count(*) filter (where p.objectif) as objectif,
  count(*) filter (where p.invitation) as invitation,
  count(*) filter (where p.invite_inscrit) as invite_inscrit,
  count(*) filter (where p.arrive_par_lien) as arrive_par_lien,
  count(*) filter (where p.premiere_seance) as premiere_seance
from jours j
left join par_compte p on p.jour = j.jour
group by j.jour
order by j.jour desc;

revoke all on public.onboarding_funnel from anon, authenticated;

-- Lecture (back-office) :
--   select * from public.onboarding_funnel limit 30;
-- Total sur 30 jours :
--   select sum(ecran_prenom) ecran_prenom, sum(comptes) comptes, sum(objectif) objectif, sum(invitation) invitation,
--          sum(invite_inscrit) invite_inscrit, sum(premiere_seance) premiere_seance
--   from public.onboarding_funnel where jour > current_date - 30;
--
-- Annulation : drop view if exists public.onboarding_funnel;

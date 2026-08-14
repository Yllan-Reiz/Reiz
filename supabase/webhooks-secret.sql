-- ============================================================
-- REIZ — Recréation des 4 webhooks de notification
-- ============================================================
-- AVANT DE LANCER : remplace REMPLACE_PAR_TON_SECRET (4 fois)
-- par la valeur générée avec : openssl rand -hex 32
-- C'est la même valeur que le secret WEBHOOK_SECRET côté Edge Functions.
--
-- Ce script change deux choses par rapport à la config actuelle :
--   1. L'en-tête Authorization n'embarque plus la clé service_role.
--      Cette clé contourne toute la sécurité RLS : elle n'a rien à faire
--      dans une définition de trigger, lisible par quiconque a accès au SQL.
--      On la remplace par la clé publishable, qui est publique par nature
--      (elle est déjà dans le binaire de l'app) et suffit à passer le
--      contrôle JWT des edge functions.
--   2. Ajout de l'en-tête x-webhook-secret : c'est lui qui authentifie
--      réellement l'appel, vérifié par le garde ajouté dans chaque fonction.
-- ============================================================

drop trigger if exists "on-comment" on public.comments;
create trigger "on-comment"
  after insert on public.comments
  for each row execute function supabase_functions.http_request(
    'https://vpaizbtetwsnvbpmeuab.supabase.co/functions/v1/notify-comment',
    'POST',
    '{"Content-type":"application/json","Authorization":"Bearer sb_publishable_dAHRrHfSQvNwm1LEpNw5Ww_EOTyejXT","x-webhook-secret":"REMPLACE_PAR_TON_SECRET"}',
    '{}',
    '5000'
  );

drop trigger if exists "on-friend-post" on public.updates;
create trigger "on-friend-post"
  after insert on public.updates
  for each row execute function supabase_functions.http_request(
    'https://vpaizbtetwsnvbpmeuab.supabase.co/functions/v1/notify-friend-post',
    'POST',
    '{"Content-type":"application/json","Authorization":"Bearer sb_publishable_dAHRrHfSQvNwm1LEpNw5Ww_EOTyejXT","x-webhook-secret":"REMPLACE_PAR_TON_SECRET"}',
    '{}',
    '5000'
  );

drop trigger if exists "on-friend-request" on public.friendships;
create trigger "on-friend-request"
  after insert on public.friendships
  for each row execute function supabase_functions.http_request(
    'https://vpaizbtetwsnvbpmeuab.supabase.co/functions/v1/notify-friend-request',
    'POST',
    '{"Content-type":"application/json","Authorization":"Bearer sb_publishable_dAHRrHfSQvNwm1LEpNw5Ww_EOTyejXT","x-webhook-secret":"REMPLACE_PAR_TON_SECRET"}',
    '{}',
    '5000'
  );

drop trigger if exists "on-like" on public.reactions;
create trigger "on-like"
  after insert on public.reactions
  for each row execute function supabase_functions.http_request(
    'https://vpaizbtetwsnvbpmeuab.supabase.co/functions/v1/notify-like',
    'POST',
    '{"Content-type":"application/json","Authorization":"Bearer sb_publishable_dAHRrHfSQvNwm1LEpNw5Ww_EOTyejXT","x-webhook-secret":"REMPLACE_PAR_TON_SECRET"}',
    '{}',
    '5000'
  );

-- Vérification : les 4 définitions ne doivent plus contenir "service_role",
-- et doivent contenir "x-webhook-secret".
-- select tgname, pg_get_triggerdef(oid) from pg_trigger
-- where tgname in ('on-comment','on-friend-post','on-friend-request','on-like');

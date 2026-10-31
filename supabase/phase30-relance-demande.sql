-- Phase 30 (31/10/2026) : relancer une demande d'ami DANS l'app.
-- Avant, « Relancer » ouvrait la feuille de partage d'iOS (Messages, WhatsApp) : à retirer, demande de Yllan.
-- Maintenant : une notification « X attend toujours ta réponse 👋 » part chez l'ami (push via le webhook on-notification),
-- au plus une fois tous les 2 jours par demande. La demande reste visible en haut de son fil et dans son Activité.
-- Sans cette fonction (base d'avant la phase 30) : l'app affiche « Impossible d'envoyer la relance ».
-- APPLIQUÉE sur la base de production le 31/10/2026 (migrations phase30_relance_demande et _anon).

create or replace function public.friend_request_remind(p_friendship uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  f record;
  last_at timestamptz;
begin
  if auth.uid() is null then return 'not_found'; end if;
  select * into f from friendships where id = p_friendship;
  if f is null or f.requester_id <> auth.uid() then return 'not_found'; end if;
  if f.status <> 'pending' then return 'not_pending'; end if;
  select max(created_at) into last_at from notifications
    where dedupe_key like 'frr:' || p_friendship || ':%';
  if last_at is not null and last_at > now() - interval '2 days' then return 'too_soon'; end if;
  insert into notifications (recipient_id, actor_id, type, preview, dedupe_key)
  values (f.receiver_id, f.requester_id, 'friend_request', 'remind', 'frr:' || p_friendship || ':' || to_char(now(), 'YYYY-MM-DD-HH24'))
  on conflict (dedupe_key) do nothing;
  return 'ok';
end $$;

-- Les droits par défaut donnent l'exécution à anon : on la retire, un compte connecté est obligatoire.
revoke all on function public.friend_request_remind(uuid) from public, anon;
grant execute on function public.friend_request_remind(uuid) to authenticated;

-- Annulation :
--   drop function if exists public.friend_request_remind(uuid);

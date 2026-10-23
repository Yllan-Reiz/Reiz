-- Phase 23 (23/10/2026, version 1.0.1, build 13) : la carte du duo change de couleur avec le temps.
-- Une carte d'Activité en direct ne se redessine que quand elle reçoit une mise à jour. La fonction live-activity-tick
-- (toutes les minutes) en envoie une quand la carte passe à l'orange (20 min restantes) puis au rouge (5 min),
-- et la ferme quand l'heure du duo est passée. Elle remplace alors les rappels « ⏳ » classiques du duo.
-- Il lui faut le jeton de mise à jour de CHAQUE carte, que l'iPhone donne une fois la carte lancée.

create table if not exists public.live_activity_runs (
  -- PAS de « references » : une table liée à updates ET à users rend ambiguë la lecture « post + auteur » (même piège que phase 14).
  update_id    uuid not null,
  user_id      uuid not null,
  deadline     timestamptz not null,
  content      jsonb not null,          -- l'état de la carte (titre, sous-titre, fin du compte à rebours), renvoyé à chaque mise à jour
  author_name  text,
  phase        text not null default 'vert' check (phase in ('vert', 'orange', 'rouge')),
  update_token text,
  created_at   timestamptz not null default now(),
  primary key (update_id, user_id)
);
alter table public.live_activity_runs enable row level security;
revoke all on public.live_activity_runs from anon, authenticated;

-- L'iPhone donne le jeton de mise à jour de la carte qu'il vient d'afficher : on le range sur sa carte la plus récente.
create or replace function public.save_live_activity_update_token(p_token text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or coalesce(length(p_token), 0) < 16 or length(p_token) > 512 then return; end if;
  update live_activity_runs r set update_token = p_token
  from (
    select update_id, user_id from live_activity_runs
    where user_id = auth.uid() and deadline > now() and (update_token is null or update_token = p_token)
    order by created_at desc limit 1
  ) last
  where r.update_id = last.update_id and r.user_id = last.user_id;
end;
$$;

revoke all on function public.save_live_activity_update_token(text) from public, anon;
grant execute on function public.save_live_activity_update_token(text) to authenticated;

-- Planification : même commande que le rappel quotidien (mêmes en-têtes et secret), autre fonction, toutes les minutes.
do $$
declare cmd text;
begin
  select command into cmd from cron.job where jobname = 'reiz-rappel-quotidien';
  if cmd is null then
    raise exception 'Job reiz-rappel-quotidien introuvable : rien n''a été planifié pour les cartes du duo';
  end if;
  perform cron.schedule('reiz-cartes-duo', '* * * * *', replace(cmd, 'notify-daily-reminder', 'live-activity-tick'));
end $$;

-- ============================================================
-- REIZ — Phase 14 (21/10/2026) : rappels d'un duo, façon BeReal
-- ============================================================
-- Un ami t'identifie dans sa séance : tu as 1 heure pour poster la tienne. La fonction `notify-duo-reminder`
-- (toutes les 5 minutes) te rappelle vers 30 min puis vers 10 min de la fin, si tu n'as pas encore posté.
-- Cette table garde ce qui a déjà été envoyé : un rappel ne part qu'une fois.

create table if not exists public.duo_reminders (
  update_id uuid not null references public.updates(id) on delete cascade,
  user_id   uuid not null references public.users(id) on delete cascade,
  stage     smallint not null check (stage in (1, 2)),
  sent_at   timestamptz not null default now(),
  primary key (update_id, user_id, stage)
);
-- Personne ne la lit depuis l'app : RLS activée, aucune règle (seul le serveur y accède).
alter table public.duo_reminders enable row level security;

-- Planification : on copie la commande du rappel quotidien (mêmes en-têtes et secret) en changeant la fonction.
do $$
declare cmd text;
begin
  select command into cmd from cron.job where jobname = 'reiz-rappel-quotidien';
  if cmd is null then
    raise exception 'Job reiz-rappel-quotidien introuvable : rien n''a été planifié pour les rappels de duo';
  end if;
  perform cron.schedule('reiz-duo-rappels', '*/5 * * * *', replace(cmd, 'notify-daily-reminder', 'notify-duo-reminder'));
end $$;

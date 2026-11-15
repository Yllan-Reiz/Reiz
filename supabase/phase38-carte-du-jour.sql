-- Phase 38 (15/11/2026) : la carte du jour (jauge sur l'écran verrouillé, lancée par notify-moment).
-- La tâche qui fait vivre les cartes (couleur, fermeture au post et à minuit) était arrêtée depuis que les cartes du
-- duo sont rangées. Elle repart, toutes les 5 minutes au lieu de chaque minute.
-- Déjà appliqué en production le 15/11/2026.

select cron.alter_job((select jobid from cron.job where jobname = 'reiz-cartes-duo'), schedule := '*/5 * * * *', active := true);

-- Vérification : schedule '*/5 * * * *', active true.
select jobname, schedule, active from cron.job where jobname = 'reiz-cartes-duo';

-- Pour l'arrêter de nouveau :
--   select cron.alter_job((select jobid from cron.job where jobname = 'reiz-cartes-duo'), active := false);

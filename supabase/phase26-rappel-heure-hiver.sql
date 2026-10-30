-- Phase 26 (29-30/10/2026) : les tâches planifiées repartent sur leur heure de Paris.
-- pg_cron tourne en UTC. Les horaires avaient été réglés en heure d'été :
-- depuis le passage à l'heure d'hiver (25/10/2026), tout partait une heure trop tôt
-- (le rappel du soir à 18 h, avant le pic des posts de 19 h).
-- Déjà appliqué en production : rappel du soir le 29/10/2026, les trois autres le 30/10/2026.
--
-- À refaire à chaque changement d'heure (prochain passage à l'heure d'été : 28/03/2027).
--   tâche                  heure de Paris      hiver (UTC)       été (UTC)
--   reiz-rappel-quotidien  19 h chaque jour    '0 18 * * *'      '0 17 * * *'
--   reiz-encouragements    10 h 30 chaque jour '30 9 * * *'      '30 8 * * *'
--   random-reminder        14 h mardi/vendredi '0 13 * * 2,5'    '0 12 * * 2,5'
--   reiz-defis-fin         8 h chaque jour     '0 7 * * *'       '0 6 * * *'
-- Les tâches qui tournent toutes les minutes ou toutes les 5 min ne bougent pas.

-- Heure d'hiver :
select cron.alter_job((select jobid from cron.job where jobname = 'reiz-rappel-quotidien'), schedule := '0 18 * * *');
select cron.alter_job((select jobid from cron.job where jobname = 'reiz-encouragements'), schedule := '30 9 * * *');
select cron.alter_job((select jobid from cron.job where jobname = 'random-reminder'), schedule := '0 13 * * 2,5');
select cron.alter_job((select jobid from cron.job where jobname = 'reiz-defis-fin'), schedule := '0 7 * * *');

-- Vérification : heure_paris doit afficher 19:00, 10:30, 14:00 et 08:00.
select jobname, schedule, active,
  to_char(((current_date + make_time(split_part(schedule, ' ', 2)::int, split_part(schedule, ' ', 1)::int, 0)) at time zone 'UTC') at time zone 'Europe/Paris', 'HH24:MI') as heure_paris
from cron.job
where jobname in ('reiz-rappel-quotidien', 'reiz-encouragements', 'random-reminder', 'reiz-defis-fin');

-- Phase 28 (30/10/2026) : moins de notifications, et des meilleures (chantier 4).
-- Le gros du travail est dans send-push (heures calmes 22 h 30 à 7 h 30, regroupement des posts d'amis, plafond de
-- 8 par jour). Ici, seulement le rappel surprise du mardi et du vendredi : une phrase générique envoyée à tout le monde,
-- même à ceux qui venaient de poster. Le rappel du soir (19 h) et les encouragements du matin font ce travail.
-- Déjà appliqué en production le 30/10/2026. La fonction notify-random-reminder reste en place.

select cron.alter_job((select jobid from cron.job where jobname = 'random-reminder'), active := false);

-- Vérification : active doit être false.
select jobname, schedule, active from cron.job where jobname = 'random-reminder';

-- Pour le remettre :
--   select cron.alter_job((select jobid from cron.job where jobname = 'random-reminder'), active := true);
-- (horaire d'hiver '0 13 * * 2,5' = 14 h à Paris, voir phase26 pour l'heure d'été)

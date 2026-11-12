-- Phase 32 : changement du secret des tâches planifiées (audit de sécurité du 07/11/2026)
--
-- Pourquoi : l'ancien CRON_SECRET était écrit en clair dans RAPPELS-SETUP.md, et le dépôt
-- GitHub est public. Les tâches en service utilisaient exactement cette valeur.
--
-- Ce script range le nouveau secret dans Vault : il est tiré au hasard DANS la base et
-- n'apparaît jamais dans un fichier. Les tâches planifiées le lisent dans Vault à chaque
-- exécution. La clé serveur (sb_secret) quitte aussi le texte des tâches pour Vault.
--
-- Mode d'emploi (SQL Editor de Supabase), dans cet ordre et sans traîner entre 2 et 3 :
--   1. Exécuter la PARTIE A.
--   2. Exécuter la requête de la PARTIE A bis, copier la valeur affichée, puis la coller dans
--      Dashboard > Edge Functions > Secrets > CRON_SECRET (remplacer l'ancienne valeur).
--      Profiter de cet écran pour vérifier que WEBHOOK_SECRET existe bien.
--   3. Exécuter la PARTIE B.
--   4. Exécuter la PARTIE C après 5 minutes : les dernières réponses doivent être 200.
-- Entre les étapes 2 et 3, un appel de reiz-moment peut échouer une fois (401). Sans gravité.


-- ============ PARTIE A : créer les secrets dans Vault ============

select vault.create_secret(
  replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  'reiz_cron_secret',
  'En-tête x-cron-secret des tâches planifiées (rotation du 07/11/2026)'
);

-- Copie la clé serveur actuelle depuis la commande d'une tâche, sans l'afficher.
select vault.create_secret(
  substring(command from 'Bearer (sb_secret_[A-Za-z0-9_\-]+)'),
  'reiz_cron_service_key',
  'Clé serveur utilisée par les tâches planifiées pour appeler les fonctions'
)
from cron.job where jobname = 'reiz-moment';


-- ============ PARTIE A bis : afficher le nouveau secret pour le tableau de bord ============
-- (à faire soi-même dans le SQL Editor, ne pas le coller ailleurs)

select decrypted_secret from vault.decrypted_secrets where name = 'reiz_cron_secret';


-- ============ PARTIE B : faire lire Vault aux tâches planifiées ============

select cron.alter_job(
  jobid,
  command := regexp_replace(
    regexp_replace(
      command,
      $re$'x-cron-secret',\s*'[^']*'$re$,
      $rep$'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'reiz_cron_secret')$rep$
    ),
    $re$'Bearer sb_secret_[^']*'$re$,
    $rep$'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'reiz_cron_service_key')$rep$
  )
)
from cron.job
where command like '%x-cron-secret%' and jobname <> 'random-reminder';

-- Ancienne tâche désactivée qui contenait encore un vieux secret en clair : on la supprime.
select cron.unschedule('random-reminder');

-- Contrôle : plus aucune valeur en clair dans les tâches (les 3 colonnes doivent être false).
select jobname,
  command ~ 'reiz_[A-Za-z0-9]{8,}' as ancien_secret_en_clair,
  command ~ 'sb_secret_' as cle_serveur_en_clair,
  command !~ 'vault.decrypted_secrets' and command like '%net.http_post%' as ne_lit_pas_vault
from cron.job order by jobname;


-- ============ PARTIE C : vérifier que les appels passent (après 5 minutes) ============

select status_code, created from net._http_response order by created desc limit 10;

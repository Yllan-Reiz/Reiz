-- ============================================================
-- REIZ : jetons de notification illisibles depuis l'app (appliqué le 24/10/2026)
-- ============================================================
-- Le revoke par colonne de security-hardening.sql n'avait aucun effet : le droit SELECT
-- sur toute la table l'emporte sur un revoke de colonne. N'importe quel compte connecté
-- pouvait donc lire les push_token des autres et leur envoyer des notifications.
-- On retire le droit sur la table et on rend seulement les colonnes affichées par l'app.
-- push_token et timezone restent lisibles par les fonctions serveur (service_role).
--
-- Si une nouvelle colonne de users doit être lue par l'app, l'ajouter à la liste du grant.
revoke select on public.users from anon, authenticated;
grant select (id, username, full_name, avatar_url, created_at, bio, notif_encouragement, discoverable, sport, language)
  on public.users to authenticated;

-- Vérification (doit répondre « permission denied ») en tant qu'utilisateur connecté :
--   select push_token from public.users limit 1;

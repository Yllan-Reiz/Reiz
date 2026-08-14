-- ============================================================
-- REIZ — Passage du bucket "updates" en privé
-- ============================================================
-- À exécuter dans Supabase : SQL Editor → Run.
--
-- IMPORTANT : lance ce script APRÈS avoir installé la nouvelle version
-- de l'app sur ton téléphone. Tant que l'ancienne tourne, elle attend
-- des URLs publiques et n'affichera plus les images.
--
-- Ce que ça change :
--   Avant : n'importe qui connaissant l'URL d'une photo pouvait la voir,
--           même celle d'un post privé.
--   Après : les fichiers ne sont accessibles que par URL signée, générée
--           par l'app pour un utilisateur connecté et valable 1 heure.
-- ============================================================

-- ---------- 1. Le bucket n'est plus public ----------
update storage.buckets set public = false where id = 'updates';

-- ---------- 2. Qui peut faire quoi sur les fichiers ----------
-- Les fichiers sont rangés ainsi :
--   <user_id>/<timestamp>.jpg   → photo d'un post
--   avatars/<user_id>.jpg       → photo de profil
drop policy if exists updates_objects_select on storage.objects;
drop policy if exists updates_objects_insert on storage.objects;
drop policy if exists updates_objects_update on storage.objects;
drop policy if exists updates_objects_delete on storage.objects;

-- Lecture : tout compte connecté peut demander une URL signée.
-- La confidentialité réelle des posts reste assurée par les policies de la
-- table "updates" : sans le droit de voir le post, on n'obtient jamais le
-- chemin de sa photo, donc jamais d'URL signée.
create policy updates_objects_select on storage.objects
  for select to authenticated
  using (bucket_id = 'updates');

-- Écriture : chacun n'écrit que dans SON dossier, ou son propre avatar.
create policy updates_objects_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'updates'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or name = 'avatars/' || auth.uid()::text || '.jpg'
    )
  );

-- Remplacement (upsert de l'avatar).
create policy updates_objects_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'updates'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or name = 'avatars/' || auth.uid()::text || '.jpg'
    )
  );

-- Suppression : uniquement ses propres fichiers.
create policy updates_objects_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'updates'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or name = 'avatars/' || auth.uid()::text || '.jpg'
    )
  );

-- ---------- 3. Vérification ----------
-- Le bucket doit apparaître avec public = false :
--   select id, public from storage.buckets where id = 'updates';
-- Et quatre policies doivent exister :
--   select policyname, cmd from pg_policies
--   where schemaname = 'storage' and tablename = 'objects'
--     and policyname like 'updates_objects%';

# Reiz 1.5.0 : compte rendu du build

Branche `v1.4-onboarding-express`. Écrit le 17/11/2026.

## Pourquoi ce build

Une mise à jour à distance n'atteint pas un nouvel inscrit pendant sa première session : l'app installée depuis l'App
Store démarre sur le code embarqué dans le build, et la mise à jour ne s'appliquait qu'au retour suivant dans le fil.
Le seul compte créé après la 1.4 (14/11) avait donc suivi l'ancien accueil. Ce build embarque le code actuel
(accueil express de la 1.4, carte du jour de la 1.5) et applique désormais une mise à jour en attente dès l'écran
d'accueil, avant l'inscription (`App.tsx`).

## Le piège de la version

- `version` : 1.5.0 (ce que voit l'App Store).
- `runtimeVersion` : fixée à la main à `"1.2.0"`, plus calculée d'après la version.

Le code natif iOS est identique à celui du build 19 (aucun module, aucune dépendance changés depuis le commit
9151c3e). Garder la même version d'exécution permet à un seul `eas update --channel production` de servir à la fois les
gens restés en 1.2.0 (iOS et Android) et ceux passés en 1.5.0.

Conséquence : au prochain build qui change quelque chose de natif (module, dépendance, plugin, permission iOS), il
FAUT changer `runtimeVersion` à la main dans `app.json`. Sinon une mise à jour écrite pour le nouveau natif partirait
aussi vers les anciens builds, qui planteraient.

## Jamais testé en réel

- L'application immédiate de la mise à jour sur l'écran d'accueil : impossible au simulateur (build de développement).
  À vérifier sur TestFlight : installer, ouvrir, et regarder si l'accueil se recharge une fois au premier lancement
  quand une mise à jour plus récente que le build existe.
- Le parcours complet avec un compte neuf, et l'amitié automatique par lien d'invitation.

# Reiz 1.2.0 : compte rendu du build

Branche `v1.2-premier-post`, partie de `v1.1-langues`. Mise à jour le 30/10/2026.

## Texte à coller dans TestFlight (« Quoi tester »)

```
Reiz 1.2 : merci de tester sur ton vrai compte, en conditions normales.

NOUVEAU
- Moment Reiz : une notif par jour, séance ou récup. Poste dans les 10 minutes pour le badge « À l'heure ».
- Cercle du jour : en haut du fil, qui a déjà posté aujourd'hui.
- Objectif atteint : écran de victoire, annonce à ton cercle, parcours en image et en vidéo à partager.
- Une séance peut compter pour plusieurs objectifs prévus le même jour (section « Compte aussi pour »).
- Réactions : choisis tes 6 emojis dans Réglages > Mes réactions, ou réagis avec n'importe quel emoji via le +.
- Commentaires en verre, et la barre de message suit le clavier.

AMÉLIORÉ
- Photos plus nettes, photos sans zoom, vidéos jusqu'à 25 secondes.
- Fil plus fluide.
- Légende modifiable pendant 5 minutes après le post.
- Moins de notifications, demandes d'ami en haut du fil, défis mis en avant dans les duos.

À VÉRIFIER EN PRIORITÉ
1. Poster une photo, puis une vidéo : envoi, netteté, proportions.
2. Publier un jour d'entraînement avec plusieurs objectifs : les compteurs des autres objectifs montent-ils bien ?
3. Commenter et répondre : ouvrir le clavier, le faire descendre au doigt, envoyer.
4. Réagir avec un emoji choisi via le +.
5. Faire défiler le fil avec des vidéos : ça rame ? un écran noir reste-t-il ?
6. Ouvrir un post depuis le cœur.

Un bug ? Envoie une capture et dis ce que tu faisais.
```

## Ce qui entre dans le build

| Sujet | Contenu | Commit |
|---|---|---|
| Premier post | Mis en avant dans l'accueil, la carte du profil et le fil vide | `94ca0cd` |
| Objectif atteint | Écran de victoire, annonce au cercle, clôture en base | `269eed4` |
| Parcours | Récap en image et en vidéo, partage, galerie | `17e2b01` |
| Demandes d'ami | Rappel après 2 jours, en haut du fil, relancer ou annuler | `db9c1ac` |
| Notifications | Heures calmes, posts regroupés, plafond du jour | `4f3703e` |
| Moment Reiz | Notif du jour, badge à l'heure, cercle du jour | `921c4c6`, `d56fdb7` |
| Encouragements | Dans le moment, le cercle relance un ami à l'arrêt | `b33e830` |
| Défis duo | Mis en avant, bulle de duo corrigée | `db239c0` |
| Publications | Sans zoom, vidéos 25 s, 215 kg exact, légende 5 min | `f7c6d8f` |
| Réactions | 6 emojis au choix, clavier emoji d'Apple | `82bb759`, `87328ff` |
| Bug du cœur | Le post ouvert couvre tout l'écran | `6e3aaf9` |
| Photos et fluidité | Plus de photos floues, moins de téléchargements, vidéos voisines prêtes | `3055ec4` |
| Commentaires | Feuille en verre, barre collée au clavier | `7415913`, `7a2ca4a` |
| Objectifs du jour | « Compte aussi pour » à la publication | `ecc597d` |

## État avant envoi

- Version : 1.2.0 dans `app.json`. Build 18 (commit 240ef4a) envoyé le 31/10/2026 vers 0 h 10. Build 19 (commit 9151c3e : module clavier v2, relance in-app, cadre photo, vidéos, glisser pour répondre) envoyé sur App Store Connect le 31/10 vers 2 h 15 : c'est lui qui sert pour TestFlight et la soumission.
- Modules natifs du build : `reiz-emoji-keyboard`, `reiz-keyboard-dock`, `reiz-video-story`, `reiz-live-activity`.
- Vérification des types : aucune erreur.
- Serveur déjà en ligne : table `moments`, colonnes de `updates`, tâche planifiée de `notify-moment` (35 moments envoyés en 24 h), `send-push` v17, `notify-moment` v4, `notify-encouragement` v7. Rien à déployer pour ce build.
- Le bug du cœur reste présent sur la 1.1 tant que la 1.2 n'est pas sortie.

## Jamais testé en réel

Testé seulement sur simulateur, sans rien publier sur le compte de Yllan :

- Envoi réel : photo avec la nouvelle compression, post avec « Compte aussi pour », commentaire ou réponse avec la nouvelle barre, réaction via le +.
- Fluidité du fil et lâcher du clavier au doigt sur un vrai iPhone.
- Android, sur tous ces sujets.
- Badge de victoire, carte des demandes reçues, bulle de duo et bouton de défi, enregistrement en galerie, vidéo de 25 s, encouragement dans un moment.

## Limites connues

- Une vidéo revue plus tard se recharge : le cache d'expo-video 3.0.16 empêche toute lecture sur iOS.
- Emojis très composés (plus de 8 caractères Unicode) : ignorés quand on les touche, la base les refuse.
- Tous les emojis sont possibles comme réactions, y compris ceux qui peuvent choquer.
- « Compte aussi pour » : seulement les objectifs prévus ce jour-là, hors objectifs atteints et en pourcentage. Pas d'ajout au parcours des autres objectifs.
- « Répondre » sur un commentaire bas : le clavier peut le cacher.
- Traductions hébreu : à faire relire, y compris les nouveaux textes.

## Pas dans ce build

- Bandeau « nouvelle version » (chantier 7), repartage (non tranché).
- Objectifs par semaine, e-mail de rappel des demandes d'ami, réglages de notifications par type.

## Audit de fluidité (31/10/2026, commit après 6ffd1e3)

Outils : `npx tsc --noEmit` (aucune erreur) et `npx eslint src App.tsx modules` (config ajoutée, 0 erreur, 55 avertissements
sans effet). Base Supabase : index en place, aucune requête lente. Corrigé dans l'app :

- Carte du fil : cinq morceaux (avatar, duo, menu, pile de visages, calque sur la photo) étaient définis comme composants
  pendant le rendu. React les démontait et remontait à chaque rendu de la carte : visages rechargés, emojis qui
  sautaient, toucher perdu. Ce sont maintenant des éléments.
- Jauge de progression : animée sur le pilote natif (avant : 700 ms de calcul JavaScript par carte pendant le défilement).
- En-tête du fil (demandes, cercle du jour, défis, mise en route) mémorisé : il ne se redessinait plus à chaque arrêt du
  défilement.
- Cercle du jour : au retour dans l'app, plus de relecture de 30 jours de posts du cercle (lecture de moins de 5 minutes gardée).
- Onglet Amis : les avatars des lignes sortis du composant (même défaut que la carte du fil).
- Vignettes des profils signées 10 à la fois au lieu de 6.
- Un hook appelé après un retour anticipé dans Main (attrapé par le lint, corrigé).
- `node_modules` était un lien symbolique vers ~/Desktop/Reiz committé dans git : retiré, chaque dossier a le sien.

## Retours de la bêta du build 18 (31/10/2026, commits 9353add et c5e40a4, pas dans le build 18)

- Relancer une demande d'ami se fait dans l'app : notification « X attend toujours ta réponse » chez l'ami, au plus une
  fois tous les 2 jours. Serveur en place : fonction friend_request_remind (phase30-relance-demande.sql) et send-push v19.
- Un seul cadre 2:3 pour toutes les photos du fil (les horizontales sortaient toutes petites).
- Les vidéos jouent tant qu'un bout de la carte est visible, plus de cadre gris au défilement.
Ces trois points sont en JavaScript seulement. Mise à jour à distance publiée le 31/10/2026 (canal production, version 1.2.0,
groupe bd3cdfb2) : le build 18 la récupère à l'ouverture. Un build 19 reste nécessaire pour la soumission à Apple.

## Clavier des commentaires (31/10/2026, retour de Yllan sur le build 18)

Sur son iPhone, la barre de message restait sous le clavier. Le module natif v1 (build 18) lisait un repère qui ne bouge
pas sur certains appareils. Version 2 du module : les notifications du clavier font foi (marchent partout), le repère ne
sert plus qu'au glissement au doigt. Le JavaScript ignore la v1 et reprend le décalage classique (vérifié : barre visible).
Donc : mise à jour à distance = clavier qui marche sur le build 18 ; build 19 = barre collée et glissement au doigt.

## Phase 31 : objectifs à rythme et échéance (31/10/2026, commits 19e15d9 et suivants, hors build 19)

Retour des testeurs : « 4 séances » est un rythme hebdo, pas un total, l'app disait « bravo » au bout de 4 posts
(7 objectifs sur 14 dépassés). Désormais un objectif = un rythme (« 4 par semaine ») ou un record (« 240 kg »), avec une
échéance (4/8/12/16 semaines ; facultative pour un record). La cible d'un rythme = par semaine x semaines, la jauge monte
sur la période, « Semaine 3 sur 12, 2 sur 4 cette semaine », un post = une séance, bilan à l'échéance (prolonger, nouvel
objectif, parcours). Jours off : plus de moment Reiz, la série ne casse qu'un jour prévu sans post, le cercle du jour ne
compte que ceux qui ont une séance prévue.
- Base : phase31-rythme-echeance.sql APPLIQUÉ le 31/10 (colonnes per_week, starts_at, trigger adapté).
- phase31b-conversion-rythmes.sql APPLIQUÉ le 31/10 (15 rythmes convertis et rouverts, échéance 23/01/2027) ; mise à jour
  à distance et `supabase functions deploy notify-moment` lancés par Yllan dans la foulée.
- Vérifié sur simulateur : création d'un rythme (3/semaine, 8 semaines = 24, jusqu'au 26 déc.), carte, publication
  « Séance 1 sur 24 ». Non vérifié : bilan à l'échéance, modification d'échéance, série sur vrai compte.

## Commandes d'envoi

Déjà préparées, à lancer une fois d'accord :

```bash
eas build --platform ios --profile production --auto-submit
```

Fait le 31/10/2026 à 2 h 24 : version 1.2.0 créée dans App Store Connect (build 19, Nouveautés en fr/en/es-ES/es-MX/he, compte de démo et remarques repris de la 1.1.0, publication manuelle) et SOUMISE à Apple, état « En attente de vérification ». La 1.1.0 validée n'a jamais été publiée : publier la 1.2.0 dès son accord.

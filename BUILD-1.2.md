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

- Version : 1.2.0 dans `app.json`. Le numéro de build est donné par EAS (après le 17).
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

## Commandes d'envoi

Déjà préparées, à lancer une fois d'accord :

```bash
eas build --platform ios --profile production --auto-submit
```

Puis, après le test TestFlight : écrire les Nouveautés de l'App Store en 4 langues et soumettre à Apple.

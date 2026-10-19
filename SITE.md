# Site officiel de Reiz

Dossier du site : `site/` (HTML, CSS et JavaScript sans dépendance, rien à compiler).
En ligne depuis le 11/10/2026 sur https://reiz-landing.netlify.app (l'ancienne `landing/` est gardée telle quelle).

## Voir le site sur ton Mac

```bash
cd ~/Desktop/Reiz/site && python3 -m http.server 4610
```

Puis ouvrir http://localhost:4610 dans Chrome ou Safari.
(Si une image manque avec ce serveur, utiliser `node ~/Desktop/Reiz/design/site/serve.mjs`
après avoir copié `site/` à côté de ce fichier.)

## Mettre en ligne (remplace la landing actuelle, même adresse)

Le site Netlify est `reiz-landing` (id `d5098a91-2962-439d-8494-f1b02ac30918`). Les pages que
l'app et les stores utilisent gardent la même adresse : `/invite.html`, `/cgu.html`,
`/confidentialite.html`, `/suppression-compte.html`.

```bash
cd ~/Desktop/Reiz/site && netlify deploy --prod --no-build --dir . --site d5098a91-2962-439d-8494-f1b02ac30918
```

`--no-build` est obligatoire (Netlify a une commande de build Expo enregistrée qui casse tout).
Pour essayer d'abord sur une adresse provisoire, enlever `--prod`.

## Le jour de la sortie App Store

Dans `site/assets/main.js`, tout en haut :

```js
appStoreUrl: 'https://apps.apple.com/fr/app/id6814173335',
```

Tous les boutons deviennent « Télécharger », les formulaires disparaissent, la FAQ change de
réponse. Dans `site/index.html`, décommenter la ligne `apple-itunes-app` (bannière Safari).
Remplacer aussi le bouton blanc par le badge officiel Apple si tu le veux (tools.applemarketingtools.com).

## Liste de sortie (e-mails)

Le formulaire écrit dans la table Supabase `waitlist` (la même que l'ancienne landing).
Pour récupérer les adresses : Supabase, Table Editor, `waitlist`, Export CSV.
Testé : format refusé par la base, erreur réseau, erreur serveur, adresse déjà inscrite,
succès (simulé). Pas testé : une vraie inscription, pour ne pas écrire de fausse adresse
dans ta table. Fais-en une avec ta propre adresse après la mise en ligne.

## Fonctionnalités présentées et leur statut

| Sur le site | Statut |
|---|---|
| Objectif chiffré dans sa vraie unité (kg, km, séances) | Dans le build 8 envoyé à Apple |
| Publier une séance en photo ou vidéo de 15 s, jauge qui avance | Build 8 |
| Réactions emoji, commentaires, réponses | Build 8 |
| Qui voit : Mon cercle, Cercle proche, Privé, Public | Build 8 |
| Duo (identifier un ami, validé à moins d'1 h) | Build 8 |
| Alerte « À la salle » au cercle proche (iPhone) | Build 8 |
| Rappel du soir, notifications | Build 8 |
| 12 badges | Build 8 |
| Connexion Apple, Google, e-mail | Build 8 |
| Lien d'invitation | Build 8 |
| Jours d'entraînement | Mise à jour à distance pas encore envoyée (lot 2/3) |
| Duel d'une semaine | Mise à jour à distance pas encore envoyée |
| Badges à 6 niveaux | Mise à jour à distance pas encore envoyée ; paliers non validés, donc le site ne montre que le niveau 1 et les 6 pastilles |
| Encouragements, série en jeu dans le rappel | Fonctions serveur déployées, côté app dans la mise à jour à distance |
| Régularité du cercle (« 7 / 11 ont posté ») | Mise à jour à distance pas encore envoyée |
| Design verre (onglets objectifs, profil, activité) | Mise à jour à distance pas encore envoyée |

À faire avant de publier le site : envoyer la mise à jour à distance au build 8
(`eas update --channel production`), sinon une partie de ce que montre le site n'est pas encore
dans l'app des gens.

Volontairement absent du site : retrouver ses contacts (1.1.0), Android public, prix autre que
gratuit, chiffres d'utilisateurs, avis, témoignages.

## Ce qu'il reste à compléter

1. **Mentions légales** (`site/mentions-legales.html`) : ton adresse, ton SIREN/SIRET si tu en as
   un, l'adresse et le téléphone de Netlify. La page est en `noindex` tant que ce n'est pas fait.
2. **Politique de confidentialité** : j'ai ajouté la section 10 « Liste de sortie du site web »
   dans la copie `site/confidentialite.html`. Deux engagements à valider : l'adresse sert
   uniquement à annoncer la sortie, et elle est supprimée au plus tard un an après.
3. **Lien App Store** : à mettre dans `main.js` le jour de la sortie (voir plus haut).
4. **Google Play** : aucun bouton tant que l'app n'est pas publique sur Android.
5. **Mesure d'audience** : aucun traceur installé. Le site émet déjà des événements
   (`waitlist_signup`, `badge_view`, clics sur les boutons, questions ouvertes). Pour les compter
   sans cookie, ajouter Plausible ou Umami dans `index.html` : ils sont branchés automatiquement.
6. **Badges en grand** : les images font 240 px, elles sont affichées à 120 px maximum pour rester
   nettes. Une planche HD permettrait de les montrer plus grands.

## Fichiers utiles

- `PRODUCT.md` : ce qu'est Reiz, ce qui est confirmé, ce qui ne doit jamais être annoncé.
- `design/site/og.html` : source de l'image de partage `site/assets/og.jpg` (1200 x 630).
- `design/site/shoot.mjs` : captures pleine page avec Chrome sans fenêtre.

# Visuels des stores Reiz (05/10/2026)

8 visuels marketing créés depuis le code de l'app et sa DA (fond #0a0a0a, accent blanc, Inter, Liquid Glass).
Les écrans sont reconstruits en HTML avec les valeurs de `src/styles.ts`, avec des données fictives
(Théo, Sarah, Nathan, Inès, Hugo, Maël, avatars à initiales). Aucune personne réelle.

1. Ton cercle te regarde (fil)
2. Fixe ton objectif (création)
3. Poste ta séance (publication)
4. Ils réagissent. Tu continues. (réactions et commentaires)
5. Entraîne-toi en duo (duo)
6. Débloque tes badges (collection et fiche d'un badge)
7. Ton profil, ta preuve (profil)
8. Rejoins ton cercle (accueil, appel à l'action)

## Sorties (dans `out/`)

- `ios-6.5/` : 1284 x 2778, slot « 6,5 pouces » d'App Store Connect
- `ios-6.9/` : 1320 x 2868, slot « 6,9 pouces »
- `play/` : 1080 x 1920 (cadre Android neutre, pas de bouton Apple sur l'accueil)
- `play/feature-1024x500.png` : image de présentation Google Play

## Refaire

```bash
cd ~/Desktop/Reiz/design/store
node render.mjs ios65        # tous les visuels, ou : node render.mjs ios65 3 5
node render.mjs ios69
node render.mjs play
node render.mjs feature
```

Les textes et les écrans sont dans `store.html` (tableau `SLIDES`). Règle d'écriture : aucun tiret cadratin, aucun point médian.


## Version 2 (21/10/2026) : 10 visuels avec les écrans de l'app actuelle

Fichiers : `bande2.html` (la page, copie de `bande.html` avec les nouveaux écrans) et `render.mjs` (presets `bande10` et `bande10play`).
Ancienne version (8 visuels) gardée intacte : `bande.html`, `out/final/`.

Ordre : 1 fil (photo pleine largeur), 2 création d'objectif (jours d'entraînement), 3 publication, 4 réactions, 5 duo,
6 duel de la semaine (nouveau), 7 centre d'activité et régularité du cercle (nouveau), 8 badges à 6 niveaux,
9 profil, 10 accueil (appel à l'action).

```bash
cd ~/Desktop/Reiz/design/store
node render.mjs bande10        # 10 panneaux 1284 x 2778 dans out/bande10/
node render.mjs bande10play    # 10 panneaux 1284 x 2568 dans out/bande10-play/
```

Sorties prêtes : `out/final2/app-store-6.5` (1284 x 2778), `app-store-6.9` (1320 x 2868), `google-play` (1080 x 2160),
obtenues avec ffmpeg (`scale` + `crop`). L'App Store accepte jusqu'à 10 captures. Image de présentation Google Play
(1024 x 500) : inchangée dans `out/final/google-play/`.

## Version 3 (22/10/2026) : 10 visuels de la 1.0.1

Fichier : `bande3.html` (copie de `bande2.html` avec les écrans de la 1.0.1), presets `bande3` et `bande3play` dans `render.mjs`.
Ordre : 1 fil, 2 choix de la discipline (accueil, photo running Unsplash), 3 création d'objectif, 4 publication avec vidéo coupée,
5 réactions, commentaires et GIF, 6 duo, 7 Activité (duel, relance, Défier un ami), 8 onglet Amis (recherche par sport),
9 badges, 10 carte de partage avec QR code (il ouvre la fiche App Store, vérifié au décodage).

```bash
cd ~/Desktop/Reiz/design/store
node render.mjs bande3         # 10 panneaux 1284 x 2778 dans out/bande3/
```

Sorties prêtes : `out/final3/app-store-6.5` (1284 x 2778) et `out/final3/app-store-6.9` (1320 x 2868, ffmpeg `scale` + `crop`).

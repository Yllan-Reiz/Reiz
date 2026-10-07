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

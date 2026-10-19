---
name: Reiz
description: Le site officiel de Reiz, l'appli sportive où ton cercle te regarde. Monde visuel hérité de l'app iOS.
colors:
  ink-black: "#0a0a0a"
  card-black: "#111111"
  surface-black: "#141414"
  field-black: "#1a1a1a"
  chip-black: "#1e1e1e"
  track-gray: "#222222"
  hairline-gray: "#2a2a2a"
  signal-white: "#ffffff"
  text-bright: "#eeeeee"
  text-soft: "#bbbbbb"
  text-body: "#a3a3a3"
  text-quiet: "#8a8a8a"
  notif-red: "#ff3b30"
  glass-smoke: "rgba(38, 38, 40, 0.5)"
  glass-hairline: "rgba(255, 255, 255, 0.14)"
  panel-light: "#f2f2f4"
  panel-ink: "#3c3c43"
  panel-text: "#55555c"
typography:
  display:
    fontFamily: "Inter, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "clamp(3rem, 1.6rem + 6.2vw, 6rem)"
    fontWeight: 900
    lineHeight: 0.94
    letterSpacing: "-0.04em"
  headline:
    fontFamily: "Inter, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "clamp(2.4rem, 1.5rem + 3.6vw, 4.5rem)"
    fontWeight: 900
    lineHeight: 0.98
    letterSpacing: "-0.04em"
  title:
    fontFamily: "Inter, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "clamp(1.75rem, 1.3rem + 1.4vw, 2.5rem)"
    fontWeight: 900
    lineHeight: 1.04
    letterSpacing: "-0.035em"
  lead:
    fontFamily: "Inter, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "clamp(1.06rem, 1rem + 0.35vw, 1.25rem)"
    fontWeight: 400
    lineHeight: 1.55
  body:
    fontFamily: "Inter, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "17px"
    fontWeight: 400
    lineHeight: 1.6
    fontFeature: "\"ss01\" 0, \"cv11\" 1"
  label:
    fontFamily: "Inter, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "15.5px"
    fontWeight: 800
    lineHeight: 1
    letterSpacing: "-0.01em"
  fine:
    fontFamily: "Inter, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "13.5px"
    fontWeight: 400
    lineHeight: 1.5
rounded:
  field: "14px"
  btn: "16px"
  card: "22px"
  faq: "24px"
  glass: "28px"
  big: "32px"
  pill: "999px"
spacing:
  gutter: "clamp(20px, 4vw, 40px)"
  container: "1200px"
  section-y: "clamp(96px, 14vw, 180px)"
  section-head-gap: "22px"
  section-head-after: "clamp(48px, 7vw, 88px)"
components:
  button-primary:
    backgroundColor: "{colors.signal-white}"
    textColor: "{colors.ink-black}"
    typography: "{typography.label}"
    rounded: "{rounded.btn}"
    padding: "0 24px"
    height: "54px"
  button-primary-hover:
    backgroundColor: "#e9e9ea"
  button-pill:
    backgroundColor: "{colors.signal-white}"
    textColor: "{colors.ink-black}"
    rounded: "{rounded.pill}"
    padding: "0 18px"
    height: "40px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.signal-white}"
    rounded: "{rounded.btn}"
    padding: "0 24px"
    height: "54px"
  button-on-light:
    backgroundColor: "{colors.ink-black}"
    textColor: "{colors.signal-white}"
    rounded: "{rounded.btn}"
    height: "54px"
  waitlist-field:
    backgroundColor: "{colors.glass-smoke}"
    textColor: "{colors.signal-white}"
    rounded: "{rounded.card}"
    padding: "6px"
  nav-bar:
    backgroundColor: "{colors.glass-smoke}"
    rounded: "{rounded.pill}"
    height: "60px"
    padding: "0 10px 0 22px"
  glass-card:
    backgroundColor: "{colors.glass-smoke}"
    textColor: "{colors.signal-white}"
    rounded: "{rounded.big}"
    padding: "26px"
  faq-item:
    backgroundColor: "{colors.card-black}"
    textColor: "{colors.signal-white}"
    rounded: "{rounded.faq}"
    padding: "22px 22px 22px 26px"
  goal-chip:
    backgroundColor: "{colors.card-black}"
    textColor: "{colors.signal-white}"
    rounded: "{rounded.pill}"
    padding: "0 22px 0 10px"
    height: "58px"
  gauge-track:
    backgroundColor: "{colors.track-gray}"
    rounded: "{rounded.pill}"
    height: "8px"
  gauge-fill:
    backgroundColor: "{colors.signal-white}"
    rounded: "{rounded.pill}"
    height: "8px"
---

# Design System: Reiz

Ce document décrit la surface web de Reiz (le site officiel, `site/`). Le monde visuel n'est pas né sur le site : il vient de l'app iOS, dont les sources de vérité restent `src/styles.ts` (palette, rayons, jauge, champs, avatars) et `src/components/GlassSurface.tsx` (le verre). Quand l'app change, ce fichier suit l'app. Les valeurs ci-dessous sont celles réellement livrées dans `site/assets/styles.css`.

## Overview

**Creative North Star: "La preuve sous verre"**

Reiz se montre comme il se vit. Le site ne raconte pas le sport, il affiche l'écran : un iPhone qui montre une vraie séance, une jauge blanche qui se remplit, des amis qui réagissent. Tout le reste (titres, formulaire, sections) existe pour encadrer cet écran. La preuve, c'est l'interface elle-même, reproduite en HTML à l'échelle exacte de l'app.

Le monde est noir presque pur, avec le blanc comme unique accent. La matière est le verre « Liquid Glass » de l'app, toujours posé sur une photo de salle floutée ou assombrie, jamais sur du noir vide. La couleur ne vient pas de l'interface : elle vient des photos de séance et des badges illustrés, qui sont les seuls objets autorisés à briller. La typographie est une seule famille, Inter, poussée au Black et serrée pour les titres, calme et grise pour le texte courant.

La densité est celle d'une page de marque mobile d'abord : grandes respirations verticales, une idée par section, et des objets (téléphones, badges, puces de verre) qui débordent légèrement de leur cadre pour donner du relief. Rejet confirmé : la landing fitness générique (néon, slogans de dépassement, grilles de cartes à icônes) et tout vert d'accent.

**Key Characteristics:**
- Fond noir #0a0a0a, blanc seul accent, aucune couleur d'interface en dehors du rouge de notification.
- Inter partout ; titres en Black (900), interlettrage de -0.04em, italique réservé aux deux titres signatures.
- Verre flouté sur photo de salle comme matière unique de relief.
- L'écran de l'app reproduit à l'identique comme preuve centrale.
- Jauge blanche de 8 px comme motif récurrent de progression.
- La couleur appartient aux photos et aux badges, jamais aux composants.

## Colors

Une palette en niveaux de noir, du plus profond au plus clair, avec un blanc pur qui porte toutes les actions et toutes les valeurs.

### Primary
- **Blanc Signal** (signal-white) : l'unique accent. Boutons principaux, jauge remplie, puce sélectionnée, case de jour validée, chiffres clés, titres. Si un élément est blanc plein, c'est qu'il agit ou qu'il mesure.

### Neutral
- **Noir Encre** (ink-black) : fond de toute la page et de chaque écran de téléphone ; texte des boutons blancs.
- **Noir Carte** (card-black) : fond des questions de la FAQ et des puces d'objectifs du bandeau défilant.
- **Noir Surface** (surface-black) : fond des médias en chargement et des sélecteurs segmentés dans les écrans.
- **Noir Champ** (field-black) : champs de saisie et pilules de duo dans les écrans de l'app.
- **Noir Puce** (chip-black) : puces non sélectionnées, ronds de jours, compteur de série.
- **Gris Piste** (track-gray) : piste vide de la jauge et des curseurs.
- **Gris Filet** (hairline-gray) : bordures de champs et de puces, filets discrets.
- **Texte Vif** (text-bright) : légendes des posts dans les écrans.
- **Texte Doux** (text-soft) : liens secondaires, liens fléchés, étiquettes de badges au repos.
- **Texte Courant** (text-body) : couleur par défaut du corps de texte et des paragraphes d'introduction. Le gras dans ce texte passe en blanc 600.
- **Texte Discret** (text-quiet) : mentions fines, métadonnées, notes sous les composants. C'est le gris le plus sombre autorisé pour du texte lisible.
- **Verre Fumé** (glass-smoke) et **Filet de Verre** (glass-hairline) : fond et contour du verre, détaillés dans Elevation & Depth.

### Tertiary
- **Rouge Notification** (notif-red) : uniquement la pastille de compteur sur l'icône cœur, comme dans iOS et dans l'app. Jamais un bouton, jamais un fond, jamais un texte.

### Panneau clair
- **Gris Clair App Store** (panel-light), **Encre Panneau** (panel-ink), **Texte Panneau** (panel-text) : le seul panneau clair de la page (« Comment ça marche »), qui reprend les visuels de la fiche App Store. Sur ce panneau, le bouton s'inverse en noir sur blanc et les titres passent en Noir Encre.

### Named Rules
**The One Voice Rule.** Le blanc est la seule couleur d'action. Aucun composant ne reçoit de teinte : pas de bleu de lien, pas de vert de succès (refusé explicitement), pas de dégradé de marque.

**The Color Belongs to Proof Rule.** La couleur n'entre sur la page que par les photos de séance et les badges illustrés. La teinte propre à chaque badge peut colorer une lueur de fond derrière le mur de badges et l'ombre du badge agrandi, et rien d'autre.

**The One Light Panel Rule.** Une page a au plus un panneau clair, arrondi et détaché des bords, qui inverse le système (fond Gris Clair, bouton noir, filets noirs de 2 px). Il marque un changement de registre, il ne devient pas un thème.

## Typography

**Display Font:** Inter variable (avec system-ui, -apple-system, Segoe UI, sans-serif)
**Body Font:** Inter variable (même pile)

**Character:** une seule famille, deux voix. Les titres en Black très serré frappent comme une affiche de salle ; le texte courant reste gris, aéré et bref, au tutoiement. Inter est servie localement en deux fichiers variables (droit et italique, graisses 100 à 900), avec le « l » à queue (cv11).

### Hierarchy
- **Display** (900, clamp de 3rem à 6rem, interligne 0.94, -0.04em) : uniquement les deux titres signatures, en italique, en ouverture et en clôture (« Ton cercle te regarde. », « Rejoins ton cercle. »).
- **Headline** (900, clamp de 2.4rem à 4.5rem, interligne 0.98, -0.04em) : un titre par section, droit, phrases courtes avec point final.
- **Title** (900, clamp de 1.75rem à 2.5rem, interligne 1.04, -0.035em) : titres d'étapes de fonctionnalités et du badge sélectionné.
- **Lead** (400, clamp de 1.06rem à 1.25rem, interligne 1.55, 34em max) : la phrase d'introduction sous chaque titre de section.
- **Body** (400, 17px, interligne 1.6, 32em max) : texte des étapes, réponses de FAQ (40em max).
- **Label** (800, 15.5px, -0.01em) : texte des boutons ; les petits titres de composants (puces de verre, questions de FAQ) restent en 700 avec un interlettrage légèrement négatif.
- **Fine** (400, 13.5px, interligne 1.5) : mentions sous formulaire, notes, légendes.

### Named Rules
**The Two Italics Rule.** L'italique est réservé aux deux titres signatures de la page, comme sur la fiche App Store. Un troisième titre italique en dilue la signature.

**The Tight Black Rule.** Tout titre est en 900 avec un interlettrage négatif (entre -0.025em et -0.04em) et un interligne sous 1.1. Pas de titre en graisse moyenne, pas de titre en capitales espacées.

**The Real Numbers Rule.** Les chiffres de progression s'écrivent en Black avec leur vraie unité en plus petit et plus gris à côté (« 150 kg sur 170 kg », « 7 / 11 »), en chiffres tabulaires dans les jauges. Jamais de pourcentage abstrait.

## Layout

Conteneur centré de 1200 px avec une gouttière fluide (clamp de 20 à 40 px). Chaque section respire avec un padding vertical fluide (clamp de 96 à 180 px) ; l'en-tête de section empile titre et introduction avec 22 px d'écart, puis laisse 48 à 88 px avant le contenu.

Les grilles sont asymétriques et à deux colonnes sur bureau (1.1fr / 0.9fr dans le hero, 1fr / 0.8fr pour le concept, 0.8fr / 1.2fr pour la FAQ avec colonne de titre collante) et passent en une colonne sous 960 px. Le mur de badges est sur 6 colonnes, puis 4, puis 3 sous 560 px. Le pied de page passe de 4 colonnes à 2 puis 1.

Les fonctionnalités utilisent un téléphone collant sur bureau (au-dessus de 960 px, JavaScript actif) : le texte défile à gauche, l'écran change à droite. Sans JavaScript ou sur mobile, chaque étape porte son propre téléphone en ligne. Le contenu reste visible sans aucune animation.

Points de rupture observés : 360, 520, 560, 880 (navigation), 960 (grilles), 1100, 1240 px.

### Named Rules
**The Real Screen Rule.** Un écran d'app reproduit sur le site garde les proportions de l'iPhone (390 × 844) et les valeurs de l'app, mises à l'échelle par une unité relative au conteneur (100cqw / 390). On ne redessine pas l'app, on la reproduit.

## Elevation & Depth

Hybride : les surfaces de contenu sont plates et séparées par des filets intérieurs d'un pixel, tandis que le relief vient du verre et des objets physiques. Le verre (fond rgba(38, 38, 40, 0.5), flou de 22 px avec saturation 1.5, reflet en dégradé vertical, contour blanc à 20 % qui s'éteint à 6 % en bas) est toujours posé sur une photo de salle floutée ou masquée en radial. Les ombres portées existent mais seulement sous des objets : le téléphone, les badges flottants et les puces de verre qui débordent du téléphone.

### Shadow Vocabulary
- **Objet téléphone** (`box-shadow: 0 40px 80px -20px rgba(0,0,0,0.85), 0 18px 30px -12px rgba(0,0,0,0.6)`) : sous le boîtier de l'iPhone uniquement.
- **Badge flottant** (`filter: drop-shadow(0 18px 30px rgba(0,0,0,0.55))`) : badges illustrés posés autour du téléphone.
- **Puce de bord** (`box-shadow: 0 18px 40px -12px rgba(0,0,0,0.6)`) : la puce de verre qui déborde du téléphone collant.
- **Filet intérieur** (`box-shadow: inset 0 0 0 1px rgba(255,255,255,0.14)`) : contour des cartes de verre plates et des bulles de statistiques ; sur les cartes noires, la même logique avec #1d1d1d ou #222.

### Named Rules
**The Glass Needs a Photo Rule.** Le verre ne se pose jamais sur du noir vide : il y a toujours derrière lui une photo de salle, floutée, assombrie ou masquée en radial. Sans photo, utiliser une carte noire à filet intérieur.

**The Objects Cast, Surfaces Don't Rule.** Seuls les objets (téléphone, badges, puces qui débordent) portent une ombre. Cartes, FAQ, champs et boutons restent plats.

## Shapes

Tout est arrondi, rien n'est anguleux. L'échelle suit l'app : 14 px pour les champs, 16 px pour les boutons, 22 px pour les cartes et médias de post, 24 px pour la FAQ, 28 px pour le verre, 32 px pour les grandes cartes, et la pilule complète pour la navigation, les puces, les jauges et les boutons compacts. Les avatars, les jours de la semaine et les boutons ronds sont des cercles parfaits. Le boîtier du téléphone garde sa silhouette d'iPhone avec îlot dynamique. Les filets sont toujours d'un pixel (1.5 px dans les écrans d'app), jamais plus épais, sauf le filet noir de 2 px qui ouvre chaque étape du panneau clair.

## Components

### Buttons
Francs et blancs, ils se pressent physiquement.
- **Shape:** coins doux (16px), hauteur 54 px ; version pilule (999px) de 40 px dans la navigation.
- **Primary:** blanc plein, texte Noir Encre en 800, 15.5 px.
- **Hover / Focus:** passe en #e9e9ea au survol ; compression à 0.97 à l'appui (160 ms, courbe de pression) ; focus visible par un contour blanc de 2 px décalé de 3 px.
- **Ghost:** transparent, texte blanc, contour intérieur blanc à 22 %, fond blanc à 8 % au survol.
- **Sur panneau clair:** inversé, noir plein et texte blanc, #2a2a2a au survol.
- **Lien fléché:** texte Doux en 600 avec flèche SVG qui glisse de 3 px au survol ; cible de 44 px minimum.

### Chips
- **Style:** pilules. Sur le site, les puces d'objectifs du bandeau défilant sont Noir Carte avec filet #222, un rond d'emoji Noir Puce et un texte blanc en 700. La puce de note (sous une étape) est blanche à 8 % avec texte Doux.
- **State:** dans les écrans d'app, la puce sélectionnée est blanche pleine avec texte noir en 800 ; la puce en saisie porte un anneau blanc intérieur.

### Cards / Containers
- **Corner Style:** 22 à 36 px selon la taille (verre 28px, grande carte 32px).
- **Background:** verre fumé sur photo, ou Noir Carte à plat.
- **Shadow Strategy:** aucune ombre, filet intérieur (voir Elevation & Depth).
- **Border:** contour de verre clair en haut et presque éteint en bas.
- **Internal Padding:** 26 px (22 px sous 560 px) ; 22 à 36 px fluide pour le détail de badge.

### Inputs / Fields
- **Style:** le formulaire de liste d'attente est une barre de verre (rayon 22 px, 6 px de marge intérieure) qui contient un champ transparent de 54 px et le bouton blanc. Le texte est blanc, le placeholder #8c8c8c. Sous 520 px, le bouton passe sous le champ en pleine largeur.
- **Focus:** le contour du verre s'éclaire à 55 % de blanc sur toute la barre.
- **Error / Disabled:** message d'erreur en #ff8a80 sous la barre ; bouton désactivé à 75 % d'opacité avec une roue noire. Le succès remplace la barre par une carte de verre avec une coche noire dans un rond blanc.

### Navigation
- **Style:** une pilule de verre flottante, fixée à 14 px du haut, 980 px de large au plus, 60 px de haut. Logo blanc à gauche, liens en 600 et 14.5 px à 72 % de blanc, pilule blanche « Être prévenu » à droite.
- **Hover:** le lien passe en blanc sur un fond blanc à 8 %.
- **Mobile:** sous 880 px, les liens disparaissent au profit d'un bouton rond de 44 px qui ouvre une feuille de verre (rayon 28 px) avec des liens en 700 et 19 px.

### Téléphone de démonstration (signature)
Un iPhone construit en HTML et CSS (boîtier en dégradé de titane sombre, îlot dynamique, barre d'état 9:41) qui affiche de vrais écrans de l'app : fil, création d'objectif, publication, activité, profil. Il porte le rôle `img` et une description complète. Sur bureau, dans les fonctionnalités, il reste collant et change d'écran par fondu (450 ms) avec un léger dézoom (700 ms), pendant que la jauge de l'écran actif se remplit.

### Jauge (signature)
Piste Gris Piste de 8 px en pilule, remplissage blanc plein, chiffre en 800 tabulaire à droite. Elle se remplit à l'entrée (de 4 % à sa valeur, 1400 ms dans le hero, 900 ms dans les écrans), et la ligne de clôture se remplit au défilement. C'est le motif de progression du site entier.

### Puce de bord (signature)
Une pilule de verre de 52 px qui déborde du cadre du téléphone, avec une icône SVG et deux lignes (700 blanc, puis 500 à 65 %). Elle ré-apparaît avec un petit saut (520 ms) à chaque changement d'écran.

### Mur de badges (signature)
Les badges illustrés en verre sont des boutons à état pressé. Au survol à la souris, le badge s'incline en 3D (jusqu'à 13 degrés, perspective de 600 px) et un reflet radial suit le pointeur, masqué par la silhouette du badge pour ne jamais déborder. La teinte du badge choisi colore la lueur de fond de la section et l'ombre du badge agrandi dans la carte de détail, qui montre aussi les six niveaux en ronds. Tilt et reflet sont désactivés en tactile et en mouvement réduit ; les flèches du clavier parcourent le mur.

### FAQ
Questions en `details` natifs Noir Carte (rayon 24px) avec filet #1d1d1d, question blanche en 700 et 17.5 px, bouton plus rond qui tourne de 45 degrés et devient blanc à l'ouverture. Une seule réponse ouverte à la fois ; la hauteur s'anime quand le navigateur le permet.

## Do's and Don'ts

### Do:
- **Do** garder `src/styles.ts` et `src/components/GlassSurface.tsx` comme source amont : une valeur qui change dans l'app change ici.
- **Do** utiliser le blanc (#ffffff) comme seule couleur d'action, avec un texte Noir Encre dessus.
- **Do** poser le verre (flou 22 px, saturation 1.5, fond rgba(38, 38, 40, 0.5)) sur une photo de salle floutée ou masquée.
- **Do** écrire les titres en Inter 900 avec un interlettrage de -0.035em à -0.04em, et réserver l'italique aux deux titres signatures.
- **Do** montrer la progression avec la jauge blanche de 8 px et de vrais chiffres dans leur unité.
- **Do** utiliser la courbe cubic-bezier(0.22, 1, 0.36, 1) pour les entrées et la compression à 0.97 pour les appuis.
- **Do** laisser tout contenu visible sans animation : apparitions en CSS via `animation-timeline`, coupées en mouvement réduit.
- **Do** garder le texte gris au-dessus de #8a8a8a sur fond noir.

### Don't:
- **Don't** introduire de vert d'accent, ni aucune teinte d'interface : la couleur appartient aux photos et aux badges.
- **Don't** utiliser le rouge #ff3b30 ailleurs que sur une pastille de compteur.
- **Don't** poser une ombre portée sous une carte, un champ ou un bouton ; seuls les objets en portent.
- **Don't** poser du verre sur du noir uni.
- **Don't** construire de grille de cartes à icônes, de néon ou de slogan de dépassement : c'est la landing fitness générique que Reiz refuse.
- **Don't** mettre de surtitre en petites capitales espacées au-dessus d'un titre. Les étiquettes en capitales espacées n'existent qu'à l'intérieur des écrans d'app reproduits, parce que l'app les utilise pour ses champs.
- **Don't** utiliser de pictogramme en caractère ou d'emoji comme icône d'interface du site : les icônes sont des SVG au trait. Les emojis restent du contenu (réactions, objectifs) comme dans l'app.
- **Don't** écrire de tiret cadratin ni de point médian dans les textes.

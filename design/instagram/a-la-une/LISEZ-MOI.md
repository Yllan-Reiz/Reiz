# Onglets « à la une » du profil @reiz_officiel

Créés le 23/11/2026. Même gabarit que `../profil` (disque sombre, trait blanc, 1080x1920, Instagram garde le cercle central).
Rendu : `node rendu.cjs` (Playwright), sorties dans `png/`.

## Rangée conseillée (6 onglets, dans cet ordre)

| ordre | nom affiché | couverture | contenu |
|---|---|---|---|
| 1 | Appli | `../profil/png/a-la-une-appli.png` | ce que fait Reiz + lien App Store |
| 2 | Vos séances | `png/a-la-une-reposts.png` | republications des stories qui identifient le compte |
| 3 | Collabs | `png/a-la-une-collabs.png` | salles, clubs, créateurs partenaires |
| 4 | Badges | `../profil/png/a-la-une-badges.png` | les 12 badges |
| 5 | FAQ | `png/a-la-une-faq.png` | 4 questions (gratuit, vie privée, duo, Android) |
| 6 | Coulisses | `png/a-la-une-coulisses.png` | facultatif, seulement si alimenté chaque semaine |

À retirer : « Sortie » (l'appli est sortie, l'onglet est périmé). « Cercle » et « Nouveau » : à fusionner dans « Appli » tant qu'ils ont moins de 5 stories.

## Stories d'ouverture

Un onglet ne peut pas être créé vide : il faut d'abord publier une story, puis l'ajouter à la une.
`png/story-collabs.png`, `png/story-reposts.png`, `png/story-faq-1.png` à `-4.png`, `png/story-coulisses.png`.
Zone laissée libre entre le texte et la ligne du bas pour l'autocollant lien ou mention.

## Mise en ligne (appli Instagram sur téléphone uniquement)

1. Publier la story d'ouverture.
2. Profil, « + Nouveau » dans la rangée à la une, choisir la story, nommer l'onglet.
3. « Modifier la couverture », icône image, choisir le fichier `a-la-une-*.png`, laisser le disque centré.
4. L'ordre de la rangée suit la dernière story ajoutée : pour remonter un onglet, lui ajouter une story.

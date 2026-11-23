# Onglets « à la une » du profil @reiz_officiel

Version 2 du 23/11/2026, dans le langage de l'appli : photos de salle de Yllan floutées, lentille de verre,
badges lumineux, composants réels (jauge, duo validé, pastilles de visibilité, « Quoi de neuf sur Reiz »).
Rendu : `node rendu.cjs` (Playwright), sorties dans `png/`. Source unique : `a-la-une.html`.

Les gemmes Vos séances, Collabs, Badges et Cercle sont les vrais badges de l'appli (agrandis dans `assets/`).
Celles de FAQ, Coulisses et Nouveau sont dessinées dans le même esprit, car aucun badge ne correspond.

## Rangée conseillée (6 onglets, dans cet ordre)

| ordre | nom affiché | couverture | contenu |
|---|---|---|---|
| 1 | Appli | `png/a-la-une-appli.png` | ce que fait Reiz + lien App Store |
| 2 | Vos séances | `png/a-la-une-reposts.png` | republications des stories qui identifient le compte |
| 3 | Collabs | `png/a-la-une-collabs.png` | salles, clubs, créateurs partenaires |
| 4 | Badges | `png/a-la-une-badges.png` | les 12 badges |
| 5 | FAQ | `png/a-la-une-faq.png` | 4 questions (gratuit, vie privée, duo, Android) |
| 6 | Coulisses | `png/a-la-une-coulisses.png` | facultatif, seulement si alimenté chaque semaine |

En réserve : `png/a-la-une-cercle.png`, `png/a-la-une-nouveau.png`.
À retirer du profil : « Sortie » (l'appli est sortie, l'onglet est périmé).
Les anciennes couvertures à trait blanc restent dans `../profil/png/` : ne pas mélanger les deux styles dans la rangée.

## Stories d'ouverture

Un onglet ne peut pas être créé vide : il faut d'abord publier une story, puis l'ajouter à la une.
`png/story-collabs.png`, `png/story-reposts.png`, `png/story-faq-1.png` à `-4.png`, `png/story-coulisses.png`.
Le bas de chaque story est laissé libre pour l'autocollant lien ou mention.
Textes de la FAQ repris du site, nouveautés reprises de `src/lib/changelog.ts` : à mettre à jour si l'appli change.

## Mise en ligne (appli Instagram sur téléphone uniquement)

1. Publier la story d'ouverture.
2. Profil, « + Nouveau » dans la rangée à la une, choisir la story, nommer l'onglet.
3. « Modifier la couverture », icône image, choisir le fichier `a-la-une-*.png`, puis écarter deux doigts jusqu'à ce que la lentille de verre touche le bord du cercle.
4. L'ordre de la rangée suit la dernière story ajoutée : pour remonter un onglet, lui ajouter une story.

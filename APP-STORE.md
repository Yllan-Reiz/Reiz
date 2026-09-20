# Fiche App Store Connect — Reiz

Document de travail : chaque bloc est prêt à copier-coller dans le champ correspondant.
Les limites de caractères d'Apple sont indiquées, le compte actuel est entre parenthèses.

---

## Informations générales

| Champ | Valeur |
|---|---|
| Nom (30 max) | `Reiz` |
| Sous-titre (30 max) | `Tes objectifs, ton cercle` (25) |
| Catégorie principale | Forme et santé |
| Catégorie secondaire | Réseaux sociaux |
| Langue principale | Français |
| Prix | Gratuit |
| Bundle ID | `com.yllan.reiz` |

Le sous-titre s'affiche sous le nom dans les résultats de recherche. Il est indexé
par l'App Store, au même titre que le nom et les mots-clés.

---

## Texte promotionnel (170 max)

Modifiable à tout moment sans repasser en validation. À utiliser pour les annonces.

```
Reiz sort enfin. Choisis ton objectif, invite tes proches, et laisse leur regard
faire ce que la motivation seule n'arrive pas à tenir.
```

(148 caractères)

---

## Description

```
La discipline seul, ça ne tient pas.

Les applications de sport te demandent d'être motivé tout seul. Reiz fait
l'inverse : elle met ton entourage dans la boucle. Tu choisis un objectif, tu
invites les personnes qui comptent, et chacun voit la progression de l'autre,
chaque jour.

Quand quelqu'un que tu respectes regarde, tu te lèves.


COMMENT ÇA MARCHE

1. Fixe ton objectif
Courir 10 km, 30 séances de sport, perdre 5 kg, méditer chaque matin. Tu choisis
l'unité qui te parle et la durée sur laquelle tu t'engages.

2. Invite ton cercle
Trois proches suffisent. Pas des inconnus, pas des abonnés : les gens dont
l'avis compte vraiment pour toi.

3. Poste ta progression
Une photo, un pourcentage, deux mots. Ton cercle voit où tu en es et te répond.


CE QUE TU TROUVES DANS REIZ

Un fil réservé à ton cercle
Pas d'algorithme, pas d'inconnus, pas de recommandations. Uniquement les
personnes que tu as choisies.

Une série de jours qui compte
Chaque jour où tu publies prolonge ta série. Elle s'arrête si tu t'arrêtes, et
tes proches le voient aussi.

Ton assiduité en un coup d'œil
Chaque objectif affiche sa grille des jours tenus et des jours manqués, sur la
durée que tu as fixée.

Réactions et commentaires
Ton cercle réagit, t'encourage, te relance. C'est le moteur de l'app.


LA CONFIDENTIALITÉ, PAR DÉFAUT

Chaque objectif a sa visibilité : public, réservé à tes amis, ou strictement
privé. Un objectif privé n'est visible que par toi, photos comprises.

Tu peux bloquer un utilisateur, signaler un contenu, et supprimer ton compte et
toutes tes données depuis l'app, à tout moment.

Reiz ne vend pas tes données et ne diffuse pas de publicité.


Reiz est gratuit.

Conditions d'utilisation : https://reizapp.netlify.app/cgu.html
Confidentialité : https://reizapp.netlify.app/confidentialite.html
```

---

## Mots-clés (100 max, séparés par des virgules, sans espace)

```
objectif,motivation,habitude,discipline,progression,defi,entrainement,amis,routine,suivi,serie
```

(94 caractères)

Trois règles respectées ici : aucun mot déjà présent dans le nom ou le
sous-titre (Apple les indexe séparément, les répéter gaspille des caractères),
aucun nom de concurrent, et pas de pluriels inutiles — l'App Store gère les
variantes seul.

---

## Notes pour l'examinateur

C'est le champ le plus souvent bâclé, et une cause fréquente de rejet pour une
app sociale : sans contenu ni amis, un examinateur voit un écran vide et conclut
que l'app est incomplète.

```
Bonjour,

Reiz est une application de suivi d'objectifs où la progression est partagée
avec un cercle de proches choisis.

COMPTE DE DÉMONSTRATION
Email : [À COMPLÉTER]
Mot de passe : [À COMPLÉTER]

Ce compte contient déjà des objectifs en cours, des publications et un ami
accepté, afin que le fil et le profil soient représentatifs de l'expérience
réelle dès la connexion.

FONCTIONNALITÉS DE MODÉRATION (guideline 1.2)
- Signaler une publication : appui sur le menu « … » d'une carte du fil
- Signaler ou bloquer un profil : menu « … » en haut du profil d'un utilisateur
- Un utilisateur bloqué disparaît des deux côtés, immédiatement

SUPPRESSION DE COMPTE (guideline 5.1.1)
Onglet Profil, en bas : « Supprimer mon compte ». La suppression est immédiate
et définitive : données, publications et photos sont effacées côté serveur.

NOTIFICATIONS
Les notifications push signalent les réactions, commentaires, demandes d'ami et
publications du cercle. Elles ne sont pas nécessaires pour évaluer l'app.

Merci pour votre temps.
```

---

## Questionnaire App Privacy

À remplir dans App Store Connect → Confidentialité de l'app. Réponses conformes
à ce que l'app collecte réellement.

**Collectez-vous des données ?** Oui

| Donnée | Catégorie Apple | Usage | Liée à l'identité | Suivi publicitaire |
|---|---|---|---|---|
| Email | Coordonnées → Adresse e-mail | Fonctionnement de l'app | Oui | Non |
| Prénom, pseudo | Coordonnées → Nom | Fonctionnement de l'app | Oui | Non |
| Photos publiées et de profil | Contenu utilisateur → Photos ou vidéos | Fonctionnement de l'app | Oui | Non |
| Légendes, commentaires | Contenu utilisateur → Autre contenu | Fonctionnement de l'app | Oui | Non |
| Jeton de notification | Identifiants → Identifiant d'appareil | Fonctionnement de l'app | Oui | Non |

**Point important :** à la question « Utilisez-vous ces données à des fins de
suivi ? », réponds **Non** partout. Reiz n'a ni régie publicitaire, ni outil
d'analyse tiers. Répondre oui déclencherait l'obligation d'afficher la demande
de pistage (App Tracking Transparency), que l'app n'implémente pas — et
l'incohérence serait détectée.

---

## Captures d'écran

Formats obligatoires : iPhone 6.7 pouces (1290 × 2796) et 6.5 pouces
(1242 × 2688). Cinq à six suffisent.

Ordre suggéré, du plus parlant au plus fonctionnel :

1. Le fil avec des publications et des réactions — c'est le cœur du produit
2. Un objectif avec sa grille d'assiduité remplie
3. L'écran de publication avec photo et curseur de progression
4. Le profil avec la série de jours et les statistiques
5. L'onglet Amis avec quelques membres du cercle

Prends-les sur un compte réellement rempli. Une capture de fil vide dessert
l'app plus qu'elle ne l'explique.

---

## Avant de soumettre

- [ ] Compte de démonstration créé, rempli, et identifiants reportés dans les notes
- [ ] Captures d'écran aux deux formats
- [ ] Questionnaire App Privacy complété
- [ ] Classification par âge remplie (déclarer le contenu généré par les utilisateurs)
- [ ] URLs d'assistance et de confidentialité renseignées
- [ ] Build envoyé via EAS et sélectionné dans la version

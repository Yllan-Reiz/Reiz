# Contacts : ce qu'il faut publier avec la fonction

Rien de ce dossier n'est en ligne. Il sert le jour où un build avec la fonction « Retrouver mes contacts » part chez Apple
(et Google). Tant que le build en revue (build 10) n'a pas la fonction, la politique en ligne ne doit PAS en parler.

## Ce que fait la fonction (pour répondre juste aux formulaires)

- L'app demande l'accès au carnet d'adresses quand la personne touche « Retrouver mes contacts ». Elle lit noms, e-mails et numéros.
- Noms, e-mails et numéros ne quittent jamais le téléphone.
- Seules des EMPREINTES SHA-256 des adresses e-mail (minuscules) partent vers Supabase (UE), 500 à la fois, 1 000 au plus par appel.
- Le serveur compare avec l'empreinte de l'e-mail de chaque compte Reiz et renvoie les comptes qui correspondent
  (prénom, pseudo, photo), 300 au plus, sans soi-même ni les comptes bloqués (dans un sens comme dans l'autre).
  Il n'écrit rien : la fonction SQL `match_contacts` est en lecture seule.
- Les numéros servent à ouvrir Messages avec un texte d'invitation déjà rempli. Reiz n'envoie jamais le message : la personne touche « Envoyer ».
- Un compte Apple « Masquer mon e-mail » (adresse relais) ne peut pas être retrouvé.

## 1. Politique de confidentialité

| Où | Fichier | État |
|---|---|---|
| Dans l'app (Réglages, Légal) | `src/lib/legal.ts` | DÉJÀ PRÊT. Les passages Contacts ne s'affichent que dans une version qui embarque la fonction (`contactsAvailable()`). Un build ancien qui reçoit une mise à jour à distance garde l'ancien texte. |
| Site web | `a-publier-avec-contacts/confidentialite.html` | À copier par-dessus `site/confidentialite.html` le jour de la sortie, puis publier le site. |

Le texte ajouté couvre : la donnée (carnet d'adresses lu sur le téléphone, empreintes envoyées, rien conservé), la base légale
(consentement, retirable dans les réglages de l'iPhone), la visibilité (quelqu'un qui a ton e-mail dans ses contacts peut te trouver),
la durée (empreintes non conservées).

La page du site porte la date du 20 octobre 2026 : la corriger le jour de la publication.

## 2. App Store Connect, « Confidentialité de l'app »

À faire AVANT de soumettre le build avec Contacts (jamais avant : le build 10 n'a pas la fonction).

Réponse conseillée, la plus prudente : ajouter la ligne suivante.

| Donnée | Catégorie Apple | Usage | Liée à l'identité | Suivi |
|---|---|---|---|---|
| Contacts | Contacts, Contacts | Fonctionnalité de l'app | Non | Non |

Pourquoi la déclarer : noms, e-mails et numéros ne quittent pas le téléphone, mais des empreintes d'e-mails partent vers nos serveurs.
Apple ne compte pas comme « collectées » les données traitées seulement en temps réel sans être conservées, donc « Non collecté »
se défend. Mais déclarer par excès ne coûte rien, alors qu'oublier peut valoir un refus (guideline 5.1.2). Tout le reste du questionnaire
(e-mail, nom, photos, etc.) ne change pas. « Suivi » reste « Non » partout.

Le texte d'autorisation affiché par iOS est déjà dans `app.json` :
« Reiz regarde tes contacts pour te dire lesquels sont déjà sur l'app et te laisser inviter les autres. Tes contacts ne sont jamais enregistrés par Reiz. »

## 3. Google Play, « Sécurité des données »

À remplir quand l'Android avec Contacts est prêt.

- Informations personnelles, Contacts : utilisé pour la fonctionnalité de l'app, non partagé avec des tiers.
- Option « traitement éphémère » : les empreintes sont traitées en mémoire puis oubliées. Google précise que le hachage ne rend pas la donnée anonyme,
  donc la déclarer reste le plus sûr. Les formulaires changent : relire les questions au moment de remplir.
- Autorisation Android : le plugin `expo-contacts` ajoute READ_CONTACTS ET WRITE_CONTACTS. Reiz ne fait que lire : ajouter
  `android.permission.WRITE_CONTACTS` à `blockedPermissions` dans `app.json` avant de lancer le build Android (sinon Google demandera de la justifier).

## 4. Pouvoir ne pas être retrouvé : FAIT

Colonne `users.discoverable` (défaut vrai) et réglage « Me proposer à mes contacts » dans Réglages, Confidentialité (visible seulement
dans une version qui a Contacts). `match_contacts` ne renvoie plus les comptes qui l'ont coupé. SQL : `supabase/phase15-contacts-visibles.sql`
(déjà exécuté). La politique le dit.

## Liste du jour J

- [x] `a-publier-avec-contacts/confidentialite.html` copié sur `site/confidentialite.html`, date corrigée (23/10/2026, avec GIPHY), site publié
- [x] App Privacy : ligne « Contacts » ajoutée dans App Store Connect (23/10/2026, non liée, pas de suivi)
- [ ] Google Play : sécurité des données mise à jour, WRITE_CONTACTS bloquée
- [x] Notes pour l'examinateur : dire que « Retrouver mes contacts » est facultatif et que rien n'est enregistré
- [x] Version passée à 1.0.1 ou 1.1.0 dans `app.json`, APRÈS l'envoi éventuel de la mise à jour à distance

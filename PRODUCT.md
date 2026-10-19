# Product

<!-- impeccable:product-schema 1 -->

> Rédigé le 11/10/2026 à partir du code, de la mémoire du projet et de l'historique des échanges, sans
> séance de questions (Yllan a demandé de ne poser une question que si une info indispensable manque).
> Les points marqués « déduit » sont à confirmer.

## Platform

ios (l'app) ; le site officiel est `web`.

## Stack

App : Expo SDK 54 / React Native 0.81 / Supabase (projet `vpaizbtetwsnvbpmeuab`).
Site : HTML/CSS/JS statique sans build, hébergé sur Netlify (site `reiz-landing`), comme la landing
existante. Choix délégué : pas de framework, car le site est une page unique et les pages légales
existantes doivent garder leurs adresses.

## Users

Sportifs de 18 à 25 ans (salle surtout, mais aussi course, vélo, natation, boxe) qui s'entraînent
avec des amis ou à côté d'eux et lâchent quand personne ne voit. Ils utilisent déjà Instagram et
BeReal ; Reiz est pensé pour eux sur iPhone.

## Product Purpose

Reiz est un réseau social d'objectifs sportifs : tu poses un objectif chiffré, tu postes la preuve
de chaque séance (photo ou vidéo de 15 s), et ton cercle d'amis voit ta progression et réagit.
Réussir, c'est rester régulier parce que ton cercle te regarde.

## Positioning

La régularité vient du regard des proches, pas d'un programme ni d'un coach : objectif dans sa vraie
unité (kg, km, séances), preuve en image, cercle qui réagit, duo validé quand deux amis postent à
moins d'une heure d'écart. Slogan : « Ton cercle te regarde. » Signature sous le logo : « Rise to
your goals » (seule phrase en anglais).

## Operating Context

L'app se sort à la salle ou juste après la séance. Le site est vu surtout depuis Instagram
(@reiz_officiel, lien en bio) sur téléphone, souvent dans le navigateur intégré d'Instagram.

## Capabilities and Constraints

Confirmé dans le build 8 (envoyé à Apple le 05/10/2026) : objectifs chiffrés dans leur unité, posts
photo et vidéo 15 s, jauge de progression, fil, réactions emoji et commentaires, visibilité par
objectif (Privé, Mon cercle, Cercle proche), duo (identifier jusqu'à 3 amis, duo validé à moins
d'1 h), 12 badges, profil avec série, épingles, historique, invitation par lien, notifications
(rappel du soir, réactions, duo), « À la salle » pour le cercle proche (iPhone), connexion Apple,
Google ou e-mail.

Codé, envoyé par mise à jour à distance après la sortie (pas encore publié au 11/10/2026) : défi
duo d'une semaine, jours d'entraînement, badges à 6 niveaux (paliers proposés, non validés,
visuels par niveau absents), encouragements, régularité du cercle, design verre des onglets,
accueil d'un compte neuf.

Pas avant la 1.1.0 : retrouver ses contacts, liens universels, copie du lien en 1 tap.

Disponibilité : PAS encore sur l'App Store au 11/10/2026 (validation Apple en attente, date de
sortie inconnue). Gratuit (prix 0,00 € dans App Store Connect). Android en test fermé Google Play,
pas de sortie publique prévue avant plusieurs semaines. iPhone uniquement (pas d'iPad).

N'existe pas et ne doit jamais être annoncé : programmes d'entraînement, séries/charges détaillées,
nutrition, classements publics, statistiques avancées, récompenses financières, coach.

## Brand Commitments

Thème sombre (#0a0a0a), accent blanc unique, Inter partout (titres en Black, interlettrage serré),
verre « Liquid Glass » sur fond de photo floutée, aucune ombre portée lourde. La couleur vient des
photos de séance et des badges. Pas de vert d'accent (refusé par Yllan). Ton direct, taquin,
tutoiement, phrases courtes. Sport uniquement. Jamais « bêta » ni « TestFlight » côté public.
Aucun tiret cadratin ni point médian dans les textes livrés. Aucune personne reconnaissable sur
les photos, aucune photo générée par IA.

## Evidence on Hand

- Logo vectoriel : `~/Desktop/Reiz-DA-site/logos/reiz-currentcolor.svg`. Icône : `assets/icon.png`.
- 12 badges illustrés (verre, 240 px) : `assets/badges/*.png`.
- Photos de salle de Yllan, sans personne : `design/store/assets/gym-*.jpg`.
- Visuels App Store validés le 05/10/2026 : `design/store/out/final/`.
- Liste d'attente fonctionnelle : table Supabase `waitlist` (insert anonyme, contrainte de format).
- Instagram officiel : https://www.instagram.com/reiz_officiel. Contact : reizapp.contact@gmail.com.
- Pages légales en ligne : /cgu.html, /confidentialite.html, /suppression-compte.html, /invite.html.

Absents, à ne pas inventer : nombre d'utilisateurs, avis, témoignages, presse, partenaires, note
App Store, lien App Store (tant que l'app n'est pas publiée), mentions légales complètes (éditeur,
adresse, SIRET inconnus).

## Product Principles

1. Le regard du cercle avant tout : chaque écran sert à voir et être vu par ses proches.
2. La preuve, pas la déclaration : une séance compte quand elle est postée.
3. Vrais chiffres dans la vraie unité, jamais de pourcentage abstrait.
4. Vie privée choisie objectif par objectif.
5. Honnêteté : on ne montre que ce que l'app fait vraiment.

## Accessibility & Inclusion

Pas d'exigence spécifique établie. Viser WCAG 2.2 AA sur le site (contrastes, clavier, réduction
des animations).

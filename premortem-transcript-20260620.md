# Premortem — Reiz · Lancement TestFlight & Build-in-Public
_Généré le 20 juin 2026 · méthode Gary Klein (prospective hindsight)_

## Contexte rassemblé

- **Quoi ?** Reiz — app sociale d'accountability « ton cercle te regarde ». Tu suis tes objectifs (course, lecture, poids, argent…), tes amis voient ta progression, tes streaks, et réagissent (réactions, commentaires, feed). Stack Expo SDK 54 / RN 0.81 / Supabase. Fondateur solo (Yllan), débutant, construit avec Claude.
- **Pour qui ?** D'abord un cercle de **10-30 testeurs** (amis/connaissances) en TestFlight. Ensuite une audience **build-in-public** (TikTok/Insta), puis les utilisateurs des stores.
- **Succès =** les testeurs utilisent réellement l'app de façon répétée (check-in quotidien, posts de progression, réactions aux amis), la boucle sociale crée de la rétention, ce qui génère le momentum et le signal qui justifient le passage aux stores + le build-in-public.
- **Décision imminente premortemée :** lancer en TestFlight à 10-30 testeurs, puis build-in-public avant la sortie stores.

**Tension repérée dans le code :** `src/lib/notifications.ts` ne fait que 32 lignes et « Notifications push » est encore listé en TODO dans `NOTES.md` — alors que pour une app d'accountability, la notif est le moteur de rétention central.

---

## Cadrage du premortem

> Nous sommes en **décembre 2026**. Reiz a échoué. Le lancement TestFlight n'a pas pris, le build-in-public n'a généré aucune traction, et l'app est abandonnée dans un dossier sur les téléphones des testeurs. On remonte aux causes.

---

## Premortem brut — 8 modes de défaillance

1. **Le feed vide (cold start / réseau insuffisant)** — 30 testeurs éparpillés sur des objectifs différents → chacun voit un feed quasi désert → spirale du réseau social mort.
2. **La mécanique de honte** — la pression sociale (cœur du concept) fait *fuir* plutôt qu'engager : casser un streak ou rater un objectif intime devant ses amis pousse à l'évitement.
3. **La boucle de rappel trop faible** — notifs push embryonnaires → rien ne ramène l'utilisateur → app oubliée.
4. **Le faux signal des amis polis** — les testeurs sont le cercle de Yllan, gentils mais pas de vrais users → fausse validation → investissement à perte dans la croissance.
5. **Le build-in-public mange le temps de dev (ou l'inverse)** — solo + débutant ne peut pas finir le produit ET bâtir une audience en même temps → les deux à moitié.
6. **La friction Apple / TestFlight** — compte Apple en attente, premier build, cache npm corrompu → blocage technique qui tue le momentum.
7. **Positionnement indifférencié** — « encore un tracker d'objectifs » dans un marché saturé, pas d'angle qui donne envie d'en parler ou de switcher.
8. **La vulnérabilité tue l'engagement du feed** — exposer des objectifs intimes à un cercle → contenu safe/superficiel ou feed vide → le cœur émotionnel ne se déclenche jamais.

---

## Analyses approfondies

### 01 · Le feed vide
**Récit.** Week-end de lancement : les 30 testeurs installent Reiz. Marie crée son objectif course et tombe sur un feed quasi désert — 2 amis sur l'app, peu actifs. Son premier post : 0 réaction pendant 6 h. Le lendemain, personne n'a posté. « Ton cercle te regarde » devient « personne ne regarde ». À J4 : rien à voir → aucune raison de revenir → personne ne poste → rien à voir. La spirale du réseau vide. L'app n'a pas échoué parce qu'elle était mauvaise, mais parce qu'un réseau social à 1 actif ne vaut rien.
**Hypothèse sous-jacente.** 30 testeurs éparpillés suffisent à créer la densité pour que chacun ait toujours quelque chose à regarder.
**Signaux d'alerte.** >50% des users ont <3 amis actifs ; nb de posts/jour qui décroît dès J3.

### 02 · La mécanique de honte
**Récit.** Le cœur de Reiz, c'est la pression sociale : tes amis voient tes streaks et tes échecs. Pour Thomas, motivé au début, casser un streak de 8 jours devant ses amis est humiliant. Plutôt que d'affronter le regard du cercle, il arrête d'ouvrir l'app. Idem pour les objectifs intimes (poids, argent). La mécanique conçue pour retenir produit l'évitement. Il ne reste qu'un petit noyau de ceux qui réussissent déjà ; le reste s'évapore en silence.
**Hypothèse sous-jacente.** La pression sociale motive plus qu'elle n'intimide, pour la majorité des gens.
**Signaux d'alerte.** Pic d'abandon juste après une rupture de streak ; objectifs sensibles sous-représentés vs « safe ».

### 03 · La boucle de rappel trop faible
**Récit.** `notifications.ts` = 32 lignes, push encore en TODO dans `NOTES.md`. Une app d'accountability vit et meurt par son moteur de rappel. Sans notif fiable (« ton ami a posté », « log ta journée »), rien ne ramène l'utilisateur. Les testeurs installent, utilisent 2 jours, puis l'app sort de leur esprit. Pas de notif → pas de retour → app oubliée. En décembre, le DAU est à 2-3 amis proches qui se forcent.
**Hypothèse sous-jacente.** Les gens reviendront d'eux-mêmes, sans qu'on les ramène activement.
**Signaux d'alerte.** Opt-in notifs <50% ; rétention J1→J7 sous 20%.

### 04 · Le faux signal des amis polis  _(échec le plus dangereux)_
**Récit.** Les 30 testeurs sont ton cercle. Ils sont gentils, utilisent l'app une semaine, mettent des ❤️, disent « c'est cool ! ». Tu lis ça comme une validation et tu lances 2 mois de build-in-public. Mais aucun ne l'utilise parce qu'il en a besoin — ils te rendent service. À J30, l'usage réel est nul, mais tu as déjà investi dans la croissance d'un produit dont la rétention n'a jamais été prouvée auprès d'inconnus. Invisible et auto-aggravant.
**Hypothèse sous-jacente.** L'enthousiasme des proches = preuve que des inconnus utiliseront l'app.
**Signaux d'alerte.** Feedback positif mais usage qui chute après J7 ; aucun testeur n'invite spontanément quelqu'un hors du cercle.

### 05 · Le build-in-public mange le dev
**Récit.** Bâtir une audience TikTok/Insta demande des mois de posts réguliers. Tu es seul, débutant, et l'app a encore des trous. Soit tu postes régulièrement et n'as plus le temps de corriger les problèmes de rétention révélés par les testeurs ; soit tu codes et le build-in-public reste sporadique. Tu fais les deux à moitié. En décembre, ni l'audience ni le produit n'ont décollé.
**Hypothèse sous-jacente.** On peut mener de front la finition du produit et la construction d'une audience, seul.
**Signaux d'alerte.** <3 posts/semaine tenus sur 1 mois ; backlog de bugs testeurs qui ne diminue pas.

### 06 · La friction Apple / TestFlight
**Récit.** Pas encore sur les stores, compte Apple Developer en attente, cache npm corrompu. Premier build EAS, première soumission. Rejet App Review (UGC, labels de confidentialité), problèmes de signing, build qui casse sur le cache. Des semaines de friction. Le momentum retombe avant qu'un testeur ouvre l'app. Débutant, tu passes l'été à déboguer la toolchain.
**Hypothèse sous-jacente.** Passer de « ça marche en dev » à « distribué via TestFlight » est une formalité.
**Signaux d'alerte.** Premier build EAS qui échoue ; >2 semaines entre « app prête » et « 1er testeur l'a ».

### 07 · Positionnement indifférencié
**Récit.** Marché saturé (Strava, BeReal, Habitica, Gas). « Suivi social d'objectifs » n'a pas d'angle tranchant. Au build-in-public, ni testeurs ni audience ne savent dire pourquoi Reiz plutôt qu'un groupe WhatsApp. Les vidéos ne décollent pas, le pitch ne crée pas de « il me le faut ». App correcte mais oubliable.
**Hypothèse sous-jacente.** « Tes amis te regardent » est assez différenciant pour qu'on en parle et qu'on switch.
**Signaux d'alerte.** Les testeurs ne résument pas l'app en 1 phrase qui donne envie ; vidéos sous 500 vues malgré la régularité.

### 08 · La vulnérabilité tue le feed
**Récit.** Reiz demande d'exposer des objectifs intimes (poids, argent, santé, relations) à un cercle de connaissances. Beaucoup hésitent à poster des progrès vulnérables. Le feed se remplit d'objectifs « safe » ou reste vide. Le cœur émotionnel — la vraie progression partagée — ne se déclenche jamais. Sans contenu authentique, pas de connexion, pas de retour.
**Hypothèse sous-jacente.** Les gens sont à l'aise pour exposer leurs objectifs et leurs échecs à leur cercle.
**Signaux d'alerte.** Ratio objectifs sensibles/safe très faible ; posts sans photo ni détail réel qui dominent.

---

## Synthèse

**Échec le plus probable.** Le feed vide (F1) + la boucle de rappel faible (F3). 30 testeurs éparpillés → feed désert → sans notif pour ramener, oubli en 3-4 jours. Tueur classique des apps sociales.

**Échec le plus dangereux.** Le faux signal des amis polis (F4). Tu prends la gentillesse de ton cercle pour de la traction et tu investis 2 mois de build-in-public sur un produit dont la rétention n'est pas prouvée. Invisible, et ça compose.

**Hypothèse cachée.** « Si je construis bien l'app, la boucle sociale démarrera toute seule. » Tu supposes que 10-30 proches suffisent à créer la densité sociale réelle ET à valider que des inconnus reviendront. Deux paris distincts, tous deux fragiles.

**Plan révisé.**
1. Densité > nombre : lance à 1 groupe dense de 6-10 amis qui se connaissent + objectif commun, pas 30 dispersés.
2. Notifs push de bout en bout AVANT de lancer (ami a posté + rappel quotidien), testées sur device réel.
3. Métrique go/no-go écrite maintenant : « ≥5 des 10 postent 4j/7 en semaine 2, sans qu'on leur demande ». Sinon → pas de build-in-public, corriger la rétention.
4. Ne mesure pas le succès aux compliments mais à l'usage non sollicité (posts/invitations spontanés).
5. Repousse le build-in-public jusqu'à preuve de rétention.

**Checklist pré-lancement.**
- [ ] Notifs push testées de bout en bout sur un device TestFlight réel.
- [ ] Build EAS production réussi + installé sur ≥2 iPhones autres que le tien (régler cache npm : `--cache /tmp/npm-cache-reiz`).
- [ ] Groupe de lancement dense (≥6 qui se connaissent + objectif commun).
- [ ] Métrique de succès écrite + date de décision go/no-go.
- [ ] Onboarding qui force création d'objectif ET ajout de ≥3 amis dès la 1re session.

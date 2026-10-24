# Reiz en 4 langues (version 1.1)

Français (langue principale), anglais, espagnol, hébreu. Préparé le 24/10/2026 sur la branche `v1.1-langues`.

## Comment ça marche dans l'app

- Tous les textes de l'app sont dans `src/i18n/` : `fr.ts` est la référence, `en.ts`, `es.ts`, `he.ts` en sont la traduction
  clé pour clé (TypeScript refuse une clé oubliée). Dans le code : `t('feed.addComment')`, `tp('feed.seeComments', n)`.
- Langue choisie au lancement : celle réglée dans **Réglages > Langue**, sinon celle de l'iPhone si Reiz la parle, sinon l'anglais.
  Changer de langue redémarre l'app.
- Hébreu : l'app passe de droite à gauche au démarrage (flèches, curseurs et barre du bas inversés).
  Juste après un passage vers ou depuis l'hébreu, iOS garde l'alignement du texte de l'ancienne langue tant que l'app
  n'a pas été fermée puis rouverte (le redémarrage de Reiz garde le même processus) : le message de changement de
  langue le demande. Vérifié sur simulateur le 25/10/2026.
- Textes légaux : `src/i18n/legal/` (le français fait foi, chaque traduction le dit en tête).
- Demandes d'autorisation d'iOS (appareil photo, localisation...) : `locales/*.json`.
- La langue et le fuseau horaire de chacun sont rangés dans `users.language` et `users.timezone` (colonnes ajoutées le 24/10,
  sans effet sur la 1.0.1).

## Notifications du serveur

Les fonctions `send-push`, `live-activity-tick`, `notify-duo-reminder`, `notify-daily-reminder`, `notify-encouragement`,
`notify-random-reminder` écrivent dans la langue de celui qui reçoit. Les textes sont dans
`supabase/functions/_shared/texts.ts` ; après une modification : `node supabase/functions/sync-texts.mjs`.

**Pas encore déployées.** Les comptes actuels n'ont pas de langue enregistrée : ils restent en français, avec exactement les
mêmes phrases qu'aujourd'hui. On peut donc déployer avant la sortie, depuis ton terminal :

```
cd ~/Desktop/Reiz-langues && supabase functions deploy send-push live-activity-tick notify-duo-reminder notify-daily-reminder notify-encouragement notify-random-reminder --project-ref vpaizbtetwsnvbpmeuab
```

## Avant la sortie

- [ ] Relecture de l'hébreu par une personne de langue maternelle (`src/i18n/he.ts`, `src/i18n/legal/he.ts`, `locales/he.json`,
      partie `he` de `supabase/functions/_shared/texts.ts`). Formes neutres choisies : pluriel ou « /ה ».
- [ ] Relecture rapide de l'anglais et de l'espagnol.
- [x] Déployer les fonctions serveur (fait le 24/10, vérifié : versions en ligne, essai sans envoi OK).
- [x] Build 1.1.0 (EAS) : build 14, sur TestFlight le 24/10.
- [ ] Test TestFlight du build 14 dans les 4 langues.
- [x] App Store Connect (24/10) : la version « 1.0.1 » jamais soumise a été renommée 1.1.0, build 14 attaché, Nouveautés et
      notes pour Apple (en anglais, boutons anglais) mises à jour. Langues ajoutées : Anglais (États-Unis), Espagnol (Espagne),
      Espagnol (Mexique, version « ustedes »), Hébreu, avec nom, sous-titre, description, mots-clés, texte promo, nouveautés.
      Captures : celles en français servent par défaut.
- [ ] Soumettre la 1.1.0 à la vérification d'Apple (avec l'accord de Yllan).
- [ ] Les pages web CGU et confidentialité restent en français (liens de l'inscription). L'app affiche ses propres traductions
      dans Réglages > Légal.

## Fiches App Store

### Anglais (États-Unis)

| Champ | Valeur |
|---|---|
| Nom (30 max) | `Reiz: goals with friends` |
| Sous-titre (30 max) | `Your circle is watching` |

Texte promotionnel :
```
Pick your goal, invite your people, post your session. Their eyes on you do what motivation alone can't keep up.
```

Description :
```
Discipline alone doesn't last.

Fitness apps expect you to stay motivated on your own. Reiz does the opposite: it puts the people around you in the loop. You pick a goal, invite the people who matter, and everyone sees each other's progress, day after day.

When someone you respect is watching, you get up.

Post a photo or a 15-second video of your session. Train with a friend, tag them, and confirm your duo by both posting within the hour. Keep your streak alive, earn badges, and let your close circle know when you get to the gym.

Each goal has its own visibility: your circle, your close circle, or private. Reiz never sells your data and shows no ads.

Reiz is free. Available in English, French, Spanish and Hebrew.

Terms: https://reiz-landing.netlify.app/cgu.html
Privacy: https://reiz-landing.netlify.app/confidentialite.html
```

Mots-clés (100 max) :
```
motivation,habit,discipline,progress,challenge,workout,gym,fitness,running,routine,tracker,streak
```

Nouveautés :
```
Reiz now speaks your language: English, French, Spanish and Hebrew. Change it anytime in Settings, Language. Notifications from your circle arrive in your language too.
```

### Espagnol (Espagne)

| Champ | Valeur |
|---|---|
| Nom (30 max) | `Reiz: objetivos con amigos` |
| Sous-titre (30 max) | `Tu círculo te mira` |

Texte promotionnel :
```
Elige tu objetivo, invita a los tuyos, publica tu sesión. Su mirada hace lo que la motivación sola no consigue mantener.
```

Description :
```
La disciplina en solitario no aguanta.

Las apps de deporte te piden que te motives tú solo. Reiz hace lo contrario: mete a tu gente en el juego. Eliges un objetivo, invitas a las personas que importan, y cada uno ve el progreso del otro, día tras día.

Cuando alguien a quien respetas te mira, te levantas.

Publica una foto o un vídeo de 15 segundos de tu sesión. Entrena con un amigo, etiquétalo y confirmad vuestro dúo publicando los dos en menos de una hora. Mantén tu racha, gana insignias y avisa a tu círculo cercano cuando llegas al gimnasio.

Cada objetivo tiene su visibilidad: tu círculo, tu círculo cercano o privado. Reiz no vende tus datos y no muestra publicidad.

Reiz es gratis. Disponible en español, francés, inglés y hebreo.

Condiciones: https://reiz-landing.netlify.app/cgu.html
Privacidad: https://reiz-landing.netlify.app/confidentialite.html
```

Mots-clés :
```
motivacion,habito,disciplina,progreso,reto,deporte,gimnasio,musculacion,running,rutina,racha,entreno
```

Nouveautés :
```
Reiz ya habla tu idioma: español, francés, inglés y hebreo. Cámbialo cuando quieras en Ajustes, Idioma. Las notificaciones de tu círculo también llegan en tu idioma.
```

### Hébreu

| Champ | Valeur |
|---|---|
| Nom (30 max) | `Reiz: יעדים עם חברים` |
| Sous-titre (30 max) | `המעגל שלך צופה` |

Texte promotionnel :
```
בוחרים יעד, מזמינים את הקרובים, מפרסמים את האימון. המבט שלהם עושה את מה שמוטיבציה לבד לא מחזיקה.
```

Description :
```
משמעת לבד לא מחזיקה.

אפליקציות ספורט מצפות שתמצאו מוטיבציה לבד. Reiz עושה את ההפך: היא מכניסה את הסביבה שלכם למשחק. בוחרים יעד, מזמינים את האנשים שחשובים, וכל אחד רואה את ההתקדמות של השני, יום אחרי יום.

כשמישהו שאתם מעריכים צופה, אתם קמים.

מפרסמים תמונה או סרטון של 15 שניות מהאימון. מתאמנים עם חבר, מתייגים אותו ומאשרים את הזוג כששניכם מפרסמים תוך שעה. שומרים על הרצף, אוספים תגים, ומודיעים למעגל הקרוב כשמגיעים לחדר הכושר.

לכל יעד יש נראות משלו: המעגל, המעגל הקרוב או פרטי. Reiz לא מוכרת את הנתונים שלכם ולא מציגה פרסומות.

Reiz חינמית. זמינה בעברית, צרפתית, אנגלית וספרדית.

תנאי שימוש: https://reiz-landing.netlify.app/cgu.html
פרטיות: https://reiz-landing.netlify.app/confidentialite.html
```

Mots-clés :
```
מוטיבציה,הרגל,משמעת,התקדמות,אתגר,ספורט,כושר,ריצה,אימון,שגרה,רצף,חדר כושר
```

Nouveautés :
```
Reiz מדברת עכשיו בשפה שלך: עברית, צרפתית, אנגלית וספרדית. אפשר לשנות בכל רגע בהגדרות, שפה. גם ההתראות מהמעגל מגיעות בשפה שלך.
```

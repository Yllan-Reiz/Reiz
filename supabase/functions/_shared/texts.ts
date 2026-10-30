// Textes des notifications envoyées par le serveur, dans la langue de chaque personne (users.language).
// SOURCE UNIQUE : chaque fonction en a une copie « texts.ts » à côté de son index.ts (le déploiement ne prend que
// le dossier de la fonction). Après une modification ici : node supabase/functions/sync-texts.mjs, puis redéployer.
// Ne jamais écrire de tiret cadratin ni de point médian dans ces textes.

export type Lang = 'fr' | 'en' | 'es' | 'he';
const LANGS: Lang[] = ['fr', 'en', 'es', 'he'];
// Vide (comptes d'avant la version 1.1) ou inconnu : français, comme avant.
export const asLang = (l?: string | null): Lang => (LANGS.includes(l as Lang) ? (l as Lang) : 'fr');

export function fill(s: string, p: Record<string, string | number> = {}) {
  return s.replace(/\{(\w+)\}/g, (m, k) => (p[k] == null ? m : String(p[k])));
}

const LOCALES: Record<Lang, string> = { fr: 'fr-FR', en: 'en-US', es: 'es-ES', he: 'he-IL' };
export const locale = (l: Lang) => LOCALES[l];
// 251,5 en français et en espagnol, 251.5 en anglais et en hébreu.
export const num = (l: Lang, n: number) => new Intl.NumberFormat(LOCALES[l], { maximumFractionDigits: 1 }).format(Math.round(n * 10) / 10);

// Unités enregistrées en base en français.
const UNITS: Record<Lang, Record<string, string>> = {
  fr: {},
  en: { 'séances': 'sessions', fois: 'times', pas: 'steps' },
  es: { 'séances': 'sesiones', fois: 'veces', pas: 'pasos' },
  he: { 'séances': 'אימונים', fois: 'פעמים', pas: 'צעדים', km: 'ק״מ', kg: 'ק״ג', min: 'דק׳', h: 'שע׳', reps: 'חזרות' },
};
export const unit = (l: Lang, u?: string | null) => (u ? UNITS[l][u] ?? u : '');

// Lieu par défaut écrit par l'app dans la langue de celui qui prévient (« la salle », « the gym »...) :
// on le réécrit dans la langue de celui qui reçoit.
const DEFAULT_PLACES = ['la salle', 'the gym', 'el gimnasio', 'חדר הכושר'];
export const isDefaultPlace = (p?: string | null) => !!p && DEFAULT_PLACES.includes(p.trim().toLowerCase());

// Résultat de défi écrit en français par le serveur (duel_close_due) : « Victoire 5 à 3 ».
export function duelResult(l: Lang, preview?: string | null): { kind: 'win' | 'lose' | 'draw'; text: string } | null {
  const m = (preview || '').match(/^(Victoire|Défaite|Égalité) (\d+) à (\d+)$/);
  if (!m) return null;
  const kind = m[1] === 'Victoire' ? 'win' : m[1] === 'Défaite' ? 'lose' : 'draw';
  return { kind, text: fill(T[l].duelResult[kind], { a: m[2], b: m[3] }) };
}

type Texts = {
  someone: string; yourFriend: string; gif: string; quote: string;
  andTwo: string; andMore: string; andMoreOne: string;
  onPost: string; onPostObj: string;
  reactionTitle: string; reactionBodyCaption: string; reactionBody: string;
  commentTitle: string; replyTitle: string; commentLikeTitle: string;
  nudgeTitle: string; nudgeBody: string;
  friendPostTitleObj: string; friendPostTitle: string; friendPostBody: string;
  objectiveDoneTitle: string; objectiveDoneBody: string; objectiveDoneBodyNoObj: string;
  duoTagTitle: string; duoTagBodyObj: string; duoTagBody: string;
  atGymTitlePlace: string; atGymTitle: string; atGymBody: string; defaultPlace: string;
  tagEndorseTitle: string; tagEndorseBodyTag: string; tagEndorseBody: string;
  friendRequestTitle: string; friendRequestBody: string;
  friendAcceptTitle: string; friendAcceptBody: string;
  challengeInviteTitle: string; challengeInviteBody: string;
  challengeAcceptTitle: string; challengeAcceptBody: string;
  challengeResultTitle: string; challengeResultBody: string;
  duelResult: { win: string; lose: string; draw: string };
  // Carte du duo (Activité en direct)
  cardTitle: string; cardSubtitle: string; cardAlertBodyObj: string; cardAlertBody: string; cardRemaining: string;
  cardOrangeTitle: string; cardOrangeBody: string; cardRedTitle: string; cardRedBody: string;
  // Rappels du duo (sans carte)
  duoLeft30: string; duoLeft10: string;
  duoRemind1Title: string; duoRemind1Body: string; duoRemind2Title: string; duoRemind2Body: string;
  // Rappel de 19 h
  dailyTitle: string; dailyBodyPosted: string; dailyBodyPostedOne: string; dailyBodyNobody: string;
  dailyStreakTitle: string; dailyStreakBodyPosted: string; dailyStreakBodyPostedOne: string; dailyStreakBody: string;
  dailyDuelTitle: string; dailyDuelBehind: string; dailyDuelAhead: string; dailyDuelTie: string;
  dailyFirstTitle: string; dailyFirstBodyPosted: string; dailyFirstBodyPostedOne: string; dailyFirstBody: string;
  // Encouragements
  almostTitlePct: string; almostTitle: string; almostBody: string;
  friendsPostedOne: string; friendsPostedTwo: string;
  gap3Title: string; gap3Body: string; gap7Title: string; gap7Body: string; gap14Title: string; gap14Body: string;
  first1Title: string; first1Body: string; first3Title: string; first3Body: string; first7Title: string; first7Body: string;
  // Rappel au hasard
  random: string[];
};

export const T: Record<Lang, Texts> = {
  fr: {
    someone: "Quelqu'un", yourFriend: 'Ton ami', gif: 'GIF', quote: '« {text} »',
    andTwo: '{a} et {b}', andMore: '{a}, {b} et {n} autres', andMoreOne: '{a}, {b} et 1 autre',
    onPost: 'ton post', onPostObj: 'ton post {obj}',
    reactionTitle: '{name} a réagi {emoji}', reactionBodyCaption: 'Sur {post} : « {caption} »', reactionBody: 'Sur {post}',
    commentTitle: '{name} a commenté {post}', replyTitle: "{name} t'a répondu", commentLikeTitle: '{name} a aimé ton commentaire ❤️',
    nudgeTitle: '{name} te relance 💪', nudgeBody: "Ça fait quelques jours sans séance. Poste la prochaine, ton cercle t'attend.",
    friendPostTitleObj: '{name} a posté : {obj}', friendPostTitle: '{name} vient de publier', friendPostBody: 'Viens voir sa progression et réagis.',
    objectiveDoneTitle: '🏆 {name} a atteint son objectif', objectiveDoneBody: '« {obj} ». Va lui dire bravo.', objectiveDoneBodyNoObj: 'Va lui dire bravo.',
    duoTagTitle: "{name} t'a identifié dans sa séance 🤝", duoTagBodyObj: "{obj}. Poste la tienne dans l'heure pour valider le duo.", duoTagBody: "Poste la tienne dans l'heure pour valider le duo.",
    atGymTitlePlace: '{name} est à {place} 💪', atGymTitle: '{name} est à la salle 💪', atGymBody: "Viens t'entraîner avec {first}.", defaultPlace: 'la salle',
    tagEndorseTitle: '{name} a validé ton tag', tagEndorseBodyTag: '« {tag} » sur ton profil', tagEndorseBody: 'Va voir ton profil.',
    friendRequestTitle: '{name} veut rejoindre ton cercle', friendRequestBody: 'Accepte pour suivre ses progrès, et lui les tiens.',
    friendAcceptTitle: '{name} a accepté ta demande', friendAcceptBody: 'Vous êtes dans le même cercle. Va voir ses objectifs.',
    challengeInviteTitle: '{name} te défie 🔥', challengeInviteBody: "Un duel d'une semaine : qui s'entraîne sur le plus de jours ? Réponds dans l'appli.",
    challengeAcceptTitle: '{name} relève ton défi 💪', challengeAcceptBody: "C'est parti pour 7 jours. Chaque jour où tu postes une séance compte.",
    challengeResultTitle: '{icon} Défi terminé contre {name}', challengeResultBody: 'Va voir le résultat.',
    duelResult: { win: 'Victoire {a} à {b}', lose: 'Défaite {a} à {b}', draw: 'Égalité {a} à {b}' },
    cardTitle: "{first} t'attend 🤝", cardSubtitle: 'Poste ta séance pour valider le duo',
    cardAlertBodyObj: '{obj}. Tu as une heure pour poster la tienne et valider le duo.', cardAlertBody: 'Tu as une heure pour poster la tienne et valider le duo.', cardRemaining: 'restant',
    cardOrangeTitle: '⏳ Plus que 20 min pour ton duo avec {who}', cardOrangeBody: 'Poste ta séance pour valider le duo.',
    cardRedTitle: '⏳ Dernières minutes pour ton duo avec {who}', cardRedBody: 'Poste ta séance maintenant pour valider le duo.',
    duoLeft30: 'environ 30 minutes', duoLeft10: 'environ 10 minutes',
    duoRemind1Title: '⏳ Ton duo avec {who} expire bientôt', duoRemind1Body: 'Il te reste {left} pour poster ta séance.',
    duoRemind2Title: '⏳ Dernière ligne droite pour ton duo avec {who}', duoRemind2Body: 'Il reste {left} : poste ta séance maintenant pour valider le duo.',
    dailyTitle: "⏰ Pas encore posté aujourd'hui", dailyBodyPosted: "{names} ont déjà posté aujourd'hui. Et toi ?", dailyBodyPostedOne: "{names} a déjà posté aujourd'hui. Et toi ?",
    dailyBodyNobody: "Personne n'a encore posté dans ton cercle. Montre l'exemple.",
    dailyStreakTitle: '🔥 Ta série de {n} jours est en jeu', dailyStreakBodyPosted: 'Une séance et elle continue. {names} ont déjà posté.',
    dailyStreakBodyPostedOne: 'Une séance et elle continue. {names} a déjà posté.', dailyStreakBody: "Une séance aujourd'hui et elle continue.",
    dailyDuelTitle: '⚔️ Ton duel contre {who}', dailyDuelBehind: "Il mène {theirs} à {mine}. Poste aujourd'hui pour revenir.",
    dailyDuelAhead: "Tu mènes {mine} à {theirs}. Poste aujourd'hui pour creuser l'écart.", dailyDuelTie: 'Égalité {mine} à {theirs}. Ta séance du jour fait la différence.',
    dailyFirstTitle: '📸 Ton premier post', dailyFirstBodyPosted: "{names} ont posté aujourd'hui. Ton cercle attend ta première photo.",
    dailyFirstBodyPostedOne: "{names} a posté aujourd'hui. Ton cercle attend ta première photo.", dailyFirstBody: 'Ton cercle attend ta première photo. Une seule suffit pour commencer.',
    almostTitlePct: 'Plus que {left} % 🔥', almostTitle: 'Plus que {left} {unit} 🔥', almostBody: '« {obj} » : {cur} / {target}{pct}. Tu y es presque.',
    friendsPostedOne: '{a} a posté ces derniers jours.', friendsPostedTwo: '{a} et {b} ont posté ces derniers jours.',
    gap3Title: 'Ça fait 3 jours 👀', gap3Body: 'Une petite séance suffit pour relancer la machine.',
    gap7Title: 'Une semaine sans poster', gap7Body: 'Reviens avec une séance, même courte.',
    gap14Title: 'Ton cercle pense à toi', gap14Body: 'Pose-toi un petit objectif et reprends en douceur.',
    first1Title: "Ton premier post t'attend 📸", first1Body: '« {obj} » commence avec une photo. Ton cercle la verra tout de suite.',
    first3Title: "Ton cercle ne t'a pas encore vu 👀", first3Body: "Une photo de ta séance pour « {obj} », et ils pourront t'encourager.",
    first7Title: 'Une semaine sur Reiz', first7Body: 'Poste ta première séance pour « {obj} ». Une seule suffit pour lancer ta série.',
    random: [
      'Ton cercle attend ta progression.',
      "Les meilleurs ne s'arrêtent jamais. Et toi ?",
      'Montre à ton cercle ce dont tu es capable.',
      "Ta streak t'attend. Lance-toi.",
      "Un petit update aujourd'hui ? Tes amis regardent.",
      'Ça fait un moment, où en es-tu ?',
      'Chaque jour compte. Poste ta progression.',
      'Ton cercle progresse. Tu ne veux pas rester en arrière ?',
    ],
  },
  en: {
    someone: 'Someone', yourFriend: 'Your friend', gif: 'GIF', quote: '"{text}"',
    andTwo: '{a} and {b}', andMore: '{a}, {b} and {n} others', andMoreOne: '{a}, {b} and 1 other',
    onPost: 'your post', onPostObj: 'your post {obj}',
    reactionTitle: '{name} reacted {emoji}', reactionBodyCaption: 'On {post}: "{caption}"', reactionBody: 'On {post}',
    commentTitle: '{name} commented on {post}', replyTitle: '{name} replied to you', commentLikeTitle: '{name} liked your comment ❤️',
    nudgeTitle: '{name} is nudging you 💪', nudgeBody: "It's been a few days without a session. Post the next one, your circle is waiting.",
    friendPostTitleObj: '{name} posted: {obj}', friendPostTitle: '{name} just posted', friendPostBody: 'Come see their progress and react.',
    objectiveDoneTitle: '🏆 {name} reached their goal', objectiveDoneBody: '"{obj}". Go cheer them on.', objectiveDoneBodyNoObj: 'Go cheer them on.',
    duoTagTitle: '{name} tagged you in their session 🤝', duoTagBodyObj: '{obj}. Post yours within the hour to confirm the duo.', duoTagBody: 'Post yours within the hour to confirm the duo.',
    atGymTitlePlace: '{name} is at {place} 💪', atGymTitle: '{name} is at the gym 💪', atGymBody: 'Go train with {first}.', defaultPlace: 'the gym',
    tagEndorseTitle: '{name} endorsed your tag', tagEndorseBodyTag: '"{tag}" on your profile', tagEndorseBody: 'Go check your profile.',
    friendRequestTitle: '{name} wants to join your circle', friendRequestBody: 'Accept to follow their progress, and they follow yours.',
    friendAcceptTitle: '{name} accepted your request', friendAcceptBody: "You're in the same circle. Go see their goals.",
    challengeInviteTitle: '{name} challenges you 🔥', challengeInviteBody: 'A one-week duel: who trains on the most days? Reply in the app.',
    challengeAcceptTitle: '{name} accepted your challenge 💪', challengeAcceptBody: '7 days, here we go. Every day you post a session counts.',
    challengeResultTitle: '{icon} Challenge over against {name}', challengeResultBody: 'Go see the result.',
    duelResult: { win: 'Win {a} to {b}', lose: 'Loss {a} to {b}', draw: 'Tie {a} to {b}' },
    cardTitle: '{first} is waiting for you 🤝', cardSubtitle: 'Post your session to confirm the duo',
    cardAlertBodyObj: '{obj}. You have one hour to post yours and confirm the duo.', cardAlertBody: 'You have one hour to post yours and confirm the duo.', cardRemaining: 'left',
    cardOrangeTitle: '⏳ Only 20 min left for your duo with {who}', cardOrangeBody: 'Post your session to confirm the duo.',
    cardRedTitle: '⏳ Final minutes for your duo with {who}', cardRedBody: 'Post your session now to confirm the duo.',
    duoLeft30: 'about 30 minutes', duoLeft10: 'about 10 minutes',
    duoRemind1Title: '⏳ Your duo with {who} expires soon', duoRemind1Body: 'You have {left} left to post your session.',
    duoRemind2Title: '⏳ Final stretch for your duo with {who}', duoRemind2Body: '{left} left: post your session now to confirm the duo.',
    dailyTitle: "⏰ You haven't posted today", dailyBodyPosted: '{names} already posted today. What about you?', dailyBodyPostedOne: '{names} already posted today. What about you?',
    dailyBodyNobody: 'Nobody in your circle has posted yet. Lead the way.',
    dailyStreakTitle: '🔥 Your {n}-day streak is on the line', dailyStreakBodyPosted: 'One session and it keeps going. {names} already posted.',
    dailyStreakBodyPostedOne: 'One session and it keeps going. {names} already posted.', dailyStreakBody: 'One session today and it keeps going.',
    dailyDuelTitle: '⚔️ Your duel against {who}', dailyDuelBehind: "They're leading {theirs} to {mine}. Post today to catch up.",
    dailyDuelAhead: "You're leading {mine} to {theirs}. Post today to pull ahead.", dailyDuelTie: "Tied {mine} to {theirs}. Today's session makes the difference.",
    dailyFirstTitle: '📸 Your first post', dailyFirstBodyPosted: '{names} posted today. Your circle is waiting for your first photo.',
    dailyFirstBodyPostedOne: '{names} posted today. Your circle is waiting for your first photo.', dailyFirstBody: 'Your circle is waiting for your first photo. Just one is enough to start.',
    almostTitlePct: 'Only {left}% to go 🔥', almostTitle: 'Only {left} {unit} to go 🔥', almostBody: '"{obj}": {cur} / {target}{pct}. You\'re almost there.',
    friendsPostedOne: '{a} posted in the last few days.', friendsPostedTwo: '{a} and {b} posted in the last few days.',
    gap3Title: "It's been 3 days 👀", gap3Body: 'One short session is enough to get going again.',
    gap7Title: 'A week without posting', gap7Body: 'Come back with a session, even a short one.',
    gap14Title: 'Your circle is thinking of you', gap14Body: 'Set yourself a small goal and ease back in.',
    first1Title: 'Your first post is waiting 📸', first1Body: '"{obj}" starts with one photo. Your circle will see it right away.',
    first3Title: "Your circle hasn't seen you yet 👀", first3Body: 'One photo of your session for "{obj}" and they can cheer you on.',
    first7Title: 'One week on Reiz', first7Body: 'Post your first session for "{obj}". Just one is enough to start your streak.',
    random: [
      'Your circle is waiting for your progress.',
      'The best never stop. What about you?',
      "Show your circle what you're capable of.",
      'Your streak is waiting. Go for it.',
      'A quick update today? Your friends are watching.',
      "It's been a while, how's it going?",
      'Every day counts. Post your progress.',
      "Your circle is moving forward. Don't fall behind.",
    ],
  },
  es: {
    someone: 'Alguien', yourFriend: 'Tu amigo', gif: 'GIF', quote: '«{text}»',
    andTwo: '{a} y {b}', andMore: '{a}, {b} y {n} más', andMoreOne: '{a}, {b} y 1 más',
    onPost: 'tu publicación', onPostObj: 'tu publicación {obj}',
    reactionTitle: '{name} ha reaccionado {emoji}', reactionBodyCaption: 'En {post}: «{caption}»', reactionBody: 'En {post}',
    commentTitle: '{name} ha comentado {post}', replyTitle: '{name} te ha respondido', commentLikeTitle: '{name} ha dado me gusta a tu comentario ❤️',
    nudgeTitle: '{name} te da un empujón 💪', nudgeBody: 'Llevas unos días sin sesión. Publica la próxima, tu círculo te espera.',
    friendPostTitleObj: '{name} ha publicado: {obj}', friendPostTitle: '{name} acaba de publicar', friendPostBody: 'Ven a ver su progreso y reacciona.',
    objectiveDoneTitle: '🏆 {name} ha alcanzado su objetivo', objectiveDoneBody: '«{obj}». Ve a darle la enhorabuena.', objectiveDoneBodyNoObj: 'Ve a darle la enhorabuena.',
    duoTagTitle: '{name} te ha etiquetado en su sesión 🤝', duoTagBodyObj: '{obj}. Publica la tuya antes de una hora para confirmar el dúo.', duoTagBody: 'Publica la tuya antes de una hora para confirmar el dúo.',
    atGymTitlePlace: '{name} está en {place} 💪', atGymTitle: '{name} está en el gimnasio 💪', atGymBody: 'Ve a entrenar con {first}.', defaultPlace: 'el gimnasio',
    tagEndorseTitle: '{name} ha validado tu etiqueta', tagEndorseBodyTag: '«{tag}» en tu perfil', tagEndorseBody: 'Ve a ver tu perfil.',
    friendRequestTitle: '{name} quiere unirse a tu círculo', friendRequestBody: 'Acepta para seguir su progreso, y que siga el tuyo.',
    friendAcceptTitle: '{name} ha aceptado tu solicitud', friendAcceptBody: 'Estáis en el mismo círculo. Ve a ver sus objetivos.',
    challengeInviteTitle: '{name} te reta 🔥', challengeInviteBody: 'Un duelo de una semana: ¿quién entrena más días? Responde en la app.',
    challengeAcceptTitle: '{name} acepta tu reto 💪', challengeAcceptBody: 'Arrancan 7 días. Cuenta cada día en que publicas una sesión.',
    challengeResultTitle: '{icon} Reto terminado contra {name}', challengeResultBody: 'Ve a ver el resultado.',
    duelResult: { win: 'Victoria {a} a {b}', lose: 'Derrota {a} a {b}', draw: 'Empate {a} a {b}' },
    cardTitle: '{first} te espera 🤝', cardSubtitle: 'Publica tu sesión para confirmar el dúo',
    cardAlertBodyObj: '{obj}. Tienes una hora para publicar la tuya y confirmar el dúo.', cardAlertBody: 'Tienes una hora para publicar la tuya y confirmar el dúo.', cardRemaining: 'restante',
    cardOrangeTitle: '⏳ Solo quedan 20 min para tu dúo con {who}', cardOrangeBody: 'Publica tu sesión para confirmar el dúo.',
    cardRedTitle: '⏳ Últimos minutos para tu dúo con {who}', cardRedBody: 'Publica tu sesión ahora para confirmar el dúo.',
    duoLeft30: 'unos 30 minutos', duoLeft10: 'unos 10 minutos',
    duoRemind1Title: '⏳ Tu dúo con {who} caduca pronto', duoRemind1Body: 'Te quedan {left} para publicar tu sesión.',
    duoRemind2Title: '⏳ Recta final para tu dúo con {who}', duoRemind2Body: 'Quedan {left}: publica tu sesión ahora para confirmar el dúo.',
    dailyTitle: '⏰ Aún no has publicado hoy', dailyBodyPosted: '{names} ya han publicado hoy. ¿Y tú?', dailyBodyPostedOne: '{names} ya ha publicado hoy. ¿Y tú?',
    dailyBodyNobody: 'Nadie de tu círculo ha publicado todavía. Da ejemplo.',
    dailyStreakTitle: '🔥 Tu racha de {n} días está en juego', dailyStreakBodyPosted: 'Una sesión y sigue. {names} ya han publicado.',
    dailyStreakBodyPostedOne: 'Una sesión y sigue. {names} ya ha publicado.', dailyStreakBody: 'Una sesión hoy y sigue.',
    dailyDuelTitle: '⚔️ Tu duelo contra {who}', dailyDuelBehind: 'Va ganando {theirs} a {mine}. Publica hoy para remontar.',
    dailyDuelAhead: 'Vas ganando {mine} a {theirs}. Publica hoy para ampliar la ventaja.', dailyDuelTie: 'Empate {mine} a {theirs}. Tu sesión de hoy marca la diferencia.',
    dailyFirstTitle: '📸 Tu primera publicación', dailyFirstBodyPosted: '{names} han publicado hoy. Tu círculo espera tu primera foto.',
    dailyFirstBodyPostedOne: '{names} ha publicado hoy. Tu círculo espera tu primera foto.', dailyFirstBody: 'Tu círculo espera tu primera foto. Basta con una para empezar.',
    almostTitlePct: 'Solo te queda un {left} % 🔥', almostTitle: 'Solo te quedan {left} {unit} 🔥', almostBody: '«{obj}»: {cur} / {target}{pct}. Ya casi lo tienes.',
    friendsPostedOne: '{a} ha publicado estos días.', friendsPostedTwo: '{a} y {b} han publicado estos días.',
    gap3Title: 'Ya van 3 días 👀', gap3Body: 'Basta una sesión corta para volver a arrancar.',
    gap7Title: 'Una semana sin publicar', gap7Body: 'Vuelve con una sesión, aunque sea corta.',
    gap14Title: 'Tu círculo piensa en ti', gap14Body: 'Márcate un objetivo pequeño y retoma con calma.',
    first1Title: 'Tu primera publicación te espera 📸', first1Body: '«{obj}» empieza con una foto. Tu círculo la verá enseguida.',
    first3Title: 'Tu círculo aún no te ha visto 👀', first3Body: 'Una foto de tu sesión para «{obj}» y podrán animarte.',
    first7Title: 'Una semana en Reiz', first7Body: 'Publica tu primera sesión para «{obj}». Basta con una para empezar tu racha.',
    random: [
      'Tu círculo espera tu progreso.',
      'Los mejores nunca se detienen. ¿Y tú?',
      'Demuestra a tu círculo de lo que eres capaz.',
      'Tu racha te espera. ¡Vamos!',
      '¿Una actualización hoy? Tus amigos están mirando.',
      'Hace tiempo que no publicas, ¿cómo vas?',
      'Cada día cuenta. Publica tu progreso.',
      'Tu círculo avanza. ¿No querrás quedarte atrás?',
    ],
  },
  he: {
    someone: 'מישהו', yourFriend: 'החבר/ה שלך', gif: 'GIF', quote: '"{text}"',
    andTwo: '{a} ו{b}', andMore: '{a}, {b} ועוד {n}', andMoreOne: '{a}, {b} ועוד אחד',
    onPost: 'הפוסט שלך', onPostObj: 'הפוסט שלך {obj}',
    reactionTitle: '{name} הגיב/ה {emoji}', reactionBodyCaption: 'על {post}: "{caption}"', reactionBody: 'על {post}',
    commentTitle: '{name} הגיב/ה על {post}', replyTitle: '{name} השיב/ה לך', commentLikeTitle: '{name} אהב/ה את התגובה שלך ❤️',
    nudgeTitle: '{name} נותן/ת לך דחיפה 💪', nudgeBody: 'עברו כמה ימים בלי אימון. פרסמו את הבא, המעגל מחכה.',
    friendPostTitleObj: '{name} פרסם/ה: {obj}', friendPostTitle: '{name} פרסם/ה עכשיו', friendPostBody: 'בואו לראות את ההתקדמות ולהגיב.',
    objectiveDoneTitle: '🏆 {name} השיג/ה את היעד', objectiveDoneBody: '"{obj}". לכו להגיד כל הכבוד.', objectiveDoneBodyNoObj: 'לכו להגיד כל הכבוד.',
    duoTagTitle: '{name} תייג/ה אותך באימון 🤝', duoTagBodyObj: '{obj}. פרסמו את שלכם תוך שעה כדי לאשר את הזוג.', duoTagBody: 'פרסמו את שלכם תוך שעה כדי לאשר את הזוג.',
    atGymTitlePlace: '{name} נמצא/ת ב{place} 💪', atGymTitle: '{name} בחדר הכושר 💪', atGymBody: 'בואו להתאמן עם {first}.', defaultPlace: 'חדר הכושר',
    tagEndorseTitle: '{name} אישר/ה את התג שלך', tagEndorseBodyTag: '"{tag}" בפרופיל שלך', tagEndorseBody: 'לכו לראות את הפרופיל.',
    friendRequestTitle: '{name} רוצה להצטרף למעגל שלך', friendRequestBody: 'אשרו כדי לעקוב אחרי ההתקדמות אחד של השני.',
    friendAcceptTitle: '{name} אישר/ה את הבקשה שלך', friendAcceptBody: 'אתם באותו מעגל. לכו לראות את היעדים.',
    challengeInviteTitle: '{name} מאתגר/ת אותך 🔥', challengeInviteBody: 'דו־קרב של שבוע: מי יתאמן ביותר ימים? ענו באפליקציה.',
    challengeAcceptTitle: '{name} קיבל/ה את האתגר שלך 💪', challengeAcceptBody: 'יוצאים ל-7 ימים. כל יום שבו מפרסמים אימון נחשב.',
    challengeResultTitle: '{icon} האתגר מול {name} הסתיים', challengeResultBody: 'לכו לראות את התוצאה.',
    duelResult: { win: 'ניצחון {a} מול {b}', lose: 'הפסד {a} מול {b}', draw: 'תיקו {a} מול {b}' },
    cardTitle: '{first} מחכה לך 🤝', cardSubtitle: 'פרסמו את האימון כדי לאשר את הזוג',
    cardAlertBodyObj: '{obj}. יש לכם שעה לפרסם את שלכם ולאשר את הזוג.', cardAlertBody: 'יש לכם שעה לפרסם את שלכם ולאשר את הזוג.', cardRemaining: 'נותרו',
    cardOrangeTitle: '⏳ נותרו רק 20 דק׳ לזוג עם {who}', cardOrangeBody: 'פרסמו את האימון כדי לאשר את הזוג.',
    cardRedTitle: '⏳ דקות אחרונות לזוג עם {who}', cardRedBody: 'פרסמו את האימון עכשיו כדי לאשר את הזוג.',
    duoLeft30: 'כ-30 דקות', duoLeft10: 'כ-10 דקות',
    duoRemind1Title: '⏳ הזוג עם {who} עומד לפוג', duoRemind1Body: 'נותרו לכם {left} לפרסם את האימון.',
    duoRemind2Title: '⏳ ישורת אחרונה לזוג עם {who}', duoRemind2Body: 'נותרו {left}: פרסמו את האימון עכשיו כדי לאשר את הזוג.',
    dailyTitle: '⏰ עוד לא פרסמתם היום', dailyBodyPosted: '{names} כבר פרסמו היום. ואתם?', dailyBodyPostedOne: '{names} כבר פרסם/ה היום. ואתם?',
    dailyBodyNobody: 'אף אחד במעגל עוד לא פרסם. תנו דוגמה.',
    dailyStreakTitle: '🔥 רצף של {n} ימים על הכף', dailyStreakBodyPosted: 'אימון אחד והוא ממשיך. {names} כבר פרסמו.',
    dailyStreakBodyPostedOne: 'אימון אחד והוא ממשיך. {names} כבר פרסם/ה.', dailyStreakBody: 'אימון אחד היום והוא ממשיך.',
    dailyDuelTitle: '⚔️ הדו־קרב שלך מול {who}', dailyDuelBehind: '{theirs} מול {mine} לטובתם. פרסמו היום כדי לחזור.',
    dailyDuelAhead: 'אתם מובילים {mine} מול {theirs}. פרסמו היום כדי להגדיל את הפער.', dailyDuelTie: 'תיקו {mine} מול {theirs}. האימון של היום יכריע.',
    dailyFirstTitle: '📸 הפוסט הראשון שלכם', dailyFirstBodyPosted: '{names} פרסמו היום. המעגל מחכה לתמונה הראשונה שלכם.',
    dailyFirstBodyPostedOne: '{names} פרסם/ה היום. המעגל מחכה לתמונה הראשונה שלכם.', dailyFirstBody: 'המעגל מחכה לתמונה הראשונה שלכם. אחת מספיקה כדי להתחיל.',
    almostTitlePct: 'נותרו רק {left}% 🔥', almostTitle: 'נותרו רק {left} {unit} 🔥', almostBody: '"{obj}": {cur} / {target}{pct}. כמעט שם.',
    friendsPostedOne: '{a} פרסם/ה בימים האחרונים.', friendsPostedTwo: '{a} ו{b} פרסמו בימים האחרונים.',
    gap3Title: 'עברו 3 ימים 👀', gap3Body: 'אימון קצר מספיק כדי לחזור לעניינים.',
    gap7Title: 'שבוע בלי לפרסם', gap7Body: 'חזרו עם אימון, גם קצר.',
    gap14Title: 'המעגל חושב עליכם', gap14Body: 'הציבו לעצמכם יעד קטן וחזרו בהדרגה.',
    first1Title: 'הפוסט הראשון שלכם מחכה 📸', first1Body: '"{obj}" מתחיל בתמונה אחת. המעגל יראה אותה מיד.',
    first3Title: 'המעגל עוד לא ראה אתכם 👀', first3Body: 'תמונה אחת מהאימון ל"{obj}", והם יוכלו לעודד אתכם.',
    first7Title: 'שבוע ב-Reiz', first7Body: 'פרסמו את האימון הראשון ל"{obj}". אחד מספיק כדי להתחיל רצף.',
    random: [
      'המעגל שלך מחכה להתקדמות שלך.',
      'הטובים ביותר לא עוצרים. ואתם?',
      'הראו למעגל ממה אתם עשויים.',
      'הרצף שלך מחכה. קדימה.',
      'עדכון קטן היום? החברים צופים.',
      'עבר זמן, איפה אתם עומדים?',
      'כל יום נחשב. פרסמו את ההתקדמות.',
      'המעגל שלך מתקדם. לא רוצים להישאר מאחור?',
    ],
  },
};

// « Enzo », « Enzo et Axel », « Enzo, Axel et 2 autres ».
export function names(l: Lang, list: string[]) {
  const t = T[l];
  if (list.length === 1) return list[0];
  if (list.length === 2) return fill(t.andTwo, { a: list[0], b: list[1] });
  return fill(list.length === 3 ? t.andMoreOne : t.andMore, { a: list[0], b: list[1], n: list.length - 2 });
}

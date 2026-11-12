// Un objectif en une phrase (1.4, 12/11/2026).
// « Je m'entraîne 3 fois par semaine à la salle » devient { Séance musculation, 3 par semaine, musculation }.
// Tout se fait sur le téléphone, par règles : instantané, hors ligne, et la même phrase donne toujours le même
// résultat. Français, anglais, espagnol et hébreu.
//
// Deux sortes d'objectifs sortent d'une phrase :
//   rythme : une activité et une fréquence (« 3 fois par semaine »). Sans fréquence dite, 3 par semaine est proposé.
//   record : un chiffre mesurable sans fréquence (« 100 kg au bench », « courir 10 km »).
// Rien de reconnu (ni activité ni chiffre) : null, et l'écran propose des objectifs tout prêts.
//
// Fichier pur (aucun import de l'app) : il se teste seul avec node.

export type ParsedGoal = {
  kind: 'rhythm' | 'record';
  /** Clé de l'activité reconnue (titre traduit par l'écran : sentence.act.<key>), null si aucune. */
  activity: string | null;
  /** Catégorie rangée en base (objectives.category) : les sports du profil quand c'est possible. */
  category: string;
  emoji: string;
  /** Titre libre tiré de la phrase, utilisé quand aucune activité n'est reconnue ou pour un record. */
  text: string;
  /** Rythme : séances par semaine (1 à 7). `guessed` : la phrase ne donnait pas de fréquence. */
  perWeek?: number;
  guessed?: boolean;
  /** Mesure dite dans la phrase (« 10 km », « 100 kg ») : la cible d'un record, un détail du titre d'un rythme. */
  amount?: number;
  unit?: string;
  /** Objectif tout prêt : son nom vient de la discipline (clé i18n), et sa durée aussi (en semaines). */
  titleKey?: string;
  weeks?: number;
};

type Activity = { key: string; category: string; emoji: string; re: RegExp };

// L'ordre compte : le plus précis d'abord (« cours de yoga » avant « je cours », « footing » avant « foot »).
const ACTIVITIES: Activity[] = [
  { key: 'hyrox', category: 'hyrox', emoji: '🛷', re: /hyrox|sled|wall ?ball|הייר/i },
  { key: 'crossfit', category: 'crossfit', emoji: '🏋️', re: /cross ?fit|\bwod\b|קרוספיט/i },
  { key: 'pilates', category: 'yoga', emoji: '🧘', re: /pilates|פילאטיס/i },
  { key: 'yoga', category: 'yoga', emoji: '🧘', re: /yoga|stretch|[ée]tirement|mobilit|estiramiento|יוגה|מתיחות/i },
  { key: 'danse', category: 'danse', emoji: '💃', re: /dans[eé]|danc|bail[ea]|zumba|ריקוד|לרקוד/i },
  { key: 'boxe', category: 'combat', emoji: '🥊', re: /box|אגרוף/i },
  { key: 'combat', category: 'combat', emoji: '🥋', re: /\bmma\b|\bjjb\b|\bbjj\b|jiu|judo|karat|krav|lutte|lucha|grappl|muay|kick|taekwondo|combat|martial|ג'ודו|קרב|קראטה/i },
  { key: 'natation', category: 'natation', emoji: '🏊', re: /nag|natation|nataci|nadar|nado|piscin|swim|longueur|שחי|לשחות|בריכה/i },
  { key: 'cyclisme', category: 'cyclisme', emoji: '🚴', re: /v[ée]lo|cycl|ciclis|bici|bike|biking|gravel|spinning|rpm\b|אופניים|ספינינג/i },
  { key: 'running', category: 'running', emoji: '🏃', re: /courir|\bje cours\b|\bcours \d|course|footing|jogg|\brun|marathon|marat[oó]n|\bsemi\b|trail|sprint|correr|corro|carrera|ריצ|לרוץ|\bרץ\b/i },
  { key: 'street', category: 'street-workout', emoji: '🤸', re: /street|calisth|calisten|traction|dominad|pull.?up|push.?up|pompes|flexion|\bdips\b|muscle.?up|מתח|שכיבות/i },
  { key: 'escalade', category: 'escalade', emoji: '🧗', re: /escalad|grimp|climb|\bbloc\b|boulder|טיפוס/i },
  { key: 'football', category: 'football', emoji: '⚽', re: /foot(?!ing)|f[uú]tbol|soccer|futsal|כדורגל/i },
  { key: 'basket', category: 'basket', emoji: '🏀', re: /basket|b[aá]squet|baloncesto|כדורסל/i },
  { key: 'padel', category: 'raquette', emoji: '🎾', re: /padel|pádel|פאדל/i },
  { key: 'tennis', category: 'raquette', emoji: '🎾', re: /tennis|tenis|squash|badminton|ping|טניס/i },
  { key: 'marche', category: 'marche', emoji: '🚶', re: /march[eé]|rando|walk|hik|camin|senderis|\d\s*pas\b|steps|pasos|הליכה|ללכת|צעדים/i },
  { key: 'musculation', category: 'musculation', emoji: '🏋️', re: /muscu|\bsalle\b|\bgym|gimnasio|fitness|halt[èe]re|pesas|bench|squat|sentadilla|deadlift|soulev|d[ée]velopp|\bforce\b|fuerza|strength|weights?|lift|חדר כושר|משקולות|כושר/i },
  { key: 'sport', category: 'autre', emoji: '💪', re: /entra[iî]n|entren|\btrain|work ?out|\bsport|deporte|ejercicio|exercice|exercise|s[ée]ance|session|sesi[oó]n|אימון|להתאמן|מתאמן|ספורט/i },
];

// Mots de la vie courante, hors sport : seulement l'emoji, le titre reste la phrase.
const EXTRA_EMOJI: [RegExp, string][] = [
  [/m[ée]dit|mindful|מדיטציה/i, '🧘'],
  [/\blire\b|lecture|\bread|\bleer\b|livre|book|libro|לקרוא|ספר/i, '📚'],
  [/dorm|sommeil|sleep|sue[ñn]o|שינה|לישון/i, '😴'],
  [/\beau\b|boire|water|agua|hydrat|hidrat|מים/i, '💧'],
  [/cuisin|cook|cocin|manger|meal|repas|לבשל/i, '🥗'],
];

const WORDS: Record<string, number> = {
  un: 1, une: 1, deux: 2, trois: 3, quatre: 4, cinq: 5, six: 6, sept: 7,
  one: 1, once: 1, two: 2, twice: 2, three: 3, four: 4, five: 5, seven: 7,
  uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7,
  'פעם': 1, 'אחת': 1, 'פעמיים': 2, 'שתיים': 2, 'שלוש': 3, 'ארבע': 4, 'חמש': 5, 'שש': 6, 'שבע': 7,
};
const NUM = `(\\d{1,3}|${Object.keys(WORDS).join('|')})`;
const toNum = (s: string) => WORDS[s.toLowerCase()] ?? Number(s);

// Ce qui se compte « par semaine ».
const COUNT = '(?:x|fois|s[ée]ances?|sessions?|entra[iî]nements?|sorties?|jours?|times?|days?|workouts?|runs?|veces|vez|sesiones|sesi[oó]n|d[ií]as?|entrenos?|entrenamientos?|פעמים|אימונים|ימים)';
const WEEK = '(?:sem(?:aines?)?\\b\\.?|hebdo\\w*|weeks?\\b|wk\\b|weekly|semanas?\\b|semanal\\w*|שבוע)';
const MONTH = '(?:mois\\b|months?\\b|monthly|mes\\b|meses\\b|חודש)';
const PER = '(?:\\/|par|per|a|an|por|chaque|each|every|cada|à la|a la|la|al|ב)';

const FREQ_WEEK = new RegExp(`${NUM}\\s*${COUNT}?\\s*${PER}\\s*${WEEK}`, 'i');
const FREQ_MONTH = new RegExp(`${NUM}\\s*${COUNT}?\\s*${PER}\\s*${MONTH}`, 'i');
const FREQ_BARE = new RegExp(`${NUM}\\s*${COUNT}(?![a-zà-ÿ])`, 'i');
const TWICE = /\b(once|twice)\b/i;
const HE_TWICE = /פעמיים|פעם (?:אחת )?בשבוע/;
const EVERY_DAY = /tous les jours|chaque jour|quotidien|au quotidien|every ?day|daily|each day|cada d[ií]a|todos los d[ií]as|a diario|diari[oa]|כל יום/i;
const EVERY_OTHER = /un jour sur deux|every other day|d[ií]a por medio|cada dos d[ií]as|יום כן יום לא/i;
const WEEKEND = /week-?ends?|fin(?:es)? de semana|סוף ?שבוע|סופ"ש/i;

// Une mesure : « 100 kg », « 10 km », « 45 min »...
const UNITS: [RegExp, string][] = [
  [/^(kg|kgs|kilos?|kilogram\w*|ק"ג|קילו)$/i, 'kg'],
  [/^(km|kms|kilom[eèé]tr\w*|ק"מ|קילומטר\w*)$/i, 'km'],
  [/^(min|mins|minutes?|minutos?|דקות)$/i, 'min'],
  [/^(reps?|r[ée]p[ée]titions?|repeticiones|pompes|tractions|squats|abdos|חזרות)$/i, 'reps'],
  [/^(pas|steps|pasos|צעדים)$/i, 'pas'],
  [/^(h|heures?|hours?|horas?|שעות)$/i, 'h'],
  [/^(lbs?|livres|pounds?)$/i, 'lbs'],
  [/^(cal|kcal|calories?|calor[ií]as)$/i, 'cal'],
];
const AMOUNT = /(\d+(?:[.,]\d+)?)\s*([a-zA-ZÀ-ÿ"֐-׿]+)/g;

// Débuts de phrase qui ne font pas partie du titre : « je veux », « mon objectif est de », « I want to »...
const LEAD = /^\s*(?:mon objectif(?: est| c'est)?(?: de| d')?|mi objetivo es|my goal is(?: to)?|objectif\s*:?|je (?:veux|vais|voudrais|dois|compte|souhaite)(?: me| m')?|j'aimerais|j'ai envie de|je (?:m'|me )|j'|i (?:want|will|would like|need|plan)(?: to)?|i'?ll|i |quiero|voy a|me gustar[ií]a|debo|tengo que|אני רוצה|אני (?:הולך|הולכת)|המטרה שלי(?: היא)?)\s*/i;
const TRAIL = /[\s,.;:!?-]+$/;

const clean = (s: string) => {
  let out = s.replace(/\s+/g, ' ').trim();
  for (let i = 0; i < 3; i++) out = out.replace(LEAD, '');
  out = out.replace(TRAIL, '').replace(/^[\s,.;:-]+/, '').trim();
  return out ? out.charAt(0).toUpperCase() + out.slice(1) : '';
};

function amountIn(text: string): { amount: number; unit: string; raw: string } | null {
  AMOUNT.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = AMOUNT.exec(text))) {
    const hit = UNITS.find(([r]) => r.test(m![2]));
    const amount = Number(m[1].replace(',', '.'));
    if (hit && amount > 0) return { amount, unit: hit[1], raw: m[0] };
  }
  return null;
}

/** Fréquence par semaine dite dans la phrase, et le morceau de texte qui la dit. */
function frequencyIn(text: string): { perWeek: number; raw: string } | null {
  let m = FREQ_WEEK.exec(text);
  if (m) { const n = toNum(m[1]); if (n >= 1 && n <= 14) return { perWeek: Math.min(n, 7), raw: m[0] }; }
  m = FREQ_MONTH.exec(text);
  if (m) { const n = toNum(m[1]); if (n >= 1 && n <= 31) return { perWeek: Math.max(1, Math.min(7, Math.round(n / 4.3))), raw: m[0] }; }
  m = EVERY_OTHER.exec(text);
  if (m) return { perWeek: 4, raw: m[0] };
  m = EVERY_DAY.exec(text);
  if (m) return { perWeek: 7, raw: m[0] };
  m = HE_TWICE.exec(text);
  if (m) return { perWeek: m[0].startsWith('פעמיים') ? 2 : 1, raw: m[0] };
  m = TWICE.exec(text);
  if (m) return { perWeek: toNum(m[1]), raw: m[0] };
  m = FREQ_BARE.exec(text);
  // « 4 séances » sans « par semaine » : un rythme tant que le chiffre tient dans une semaine.
  if (m) { const n = toNum(m[1]); if (n >= 1 && n <= 7) return { perWeek: n, raw: m[0] }; }
  m = WEEKEND.exec(text);
  if (m) return { perWeek: 2, raw: m[0] };
  return null;
}

export function parseSentence(input: string): ParsedGoal | null {
  const text = (input || '').replace(/\s+/g, ' ').trim();
  if (text.length < 2) return null;

  const act = ACTIVITIES.find(a => a.re.test(text)) ?? null;
  const freq = frequencyIn(text);
  // La mesure se cherche hors du morceau « 3 fois par semaine » (sinon « 3 h par semaine » se lit deux fois).
  const measure = amountIn(freq ? text.replace(freq.raw, ' ') : text);
  const extra = EXTRA_EMOJI.find(([r]) => r.test(text))?.[1];
  const emoji = act?.emoji ?? extra ?? '🎯';
  const category = act?.category ?? 'autre';
  const rest = clean(freq ? text.replace(freq.raw, ' ') : text);

  if (freq) {
    // Une fréquence sans activité ni rien d'autre à dire (« 3 fois par semaine ») : du sport, par défaut.
    const activity = act?.key ?? (rest.length < 2 ? 'sport' : null);
    return {
      kind: 'rhythm', activity, category, emoji: activity === 'sport' && !act ? '💪' : emoji, text: rest,
      perWeek: freq.perWeek, amount: measure?.amount, unit: measure?.unit,
    };
  }
  // Un chiffre mesurable sans fréquence : un record (« 100 kg au bench », « courir 10 km »).
  if (measure) return { kind: 'record', activity: act?.key ?? null, category, emoji, text: rest, amount: measure.amount, unit: measure.unit };
  // Une activité reconnue sans chiffre : 3 fois par semaine, à corriger d'un geste.
  if (act) return { kind: 'rhythm', activity: act.key, category, emoji, text: rest, perWeek: 3, guessed: true };
  return null;
}

/** Objectifs tout prêts, proposés quand la phrase n'est pas comprise (ou d'entrée, champ vide). */
// Trois objectifs tout prêts, chacun cohérent avec sa pratique (Yllan, 12/11/2026) : le nom, le rythme et la durée
// sont ceux du profil « Régulier » de la discipline (SportCarousel : Hyrox 4 séances sur 8 semaines, running 3 sur 8).
// Si les profils de SportCarousel changent, reporter les chiffres ici.
export const READY_GOALS: ParsedGoal[] = [
  { kind: 'rhythm', activity: 'sport', category: 'autre', emoji: '💪', text: '', perWeek: 3, weeks: 4 },
  { kind: 'rhythm', activity: 'hyrox', category: 'hyrox', emoji: '🛷', text: '', perWeek: 4, weeks: 8, titleKey: 'sports.hyrox.title' },
  { kind: 'rhythm', activity: 'running', category: 'running', emoji: '🏃', text: '', perWeek: 3, weeks: 8, titleKey: 'sports.running.title' },
];

/** Les sports qui existent aussi sur le profil (users.sport, recherche par sport dans l'onglet Amis). */
export const PROFILE_SPORTS = ['musculation', 'street-workout', 'hyrox', 'running', 'cyclisme', 'combat', 'natation'];

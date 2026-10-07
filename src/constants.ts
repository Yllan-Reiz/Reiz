import Constants from 'expo-constants';
// Landing officielle (Netlify) — utilisée par le lien CGU et les invitations.
export const LANDING_URL = 'https://reiz-landing.netlify.app';
export const CGU_URL = `${LANDING_URL}/cgu.html`;
export const PRIVACY_URL = `${LANDING_URL}/confidentialite.html`;

// Lien d'invitation : ouvre la page /invite.html qui route vers l'app (deep link).
// Le ?ref=pseudo permet d'auto-envoyer la demande d'ami au parrain à l'inscription.
export const inviteUrl = (username: string) => `${LANDING_URL}/invite.html?ref=${encodeURIComponent(username)}`;

export const EMOJI_LIST =['🎯','💪','🏋️','🏃','🚴','🏊','🥊','⚽','🏀','🎾','🧗','🤸','🥇','🔥','⚡','🚀','❤️','🍎','💧','😴'];

export const ALL_REACTION_EMOJIS = ['❤️','🔥','💪','👏','😮','🎯','⚡','🙌','💯','🏆','✨','🚀','😂','🥹','😍','🤩','😎','💀','😭','😅','🤯','🥳','👍','🫶','❤️‍🔥','💥','🧠','👀','🏃','🚴','🏊','🧘','🏋️','🥊','🏅','🥇','💧','🍎','🥑','🍌','🎉','🌟','💫'];

// Unités proposées en un tap à la création d'un objectif. La roue complète
// (UNITS) reste disponible derrière « Options ».
export const QUICK_UNITS = ['séances', 'kg', 'km', 'fois', 'min', 'reps', 'pas'];
export const UNITS = ['km', 'm', 'kg', 'lbs', 'min', 'h', 'x', 'reps', 'séances', 'cal', 'pas', 'fois'];
export const ITEM_H = 44;

export const DURATION_OPTIONS: { label: string; value: number | null }[] = [
  { label: '7j', value: 7 },
  { label: '21j', value: 21 },
  { label: '30j', value: 30 },
  { label: '60j', value: 60 },
  { label: '90j', value: 90 },
  { label: '∞', value: null },
];

// === Mise en page ===
// Une seule gouttière pour tout l'écran : en-tête, contenu et barre de nav
// tombent sur le même axe vertical. Toute valeur en dur ailleurs = désalignement.
export const GUTTER = 16;
export const NAV_HEIGHT = 64;      // hauteur des pilules de nav
export const NAV_BOTTOM_MIN = 20;  // marge sous la barre quand il n'y a pas de home indicator

/** Espace à réserver en bas d'une liste pour que rien ne finisse sous la barre de nav. */
export const navClearance = (bottomInset: number) =>
  NAV_HEIGHT + Math.max(bottomInset, NAV_BOTTOM_MIN) + 24;

export const HEATMAP_DEFAULT_DAYS = 30; // pour les objectifs ∞ (durée indéfinie)
export const HEATMAP_MAX_DAYS = 90;     // plafond visuel pour ne pas exploser l'écran

export function daysFor(obj: { duration_days?: number | null }): number {
  if (obj.duration_days == null) return HEATMAP_DEFAULT_DAYS;
  return Math.max(1, Math.min(obj.duration_days, HEATMAP_MAX_DAYS));
}

export function dayKeysFor(nbDays: number): string[] {
  const keys: string[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (let i = nbDays - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    keys.push(d.toDateString());
  }
  return keys;
}

// Version affichée dans les paramètres (vient de app.json, jamais saisie à la main).
export const APP_VERSION = `${Constants.expoConfig?.version ?? '?'} (${Constants.expoConfig?.extra?.buildTag ?? 'dev'})`;

// Jours d'entraînement : 1 = lundi ... 7 = dimanche (comme `isodow` dans Postgres).
// `null` ou liste vide = tous les jours (comportement d'origine, aucun objectif existant ne change).
export const DAY_LETTERS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
export const DAY_SHORT = ['lun', 'mar', 'mer', 'jeu', 'ven', 'sam', 'dim'];
export const DAY_LONG = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
export const ALL_DAYS = [1, 2, 3, 4, 5, 6, 7];
export const TRAINING_PRESETS: { label: string; days: number[] }[] = [
  { label: 'Tous les jours', days: ALL_DAYS },
  { label: 'Lun, mer, ven', days: [1, 3, 5] },
  { label: 'Lun, mar, jeu, sam', days: [1, 2, 4, 6] },
  { label: 'Week-end', days: [6, 7] },
];

/** Vrai si l'objectif prévoit un planning (au moins un jour de repos). */
export const hasSchedule = (days?: number[] | null) => !!days && days.length > 0 && days.length < 7;

/** « tous les jours », « lun, mer, ven » ou, en version longue, « lundi, mercredi et vendredi ». */
export function daysLabel(days?: number[] | null, long = false): string {
  if (!hasSchedule(days)) return 'tous les jours';
  const sorted = [...days!].sort((a, b) => a - b);
  const names = sorted.map(d => (long ? DAY_LONG : DAY_SHORT)[d - 1]);
  if (!long || names.length === 1) return names.join(', ');
  return `${names.slice(0, -1).join(', ')} et ${names[names.length - 1]}`;
}

/** Les 7 jours de la semaine en cours (du lundi au dimanche), sous la même forme que `dayKeysFor`. */
export function currentWeekKeys(): string[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => { const d = new Date(monday); d.setDate(monday.getDate() + i); return d.toDateString(); });
}

/** Jour de la semaine d'aujourd'hui, 1 = lundi ... 7 = dimanche (heure de l'iPhone). */
export const todayIso = () => ((new Date().getDay() + 6) % 7) + 1;

/** Vrai si un objectif prévoit une séance aujourd'hui (sans planning : tous les jours). */
export const trainsToday = (days?: number[] | null) => !hasSchedule(days) || days!.includes(todayIso());

// Essais de design « verre » (08/10/2026). Passer un interrupteur à false ramène l'ancien design de l'onglet :
// l'ancien code est resté intact à côté du nouveau.
export const GLASS_OBJECTIVES = true;
export const GLASS_FRIENDS = true;

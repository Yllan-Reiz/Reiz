// ⚠️ Remplace par l'URL réelle de ta landing une fois déployée sur Netlify
// (ex: https://reiz.netlify.app). Utilisée par le lien CGU et les invitations.
export const LANDING_URL = 'https://reiz.netlify.app';
export const CGU_URL = `${LANDING_URL}/cgu.html`;
export const PRIVACY_URL = `${LANDING_URL}/confidentialite.html`;

export const EMOJI_LIST =['🎯','💪','🏃','📚','🧘','🚀','🏋️','🏦','💰','❤️','🎵','🎨','✍️','🧠','🌍','🏊','🚴','⚽','🎾','🍎','😴','💼','📈','🔥'];

export const ALL_REACTION_EMOJIS = ['❤️','🔥','💪','👏','😮','🎯','⚡','🙌','💯','🏆','✨','🚀','😂','🥹','😍','🤩','😎','💀','😭','😅','🤯','🥳','👍','🫶','❤️‍🔥','💥','🧠','👀','🏃','🚴','🏊','🧘','🏋️','🥊','🏅','🥇','💧','🍎','🥑','🍌','🎉','🌟','💫'];

export const UNITS = ['%', 'km', 'm', 'kg', 'lbs', 'min', 'h', 'x', 'reps', 'séances', 'cal', 'pas', 'fois'];
export const ITEM_H = 44;

export const DURATION_OPTIONS: { label: string; value: number | null }[] = [
  { label: '7j', value: 7 },
  { label: '21j', value: 21 },
  { label: '30j', value: 30 },
  { label: '60j', value: 60 },
  { label: '90j', value: 90 },
  { label: '∞', value: null },
];

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

// Niveaux des badges : 6 par badge, comme sur la planche « Collection des badges ».
//
// Les paliers (`steps`) sont une PROPOSITION. Le niveau 1 reprend la règle d'origine de chaque
// badge : toute personne qui avait un badge le garde au niveau 1 (rien n'est retiré). Les cinq
// niveaux suivants montent progressivement. Pour changer un palier, modifier la liste ici :
// le calcul, les barres de progression et les textes suivent tout seuls.
//
// `color` = la couleur dominante du badge sur la planche. Elle sert aux pastilles de niveau
// du badge.

export const MAX_LEVEL = 6;

export type BadgeRule = {
  /** Valeur à atteindre pour chacun des 6 niveaux (croissante). */
  steps: number[];
  /** Suffixe de la progression (« 5/7 j » pour les séries). */
  unit?: string;
  color: string;
  /** Phrase d'un palier : say(7) = « Poster 7 jours d'affilée. » */
  say: (n: number) => string;
};

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

export const BADGE_RULES: Record<string, BadgeRule> = {
  first: { steps: [1, 3, 5, 8, 12, 20], color: '#a9c7ff', say: n => (n === 1 ? 'Publier ta première progression.' : `Publier ${n} progressions.`) },
  s3: { steps: [3, 4, 5, 6, 8, 10], unit: ' j', color: '#ff8a3d', say: n => `Poster ${n} jours d'affilée.` },
  s7: { steps: [7, 10, 14, 18, 21, 24], unit: ' j', color: '#47e0b0', say: n => `Poster ${n} jours d'affilée.` },
  goal: { steps: [1, 2, 3, 5, 8, 12], color: '#3fa2ff', say: n => (n === 1 ? "Atteindre la cible d'un objectif." : `Atteindre la cible de ${n} objectifs.`) },
  p10: { steps: [10, 20, 35, 60, 100, 150], color: '#7fb4ff', say: n => `${n} publications.` },
  video: { steps: [1, 3, 6, 12, 25, 50], color: '#4c8dff', say: n => (n === 1 ? 'Publier une vidéo de ta séance.' : `Publier ${n} vidéos de tes séances.`) },
  duo: { steps: [1, 2, 3, 4, 6, 8], color: '#b27bff', say: n => (n === 1 ? 'Publier une séance avec un ami identifié.' : `${n} séances avec un ami identifié.`) },
  duo5: { steps: [5, 8, 12, 20, 35, 50], color: '#6b6bff', say: n => `${n} séances en duo.` },
  early: { steps: [5, 10, 20, 35, 60, 100], color: '#ffb340', say: n => `${n} ${plural(n, 'post', 'posts')} avant 8 h du matin.` },
  night: { steps: [5, 10, 20, 35, 60, 100], color: '#8a6bff', say: n => `${n} ${plural(n, 'post', 'posts')} après 22 h.` },
  s30: { steps: [30, 40, 50, 75, 100, 150], unit: ' j', color: '#3d8bff', say: n => `Poster ${n} jours d'affilée.` },
  p50: { steps: [50, 80, 120, 180, 260, 365], color: '#ff6a4a', say: n => `${n} publications.` },
};

/** Niveau (0 à 6) pour une valeur donnée. */
export const levelFor = (id: string, value: number) => BADGE_RULES[id].steps.filter(s => value >= s).length;

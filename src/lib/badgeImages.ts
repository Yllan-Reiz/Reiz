// Visuels des badges (planche « Collection des badges », découpée dans design/badges/).
// require() doit être statique : une table plutôt qu'un nom de fichier calculé.
export const BADGE_IMAGES: Record<string, any> = {
  first: require('../../assets/badges/premier-pas.png'),
  s3: require('../../assets/badges/en-feu.png'),
  s7: require('../../assets/badges/semaine-parfaite.png'),
  goal: require('../../assets/badges/objectif-atteint.png'),
  p10: require('../../assets/badges/regulier.png'),
  video: require('../../assets/badges/en-action.png'),
  duo: require('../../assets/badges/en-duo.png'),
  duo5: require('../../assets/badges/binome.png'),
  early: require('../../assets/badges/leve-tot.png'),
  night: require('../../assets/badges/couche-tard.png'),
  s30: require('../../assets/badges/inarretable.png'),
  p50: require('../../assets/badges/acharne.png'),
};

// Quand la planche HD sera découpée : ajouter ici les 6 images de chaque badge (niveau 1 à 6, dans
// l'ordre), par exemple `first: [require('../../assets/badges/premier-pas-niv1.png'), ...]`.
// Tant qu'un badge n'a pas ses 6 images, l'image unique ci-dessus sert à tous les niveaux.
export const BADGE_LEVEL_IMAGES: Record<string, any[]> = {};

export const badgeImage = (id: string, level: number) => BADGE_LEVEL_IMAGES[id]?.[level - 1] ?? BADGE_IMAGES[id];

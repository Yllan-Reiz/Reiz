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

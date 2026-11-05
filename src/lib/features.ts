// Fonctions rangées le 05/11/2026 (1.3 « plus simple ») : le code reste en place, seuls les écrans et les boutons
// disparaissent. Pour en rallumer une, repasser sa ligne à `true` et publier une mise à jour à distance.
// Raison : sur 30 jours, presque personne d'autre que l'équipe ne s'en servait (voir le back-office).
export const FEATURES = {
  /** Badges de profil et leur validation par un ami (ProfileTags). */
  profileTags: false,
  /** Épingler un post sur son profil (menu « ... » d'un post). */
  pinPosts: false,
  /** Boutons « Relancer » : coup de coude à un ami à l'arrêt, relance d'une demande d'ami envoyée. */
  manualNudges: false,
  /** Défis duo (duel de la semaine) : bandeau du fil, carte du profil d'un ami, invitations dans l'Activité. */
  duels: false,
  /** Cartes du duo sur l'écran verrouillé (Activité en direct iOS). */
  duoLockScreenCards: false,
  /** Détection automatique de l'arrivée à la salle (position en arrière-plan). « Je suis à la salle » manuel reste. */
  autoPresence: false,
  /** Parcours d'un objectif ouvert depuis le fil et les profils. Il reste sur l'écran de victoire et au bilan. */
  journeyEverywhere: false,
} as const;

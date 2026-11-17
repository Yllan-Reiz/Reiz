// Fonctions rangées le 05/11/2026 (1.3 « plus simple ») : le code reste en place, seuls les écrans et les boutons
// disparaissent. Pour en rallumer une, repasser sa ligne à `true` et publier une mise à jour à distance.
// Raison : sur 30 jours, presque personne d'autre que l'équipe ne s'en servait (voir le back-office).
export const FEATURES = {
  /** Badges de profil et leur validation par un ami (ProfileTags). */
  profileTags: false,
  /** Épingler un post sur son profil (menu « ... » d'un post). */
  pinPosts: false,
  /** Boutons « Relancer » : coup de coude à un ami à l'arrêt, relance d'une demande d'ami envoyée.
   *  Rangé le 05/11, rallumé le 17/11/2026 : le serveur prévient déjà deux amis quand quelqu'un décroche (« X n'a pas
   *  posté depuis 7 jours »), mais sans ce bouton ils ne pouvaient rien faire (1 relance en 12 jours, 13 avant). */
  manualNudges: true,
  /** Défis duo (duel de la semaine) : bandeau du fil, carte du profil d'un ami, invitations dans l'Activité. */
  duels: false,
  /** Cartes du duo sur l'écran verrouillé (Activité en direct iOS). */
  duoLockScreenCards: false,
  /** Détection automatique de l'arrivée à la salle (position en arrière-plan). « Je suis à la salle » manuel reste. */
  autoPresence: false,
  /** Parcours d'un objectif ouvert depuis le fil et les profils. Rangé le 05/11, rallumé le 15/11/2026 à la demande de
   *  Yllan (objectif fini visible dans le fil et sur le profil). */
  journeyEverywhere: true,
  /** Rythme fini affiché dans le fil du cercle (15/11/2026), avec le parcours en images. */
  circleWins: true,
  /** Feuille « Nouvel objectif » refaite (15/11/2026) : la phrase en grand, des exemples à toucher, un seul bouton en bas
   *  (TalkGoal). À `false`, l'ancienne feuille revient telle quelle (SentenceGoal et le bouton « Créer » en haut). */
  talkGoal: true,
  /** Onglet des objectifs en lignes compactes dès 3 objectifs (15/11/2026) : on touche une ligne pour l'ouvrir en
   *  grande carte. À `false`, toutes les grandes cartes reviennent, comme avant. */
  compactObjectives: true,
  /** Flou du fil tant qu'on n'a rien posté depuis 7 jours (15/11/2026). Les 3 premiers jours d'un compte ne sont pas
   *  floutés. À `false`, le fil est toujours net. */
  weeklyBlur: true,
  /** Astuces « Le savais-tu ? » un jour sur deux dans l'Activité, à la place de « Ton cercle cette semaine ». */
  activityTips: true,
  /** Jauge de fin de semaine sur l'écran verrouillé (15/11/2026) : l'iPhone redonne son jeton de carte au serveur
   *  (notify-moment lance la carte). À `false` avec duoLockScreenCards à `false`, le jeton est effacé à l'ouverture. */
  weekGauge: true,
  /** Moment Reiz, rangé le 15/11/2026 : bandeau « 10 minutes pour être à l'heure » à la publication et mention
   *  « À l'heure / En retard » dans le fil (3 posts à l'heure sur 27 en 30 jours). Le rappel du jour reste envoyé. */
  momentReiz: false,
} as const;

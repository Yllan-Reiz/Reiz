import AsyncStorage from '@react-native-async-storage/async-storage';

// Nouveautés montrées UNE SEULE FOIS, dans une page qui s'ouvre au lancement de l'app après une mise
// à jour (voir components/WhatsNewModal.tsx).
// À chaque mise à jour ou nouveau build : changer `id` (c'est lui qui déclenche l'affichage) et réécrire `items`.
// `video` : adresse d'une courte vidéo de présentation (mp4), affichée en haut de la page.
// Laisser null tant qu'il n'y en a pas. `videoRatio` = largeur / hauteur (9 / 16 = vertical).
export const CHANGELOG: {
  id: string;
  title: string;
  subtitle: string;
  items: { emoji: string; title: string; text: string }[];
  video: string | null;
  videoRatio?: number;
} = {
  id: 'maj-2026-10',
  title: 'Quoi de neuf sur Reiz',
  subtitle: 'Voici ce qui change dans cette mise à jour.',
  video: null,
  items: [
    { emoji: '⚔️', title: 'Le duel de la semaine', text: "Défie un ami depuis son profil. Pendant 7 jours, celui qui s'entraîne sur le plus de jours gagne." },
    { emoji: '📅', title: "Tes jours d'entraînement", text: "Choisis les jours où tu t'entraînes quand tu crées un objectif. Plus de rappel le dimanche si tu te reposes, et ton cercle voit ton planning." },
    { emoji: '⭐', title: 'Ton cercle proche', text: "Mis en avant partout : une carte dans le fil, l'étoile à droite de chaque ami, une bulle sur ton profil. Tes proches sont prévenus quand tu arrives à la salle." },
    { emoji: '📍', title: 'La carte « À la salle »', text: "Enregistre ta salle une fois : ton cercle proche est prévenu à chaque fois que tu y arrives." },
    { emoji: '🏅', title: 'Badges à 6 niveaux', text: 'Touche un badge pour voir le prochain palier.' },
    { emoji: '🔥', title: 'Des encouragements', text: "Un message quand tu approches d'un objectif ou après quelques jours sans poster. Réglable dans Réglages, Notifications." },
    { emoji: '💬', title: "Un centre d'activité plus clair", text: "Plus d'espace, des phrases courtes, les réactions regroupées, et en haut ce qui attend ta réponse (demandes d'ami, défis) et la régularité de ton cercle : qui a posté cette semaine, qui est à relancer." },
    { emoji: '🔴', title: "Pastille sur l'icône", text: "Un nombre rouge sur l'icône de Reiz quand tu as des notifications non lues, comme sur les autres réseaux." },
    { emoji: '🖼️', title: 'Ta photo de profil en grand', text: 'Elle est nette en haut de ton profil, puis passe derrière la page en se floutant quand tu défiles.' },
    { emoji: '📲', title: 'Story plus simple', text: "Ton lien d'invitation est prêt à copier, pour le coller dans le sticker « Lien » d'Instagram et rendre ta story cliquable." },
    { emoji: '⚡', title: "Plus rapide", text: "Le fil s'affiche tout de suite à l'ouverture et les photos se chargent plus légères." },
    { emoji: '🤝', title: 'Correction', text: "La carte « Vous deux » et le bouton pour proposer un duo apparaissent enfin sur le profil de tes amis." },
  ],
};

const KEY = 'reiz.changelog.seen';

export async function changelogUnseen(): Promise<boolean> {
  try { return (await AsyncStorage.getItem(KEY)) !== CHANGELOG.id; } catch { return false; }
}

export async function markChangelogSeen(): Promise<void> {
  try { await AsyncStorage.setItem(KEY, CHANGELOG.id); } catch {}
}

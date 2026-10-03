import AsyncStorage from '@react-native-async-storage/async-storage';

// Nouveautés affichées en tête du fil d'activité, une fois par version.
// À chaque nouveau build : changer `id` et réécrire `items`.
export const CHANGELOG = {
  id: 'build-8',
  title: 'Nouveautés de Reiz',
  items: [
    { emoji: '🤝', text: 'Le duo devient un vrai binôme : duos validés, série de semaines d\'affilée, et un bouton « Proposer un duo » sur le profil de tes amis.' },
    { emoji: '✨', text: 'Ton profil est refait : ta photo en grand, ton cercle en un coup d\'œil, et trois onglets Objectifs, Posts et Badges.' },
    { emoji: '📲', text: 'Partage ta progression en story Instagram : un visuel aux couleurs de Reiz, prêt à poster, depuis le menu « … » de ton post.' },
    { emoji: '🏅', text: 'Les badges ont un nouveau look. Touche-en un pour voir où tu en es.' },
    { emoji: '⚙️', text: 'Réglages refaits : mot de passe, utilisateurs bloqués, export de tes données, règles de la communauté.' },
    { emoji: '🔐', text: 'Connexion avec Apple.' },
    { emoji: '🎬', text: 'Les vidéos sont compressées avant envoi : elles partent et se chargent beaucoup plus vite.' },
  ],
};

const KEY = 'reiz.changelog.seen';

export async function changelogUnseen(): Promise<boolean> {
  try { return (await AsyncStorage.getItem(KEY)) !== CHANGELOG.id; } catch { return false; }
}

export async function markChangelogSeen(): Promise<void> {
  try { await AsyncStorage.setItem(KEY, CHANGELOG.id); } catch {}
}

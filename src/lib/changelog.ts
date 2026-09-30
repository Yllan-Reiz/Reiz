import AsyncStorage from '@react-native-async-storage/async-storage';

// Nouveautés affichées en tête du fil d'activité, une fois par version.
// À chaque nouveau build : changer `id` et réécrire `items`.
export const CHANGELOG = {
  id: 'build-6',
  title: 'Nouveautés de Reiz',
  items: [
    { emoji: '📸', text: 'Le fil fait peau neuve : photos plus grandes, et les visages de ceux qui ont réagi directement sur la photo.' },
    { emoji: '⚡', text: 'Réagis en un tap avec le bouton en bas à droite de chaque photo.' },
    { emoji: '📊', text: 'Une jauge de progression sous chaque post.' },
    { emoji: '🏋️', text: 'Fini les pourcentages : ta progression se compte en kg, en séances, en km.' },
    { emoji: '👆', text: 'Fais glisser la barre de progression, ou touche le chiffre pour le taper.' },
    { emoji: '🎯', text: "Écris « 100 kg au bench » en créant un objectif : l'unité se remplit toute seule." },
    { emoji: '👤', text: "Touche une photo ou un prénom pour ouvrir un profil, partout dans l'app." },
    { emoji: '🤝', text: 'Séances en duo : la mention « avec… » est cliquable et poster ta séance est plus simple.' },
    { emoji: '🚩', text: 'Appui long sur un commentaire pour le signaler.' },
  ],
};

const KEY = 'reiz.changelog.seen';

export async function changelogUnseen(): Promise<boolean> {
  try { return (await AsyncStorage.getItem(KEY)) !== CHANGELOG.id; } catch { return false; }
}

export async function markChangelogSeen(): Promise<void> {
  try { await AsyncStorage.setItem(KEY, CHANGELOG.id); } catch {}
}

import AsyncStorage from '@react-native-async-storage/async-storage';
import { t } from '../i18n';

// Nouveautés montrées UNE SEULE FOIS, dans une page qui s'ouvre au lancement de l'app après une mise
// à jour (voir components/WhatsNewModal.tsx).
// À chaque mise à jour ou nouveau build : changer `id` (c'est lui qui déclenche l'affichage) et réécrire `items`
// (textes dans i18n, bloc `changelog`, dans les 4 langues).
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
  id: 'maj-1.2-accueil',
  title: t('changelog.title'),
  subtitle: t('changelog.subtitle'),
  video: null,
  items: [
    { emoji: '🎯', title: t('changelog.paceTitle'), text: t('changelog.paceText') },
    { emoji: '📅', title: t('changelog.shortTitle'), text: t('changelog.shortText') },
    { emoji: '📍', title: t('changelog.locTitle'), text: t('changelog.locText') },
    { emoji: '😄', title: t('changelog.emojiTitle'), text: t('changelog.emojiText') },
  ],
};

const KEY = 'reiz.changelog.seen';

export async function changelogUnseen(): Promise<boolean> {
  try { return (await AsyncStorage.getItem(KEY)) !== CHANGELOG.id; } catch { return false; }
}

export async function markChangelogSeen(): Promise<void> {
  try { await AsyncStorage.setItem(KEY, CHANGELOG.id); } catch {}
}

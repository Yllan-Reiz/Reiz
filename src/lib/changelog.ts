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
  id: 'maj-1.2-rythme',
  title: t('changelog.title'),
  subtitle: t('changelog.subtitle'),
  video: null,
  items: [
    { emoji: '🎯', title: t('changelog.goalsTitle'), text: t('changelog.goalsText') },
    { emoji: '🛋️', title: t('changelog.offTitle'), text: t('changelog.offText') },
    { emoji: '✅', title: t('changelog.multiTitle'), text: t('changelog.multiText') },
    { emoji: '💬', title: t('changelog.commentsTitle'), text: t('changelog.commentsText') },
    { emoji: '📸', title: t('changelog.mediaTitle'), text: t('changelog.mediaText') },
    { emoji: '👋', title: t('changelog.nudgeTitle'), text: t('changelog.nudgeText') },
  ],
};

const KEY = 'reiz.changelog.seen';

export async function changelogUnseen(): Promise<boolean> {
  try { return (await AsyncStorage.getItem(KEY)) !== CHANGELOG.id; } catch { return false; }
}

export async function markChangelogSeen(): Promise<void> {
  try { await AsyncStorage.setItem(KEY, CHANGELOG.id); } catch {}
}

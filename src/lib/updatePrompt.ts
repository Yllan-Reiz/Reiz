import { Alert, Linking, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { APP_STORE_URL } from '../constants';
import { t } from '../i18n';

// Rappel de mise à jour (1.3, 05/11/2026). Les mises à jour à distance ne touchent que les téléphones qui ont la
// même version de l'app : au 05/11, seuls 13 membres sur 52 étaient vus sur la 1.2. Quand l'App Store propose une
// version plus récente que celle installée, on le dit une seule fois par version, jamais en boucle.
const ASKED_KEY = 'reiz.update.asked.';
const LOOKUP_URL = 'https://itunes.apple.com/lookup?id=6814173335&country=fr';

/** « 1.10.0 » est plus récent que « 1.9.2 » : comparaison nombre par nombre, pas en texte. */
export function isNewer(store: string, installed: string): boolean {
  const a = store.split('.').map(n => parseInt(n, 10) || 0);
  const b = installed.split('.').map(n => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const x = a[i] ?? 0, y = b[i] ?? 0;
    if (x !== y) return x > y;
  }
  return false;
}

export async function maybeAskForUpdate(): Promise<void> {
  if (Platform.OS !== 'ios' || __DEV__) return;
  const installed = String(Constants.nativeAppVersion ?? '');
  if (!installed) return;
  try {
    const res = await fetch(LOOKUP_URL);
    const store = String((await res.json())?.results?.[0]?.version ?? '');
    if (!store || !isNewer(store, installed)) return;
    if (await AsyncStorage.getItem(ASKED_KEY + store)) return;
    await AsyncStorage.setItem(ASKED_KEY + store, '1');
    Alert.alert(t('update.title'), t('update.text'), [
      { text: t('update.later'), style: 'cancel' },
      { text: t('update.cta'), onPress: () => { Linking.openURL(APP_STORE_URL).catch(() => {}); } },
    ]);
  } catch {
    // Pas de réseau ou réponse inattendue : on réessaiera au prochain lancement.
  }
}

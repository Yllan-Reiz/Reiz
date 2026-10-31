import { Alert, Linking } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { t } from '../i18n';

// Autorisations photo (01/11/2026, retour d'un nouvel inscrit bloqué à la photo de profil).
//  - Galerie : AUCUNE autorisation à demander. iOS 14+ et Android 13+ ouvrent un sélecteur système qui ne
//    donne à l'app que la photo choisie. Avant, on demandait l'accès à toute la galerie : un refus (ou
//    « Sélectionner des photos ») bloquait la personne, qui devait quitter l'app pour aller dans les Réglages.
//  - Appareil photo : iOS demande tout seul à la première utilisation. Si c'est déjà refusé, on propose un
//    bouton qui ouvre directement les Réglages de Reiz, au lieu d'expliquer le chemin.
export async function askCamera(): Promise<boolean> {
  try {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status === 'granted') return true;
  } catch {}
  Alert.alert(t('post.permDenied'), t('post.permCamera'), [
    { text: t('common.cancel'), style: 'cancel' },
    { text: t('post.openSettings'), onPress: () => { Linking.openSettings().catch(() => {}); } },
  ]);
  return false;
}

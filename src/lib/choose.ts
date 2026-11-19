import { Alert, Platform } from 'react-native';

// Une fenêtre de choix (essai du 19/11/2026, testeurs fictifs).
// Sur Android, Alert.alert ne montre que les 3 premiers boutons et ne se ferme pas hors des boutons : « Signaler le
// post » perdait son « Annuler » (signalement forcé), « Photo ou vidéo » perdait « Importer une vidéo ».
// `choose` garde la fenêtre du système partout où elle suffit (iPhone, et Android jusqu'à 3 boutons) et passe, sur
// Android au-delà de 3, par une feuille de l'app qui montre tous les choix (components/ChoiceSheet.tsx).

export type Choice = { text: string; onPress?: () => void; style?: 'cancel' | 'destructive' | 'default' };
export type ChoiceRequest = { title: string; message?: string; buttons: Choice[] };

let host: ((req: ChoiceRequest) => void) | null = null;

/** Appelé par ChoiceSheetHost quand il est monté. */
export function registerChoiceHost(fn: (req: ChoiceRequest) => void): () => void {
  host = fn;
  return () => { if (host === fn) host = null; };
}

export function choose(title: string, message: string | undefined, buttons: Choice[]) {
  if (Platform.OS !== 'android' || buttons.length <= 3 || !host) { Alert.alert(title, message, buttons); return; }
  host({ title, message, buttons });
}

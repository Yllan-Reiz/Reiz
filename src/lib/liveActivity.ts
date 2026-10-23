import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo';
import { supabase } from './supabase';
import { endAllLiveActivities, endExpiredLiveActivities } from '../../modules/reiz-live-activity';

// Activité en direct du duo : quand un ami t'identifie dans sa séance, une carte s'affiche sur l'écran
// verrouillé et dans la Dynamic Island, avec le compte à rebours de l'heure pour poster la tienne.
// C'est le serveur qui la lance (notification « push-to-start », iOS 17.2 et plus) : il lui faut le jeton
// que l'iPhone fournit pour ça. expo-live-activity est un module natif du build 13 : sans lui, rien ne se passe.

let lib: any | null | undefined;
function liveActivity(): any | null {
  if (lib !== undefined) return lib;
  try { lib = Platform.OS === 'ios' && requireOptionalNativeModule('ExpoLiveActivity') ? require('expo-live-activity') : null; } catch { lib = null; }
  return lib;
}

let subscription: { remove: () => void } | null = null;

/** Écoute le jeton « push-to-start » de cet iPhone et le range pour le compte connecté. */
export function registerLiveActivityToken() {
  const LA = liveActivity();
  if (!LA?.addActivityPushToStartTokenListener) return;
  subscription?.remove();
  subscription = LA.addActivityPushToStartTokenListener(async ({ activityPushToStartToken }: { activityPushToStartToken: string }) => {
    if (!activityPushToStartToken) return;
    await supabase.rpc('save_live_activity_token', { p_token: activityPushToStartToken }).then(() => {}, () => {});
  }) ?? null;
}

/** Déconnexion (à appeler AVANT signOut) : le jeton n'appartient plus à ce compte. */
export async function forgetLiveActivityToken() {
  subscription?.remove();
  subscription = null;
  await endAllLiveActivities();
  await supabase.rpc('forget_live_activity_token').then(() => {}, () => {});
}

export { endAllLiveActivities, endExpiredLiveActivities };

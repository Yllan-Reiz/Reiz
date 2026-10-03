import * as AppleAuthentication from 'expo-apple-authentication';
import { supabase } from './supabase';
import { setPendingName } from './googleAuth';

// Connexion avec Apple : jeton natif envoyé à Supabase (signInWithIdToken). Aucun navigateur.
// Obligatoire sur l'App Store dès qu'une autre connexion tierce (Google) est proposée (règle 4.8).

export const isAppleAvailable = () => AppleAuthentication.isAvailableAsync().catch(() => false);

/** Renvoie un message d'erreur, ou null si tout va bien (ou si l'utilisateur a annulé). */
export async function signInWithApple(): Promise<string | null> {
  try {
    const cred = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });
    if (!cred.identityToken) return 'Connexion Apple impossible.';
    const first = cred.fullName?.givenName?.trim();
    if (first) setPendingName(first);
    const { error } = await supabase.auth.signInWithIdToken({ provider: 'apple', token: cred.identityToken });
    return error ? error.message : null;
  } catch (e: any) {
    if (e?.code === 'ERR_REQUEST_CANCELED') return null;
    return 'Connexion Apple impossible.';
  }
}

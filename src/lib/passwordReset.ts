import { supabase } from './supabase';

// Mot de passe oublié (essai du 19/11/2026, FEATURES.forgotPassword).
//   1. L'écran de connexion demande un lien : Supabase l'envoie par e-mail.
//   2. Le lien revient dans l'app par la même porte que Google (reiz://auth-callback?code=...), déjà autorisée.
//   3. handleAuthUrl échange le code contre une session et reconnaît une récupération : App.tsx ouvre alors
//      « Nouveau mot de passe ».
// Le lien doit être ouvert sur le téléphone qui l'a demandé (le client garde la clé de l'échange, flux PKCE).

const REDIRECT = 'reiz://auth-callback';

/** Envoie le lien. Renvoie l'erreur de Supabase, ou null si la demande est partie. */
export async function sendPasswordReset(email: string): Promise<{ message?: string } | null> {
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: REDIRECT });
  return error ?? null;
}

// Le lien peut arriver avant que l'écran qui écoute soit monté (app fermée) : on garde le signal.
let listener: (() => void) | null = null;
let pending = false;

export function watchRecovery(cb: () => void): () => void {
  listener = cb;
  if (pending) { pending = false; cb(); }
  return () => { if (listener === cb) listener = null; };
}

export function signalRecovery() {
  if (listener) listener(); else pending = true;
}

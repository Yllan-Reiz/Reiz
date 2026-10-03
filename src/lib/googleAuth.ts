import { Linking } from 'react-native';
import { supabase } from './supabase';

// Connexion avec Google via Supabase (OAuth + PKCE), sans module natif :
// on ouvre l'URL Google dans Safari, Google renvoie vers reiz://auth-callback?code=...
// (scheme déclaré dans app.json), et App.tsx passe ce lien à handleAuthUrl().

export const AUTH_REDIRECT = 'reiz://auth-callback';

export async function signInWithGoogle(): Promise<string | null> {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: AUTH_REDIRECT, skipBrowserRedirect: true },
  });
  if (error || !data?.url) return error?.message || 'Connexion Google impossible.';
  try { await Linking.openURL(data.url); } catch { return "Impossible d'ouvrir Google."; }
  return null;
}

// Un compte Google arrive sans ligne dans `users` (l'inscription par email la crée
// à la main dans Onboarding) : on la crée ici avec un @pseudo unique.
// Apple ne donne le nom qu'à la toute première connexion, et seulement à l'app (pas dans le
// jeton envoyé à Supabase) : appleAuth le dépose ici avant de se connecter.
let pendingName: string | null = null;
export const setPendingName = (name: string | null) => { pendingName = name; };

export async function ensureProfile(user: { id: string; user_metadata?: any; email?: string | null }) {
  const { data: existing } = await supabase.from('users').select('id').eq('id', user.id).maybeSingle();
  if (existing) return;
  const meta = user.user_metadata || {};
  // L'email relais d'Apple (xxxx@privaterelay.appleid.com) est aléatoire : inutilisable comme prénom.
  const emailName = user.email && !/privaterelay\.appleid\.com$/i.test(user.email) ? user.email.split('@')[0] : null;
  const fullName: string = (meta.full_name || meta.name || pendingName || emailName || 'Athlète').toString().trim().slice(0, 40);
  const first = fullName.split(' ')[0] || fullName;
  const base = first.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '') || 'user';
  let username = base;
  for (let attempt = 0; attempt < 5; attempt++) {
    const { error } = await supabase.from('users').insert({ id: user.id, username, full_name: first });
    if (!error || error.code !== '23505') { pendingName = null; return; }
    username = `${base}${Math.floor(1000 + Math.random() * 9000)}`;
  }
}

// Appelé avec chaque lien entrant. Renvoie true si c'était un retour de connexion Google.
export async function handleAuthUrl(url: string | null | undefined): Promise<boolean> {
  if (!url || !url.startsWith(AUTH_REDIRECT)) return false;
  const code = url.match(/[?&]code=([^&#\s]+)/)?.[1];
  if (!code) return true;
  const { data, error } = await supabase.auth.exchangeCodeForSession(decodeURIComponent(code));
  if (!error && data?.user) await ensureProfile(data.user);
  return true;
}

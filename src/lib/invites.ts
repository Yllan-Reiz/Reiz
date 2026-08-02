import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';

// Deep link d'invitation : quand un proche ouvre le lien d'un parrain, on mémorise
// son @pseudo, et dès que l'invité a un compte on lui envoie automatiquement la
// demande d'ami vers le parrain — plus besoin de chercher manuellement le pseudo.
// RLS impose status='pending' + requester=soi : le parrain confirmera côté Amis.

const PENDING_KEY = 'reiz.pending_invite_ref';

// Extrait le code de parrainage (?ref=pseudo) d'une URL, qu'elle soit en scheme natif
// (reiz://invite?ref=x) ou en lien web (https://reiz-landing.netlify.app/invite.html?ref=x).
export function parseInviteRef(url: string | null | undefined): string | null {
  if (!url) return null;
  const m = url.match(/[?&]ref=([^&#\s]+)/i);
  if (!m) return null;
  let ref = m[1];
  try { ref = decodeURIComponent(ref); } catch {}
  ref = ref.replace(/^@/, '').trim();
  return ref || null;
}

// Capture un lien entrant : mémorise le parrain, et si l'utilisateur est déjà connecté,
// transforme tout de suite l'invitation en demande d'ami.
export async function captureInviteFromUrl(url: string | null | undefined, currentUserId?: string | null) {
  const ref = parseInviteRef(url);
  if (!ref) return;
  try { await AsyncStorage.setItem(PENDING_KEY, ref); } catch {}
  if (currentUserId) await consumePendingInvite(currentUserId);
}

// Après connexion/inscription : honore l'invitation mémorisée s'il y en a une.
export async function consumePendingInvite(currentUserId: string) {
  let ref: string | null = null;
  try { ref = await AsyncStorage.getItem(PENDING_KEY); } catch {}
  if (!ref) return;

  const { data: inviter } = await supabase.from('users').select('id').eq('username', ref).maybeSingle();
  if (inviter && inviter.id !== currentUserId) {
    const { error } = await supabase.from('friendships').insert({
      requester_id: currentUserId, receiver_id: inviter.id, status: 'pending',
    });
    // 23505 = demande déjà existante → invitation considérée honorée.
    // Toute autre erreur (réseau...) : on garde le ref pour réessayer plus tard.
    if (error && error.code !== '23505') return;
  }
  // Parrain honoré, déjà ami, ou pseudo introuvable : on nettoie pour ne pas réessayer en boucle.
  try { await AsyncStorage.removeItem(PENDING_KEY); } catch {}
}

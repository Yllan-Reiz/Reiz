import { Linking, Platform, Share } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';
import { LANDING_URL, APP_STORE_URL } from '../constants';
import { track } from './track';
import { t } from '../i18n';

// Lien d'invitation personnel (1.4, phase 35).
//   Chaque compte a un code secret : https://reiz-landing.netlify.app/invite.html?c=CODE
//   Quelqu'un qui s'inscrit avec ce lien devient ami tout de suite avec celui qui l'a invité (accept_invite).
//   Trois chemins, du plus sûr au plus souple :
//     1. l'app est installée : le lien l'ouvre (reiz://invite?c=CODE), le code est gardé jusqu'à la connexion ;
//     2. l'app vient d'être installée : la page a noté le clic, l'app le retrouve à l'inscription (claim_invite) ;
//     3. ancien lien avec le pseudo (?ref=) : simple demande d'ami, comme avant.
// Tant que la phase 35 n'est pas en base, tout retombe sur l'ancien lien : rien ne casse.

const PENDING_KEY = 'reiz.pending_invite_ref';   // ancien lien : @pseudo
const PENDING_CODE = 'reiz.pending_invite_code'; // nouveau lien : code secret
const CLAIMED_KEY = (uid: string) => `reiz.invite_claimed.${uid}`;
const CODE_KEY = (uid: string) => `reiz.invite_code.${uid}`;

export type InviteOutcome = { status: 'friends' | 'requested' | 'already' | 'none'; name?: string | null };

const param = (url: string, key: string): string | null => {
  const m = url.match(new RegExp(`[?&]${key}=([^&#\\s]+)`, 'i'));
  if (!m) return null;
  let v = m[1];
  try { v = decodeURIComponent(v); } catch {}
  return v.replace(/^@/, '').trim() || null;
};

/** Ancien lien : le @pseudo de celui qui invite. */
export const parseInviteRef = (url: string | null | undefined): string | null => (url ? param(url, 'ref') : null);
/** Nouveau lien : le code secret. */
export const parseInviteCode = (url: string | null | undefined): string | null => {
  const c = url ? param(url, 'c') : null;
  return c && /^[a-z0-9]{6,16}$/i.test(c) ? c.toLowerCase() : null;
};

export const inviteLink = (code: string) => `${LANDING_URL}/invite.html?c=${code}`;

/** Capture un lien entrant : on garde le code (ou le pseudo), et si quelqu'un est connecté on l'honore tout de suite. */
export async function captureInviteFromUrl(url: string | null | undefined, currentUserId?: string | null): Promise<InviteOutcome | null> {
  const code = parseInviteCode(url);
  const ref = code ? null : parseInviteRef(url);
  if (!code && !ref) return null;
  try {
    if (code) await AsyncStorage.setItem(PENDING_CODE, code);
    else if (ref) await AsyncStorage.setItem(PENDING_KEY, ref);
  } catch {}
  return currentUserId ? consumePendingInvite(currentUserId) : null;
}

/**
 * Après connexion ou inscription : honore l'invitation gardée s'il y en a une. Sinon, pour un compte tout neuf,
 * cherche une seule fois si un lien a été ouvert juste avant l'installation (lien différé).
 */
export async function consumePendingInvite(currentUserId: string, createdAt?: string | null): Promise<InviteOutcome> {
  let code: string | null = null;
  let ref: string | null = null;
  try { [code, ref] = await Promise.all([AsyncStorage.getItem(PENDING_CODE), AsyncStorage.getItem(PENDING_KEY)]); } catch {}

  if (code) {
    const { data, error } = await supabase.rpc('accept_invite', { p_code: code, p_via: 'link' });
    // Réseau en panne : on garde le code pour réessayer. Fonction absente ou profil pas encore créé : aussi.
    if (error || data?.status === 'none' || data?.status === 'no_profile') return { status: 'none' };
    AsyncStorage.multiRemove([PENDING_CODE, PENDING_KEY]).catch(() => {});
    AsyncStorage.setItem(CLAIMED_KEY(currentUserId), '1').catch(() => {});
    return { status: ['friends', 'requested', 'already'].includes(data?.status) ? data.status : 'none', name: data?.name ?? null };
  }

  if (ref) {
    const { data: inviter } = await supabase.from('users').select('id').eq('username', ref).maybeSingle();
    if (inviter && inviter.id !== currentUserId) {
      const { error } = await supabase.from('friendships').insert({ requester_id: currentUserId, receiver_id: inviter.id, status: 'pending' });
      // 23505 = demande déjà existante : invitation honorée. Toute autre erreur : on garde le pseudo pour réessayer.
      if (error && error.code !== '23505') return { status: 'none' };
    }
    AsyncStorage.removeItem(PENDING_KEY).catch(() => {});
    return { status: inviter ? 'requested' : 'none' };
  }

  // Lien différé : une seule tentative, dans les 2 heures qui suivent la création du compte.
  const fresh = !!createdAt && Date.now() - new Date(createdAt).getTime() < 2 * 3600 * 1000;
  if (!fresh) return { status: 'none' };
  try { if (await AsyncStorage.getItem(CLAIMED_KEY(currentUserId))) return { status: 'none' }; } catch {}
  const { data, error } = await supabase.rpc('claim_invite');
  if (error || data?.status === 'no_profile') return { status: 'none' }; // profil pas encore créé, réseau, fonction absente : on réessaiera
  AsyncStorage.setItem(CLAIMED_KEY(currentUserId), '1').catch(() => {});
  return { status: data?.status === 'friends' ? 'friends' : 'none', name: data?.name ?? null };
}

// ---- Mon lien ----
let mine: { uid: string; link: string; personal: boolean } | null = null;

/** Mon lien d'invitation. `personal` est faux tant que la base ne donne pas de code (repli sur l'ancien lien). */
export async function myInviteLink(userId: string): Promise<{ link: string; personal: boolean }> {
  if (mine && mine.uid === userId && mine.personal) return mine;
  let code: string | null = null;
  try { code = await AsyncStorage.getItem(CODE_KEY(userId)); } catch {}
  if (!code) {
    const { data, error } = await supabase.rpc('my_invite_code');
    if (!error && typeof data === 'string' && data) {
      code = data;
      AsyncStorage.setItem(CODE_KEY(userId), code).catch(() => {});
    }
  }
  if (code) { mine = { uid: userId, link: inviteLink(code), personal: true }; return mine; }
  // Repli : l'ancien lien au pseudo (demande d'ami), ou l'App Store si même le pseudo manque.
  const { data: me } = await supabase.from('users').select('username').eq('id', userId).maybeSingle();
  mine = { uid: userId, link: me?.username ? `${LANDING_URL}/invite.html?ref=${encodeURIComponent(me.username)}` : APP_STORE_URL, personal: false };
  return mine;
}
export const resetInviteLink = () => { mine = null; };
/** Mon lien personnel s'il est déjà chargé (Main le prépare à l'ouverture), sinon null. Pour les textes d'invitation. */
export const currentInviteLink = (): string | null => (mine?.personal ? mine.link : null);

export type InviteChannel = 'whatsapp' | 'sms' | 'share';

/**
 * Ouvre WhatsApp, Messages ou la feuille de partage du téléphone avec le message et le lien déjà écrits.
 * Rien n'est envoyé sans le geste de l'utilisateur. Renvoie vrai si le partage a été ouvert (et pas annulé, quand
 * le téléphone le dit). `from` : d'où vient le geste (welcome, feed_empty, feed, friends).
 */
export async function shareInvite(userId: string, channel: InviteChannel, from: string): Promise<boolean> {
  const { link, personal } = await myInviteLink(userId);
  const message = t('invite.linkText', { link });
  const sent = (ch: InviteChannel) => { track('invite_sent', { channel: ch, from, personal }); return true; };
  if (channel !== 'share') {
    const url = channel === 'whatsapp'
      ? `whatsapp://send?text=${encodeURIComponent(message)}`
      : `sms:${Platform.OS === 'ios' ? '&' : '?'}body=${encodeURIComponent(message)}`;
    try { await Linking.openURL(url); return sent(channel); } catch { /* app absente : feuille de partage */ }
  }
  try {
    const r = await Share.share({ message });
    if (r.action === Share.dismissedAction) return false;
    return sent('share');
  } catch { return false; }
}

import { Linking, Platform } from 'react-native';
import { supabase } from './supabase';
import { signAvatars } from './storage';
import { sha256Hex } from './sha256';
import { inviteUrl, LANDING_URL } from '../constants';

// Tes contacts : retrouver ceux qui sont déjà sur Reiz, et inviter les autres.
//
// CONFIDENTIALITÉ : les contacts ne sont jamais envoyés ni enregistrés. L'app calcule l'EMPREINTE (SHA-256)
// des adresses e-mail, envoie seulement ces empreintes à la fonction `match_contacts` de la base, qui répond
// avec les comptes Reiz correspondants, puis oublie tout. Les noms, numéros et e-mails restent sur le téléphone.
//
// `expo-contacts` est un module natif livré avec la version 1.1.0 : on le charge à la demande. Dans un build
// plus ancien il n'existe pas, `contactsAvailable()` renvoie false et toute la fonction reste cachée.

function native(): any | null {
  try { return require('expo-contacts'); } catch { return null; }
}

export const contactsAvailable = () => { const m = native(); return !!m && typeof m.getContactsAsync === 'function'; };

export type DeviceContact = { id: string; name: string; emails: string[]; phones: string[] };
export type LoadResult = { status: 'ok'; contacts: DeviceContact[] } | { status: 'denied' } | { status: 'unavailable' };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Demande l'autorisation puis lit le carnet d'adresses (noms, e-mails, numéros), classé par nom. */
export async function loadDeviceContacts(): Promise<LoadResult> {
  const C = native();
  if (!C) return { status: 'unavailable' };
  const perm = await C.requestPermissionsAsync();
  if (perm.status !== 'granted') return { status: 'denied' };

  const contacts: DeviceContact[] = [];
  for (let page = 0; page < 20; page++) {
    const res = await C.getContactsAsync({ fields: [C.Fields.Name, C.Fields.Emails, C.Fields.PhoneNumbers], pageSize: 500, pageOffset: page * 500 });
    (res.data || []).forEach((c: any) => {
      const name = (c.name || [c.firstName, c.lastName].filter(Boolean).join(' ')).trim();
      const emails = [...new Set<string>((c.emails || []).map((e: any) => String(e.email || '').trim().toLowerCase()).filter((e: string) => EMAIL.test(e)))];
      const phones = [...new Set<string>((c.phoneNumbers || []).map((p: any) => String(p.number || '').trim()).filter(Boolean))];
      if (name && (emails.length > 0 || phones.length > 0)) contacts.push({ id: String(c.id), name, emails, phones });
    });
    if (!res.hasNextPage) break;
  }
  contacts.sort((a, b) => a.name.localeCompare(b.name, 'fr'));
  return { status: 'ok', contacts };
}

export type Matched = { id: string; full_name: string; username: string; avatar_url: string | null; email_hash: string };

/** Les comptes Reiz qui correspondent aux e-mails de tes contacts. null = la fonction n'existe pas encore côté base. */
export async function matchContacts(contacts: DeviceContact[]): Promise<Matched[] | null> {
  const hashes = [...new Set(contacts.flatMap(c => c.emails).map(sha256Hex))];
  if (hashes.length === 0) return [];
  const found: Matched[] = [];
  for (let i = 0; i < hashes.length; i += 500) {
    const { data, error } = await supabase.rpc('match_contacts', { p_hashes: hashes.slice(i, i + 500) });
    if (error) return null;
    found.push(...((data || []) as Matched[]));
  }
  const signed = await signAvatars(found.map(f => f.avatar_url));
  return found.map(f => ({ ...f, avatar_url: f.avatar_url ? signed[f.avatar_url] ?? null : null }));
}

export const inviteText = (username?: string | null) =>
  `Je suis sur Reiz : mon cercle voit ma progression chaque jour. Rejoins-moi, on se motive. ${username ? inviteUrl(username) : LANDING_URL}`;

/** Ouvre Messages avec le numéro et le texte d'invitation déjà remplis (rien n'est envoyé sans ton tap sur « Envoyer »). */
export function inviteBySms(phone: string, username?: string | null) {
  const body = encodeURIComponent(inviteText(username));
  return Linking.openURL(`sms:${phone.replace(/\s/g, '')}${Platform.OS === 'ios' ? '&' : '?'}body=${body}`);
}

/** Même chose par e-mail, pour un contact qui n'a pas de numéro. */
export function inviteByEmail(email: string, username?: string | null) {
  return Linking.openURL(`mailto:${email}?subject=${encodeURIComponent('Rejoins-moi sur Reiz')}&body=${encodeURIComponent(inviteText(username))}`);
}

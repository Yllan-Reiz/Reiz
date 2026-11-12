import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';
import { APP_VERSION } from '../constants';

// Étapes clés du parcours, rangées dans la table `events` pour le back-office (1.2, 30/10/2026).
// Chacun n'écrit que ses propres lignes et l'app ne les relit jamais. Rien ne bloque l'app :
// une erreur (hors ligne, table absente) est ignorée.
//   welcome_step   { step, index, action: 'view' | 'done' | 'skip' }   un écran de l'accueil
//   welcome_end    { step, via: 'end' | 'skip_all' | 'post' }          fin de l'accueil, et depuis quel écran
//   post_open      { from }                                            ouverture de l'écran de publication
//   post_published { first, duo }                                      post publié (first = premier post du compte)
//   setup_tap      { step }                                            ligne touchée dans la carte « Ton profil »
//
// Entonnoir de l'onboarding (1.4, 12/11/2026), lu par la vue onboarding_funnel (phase 36) :
//   onboarding_start   { install }                    l'écran du prénom s'affiche (AVANT le compte, sans user_id)
//   onboarding_account { install, provider }          le compte existe, l'accueil s'ouvre (relie install et compte)
//   objective_created  { from, via, kind, category, per_week, guessed, edited }   objectif créé (from: welcome | modal)
//   invite_sent        { channel, from, personal }    partage du lien ouvert (channel: whatsapp | sms | share)
//   invite_accepted    { role, via }                  écrit par la base (accept_invite), une ligne pour chacun
//   first_session      { }                            première séance publiée
//   onboarding_done    { objective, invites, invited_by_link }   fin de l'accueil
//   welcome_step / welcome_end portent flow: 'quick' pour le nouveau parcours.

const PLATFORMS = ['ios', 'android', 'web'];

export function track(name: string, props: Record<string, string | number | boolean | null> = {}, screen?: string) {
  supabase.from('events').insert({
    name,
    screen: screen ?? null,
    props,
    platform: PLATFORMS.includes(Platform.OS) ? Platform.OS : null,
    app_version: APP_VERSION.slice(0, 20),
  }).then(() => {}, () => {});
}

// Avant le compte (1.4) : l'écran d'inscription s'est affiché, mais il n'y a encore personne à qui rattacher la
// ligne. Elle part sans user_id, avec un identifiant d'installation tiré au hasard sur ce téléphone (rien de
// personnel), que l'app remet ensuite sur ses premiers événements connectés pour relier les deux moitiés du parcours.
// La base n'accepte ces lignes anonymes que pour quelques noms précis (phase 35).
const INSTALL_KEY = 'reiz.install_id';
let installId: string | null = null;
export async function getInstallId(): Promise<string> {
  if (installId) return installId;
  try { installId = await AsyncStorage.getItem(INSTALL_KEY); } catch {}
  if (!installId) {
    installId = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.floor(Math.random() * 16);
      return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
    });
    AsyncStorage.setItem(INSTALL_KEY, installId).catch(() => {});
  }
  return installId;
}

export function trackAnon(name: 'app_first_open' | 'onboarding_start', props: Record<string, string | number | boolean | null> = {}) {
  getInstallId().then(install => {
    supabase.from('events').insert({
      name, screen: 'onboarding', user_id: null,
      props: { ...props, install },
      platform: PLATFORMS.includes(Platform.OS) ? Platform.OS : null,
      app_version: APP_VERSION.slice(0, 20),
    }).then(() => {}, () => {});
  }).catch(() => {});
}

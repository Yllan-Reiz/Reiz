import { Platform } from 'react-native';
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

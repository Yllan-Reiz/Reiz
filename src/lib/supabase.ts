import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

export const SUPABASE_URL = 'https://vpaizbtetwsnvbpmeuab.supabase.co';
// Exportée pour les envois natifs (vidéos) qui passent hors du client supabase-js.
export const SUPABASE_ANON_KEY = 'sb_publishable_dAHRrHfSQvNwm1LEpNw5Ww_EOTyejXT';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    flowType: 'pkce',
  },
});

// Recommandation officielle Supabase pour React Native : ne rafraîchir le token
// que lorsque l'app est au premier plan.
AppState.addEventListener('change', (state) => {
  if (state === 'active') supabase.auth.startAutoRefresh();
  else supabase.auth.stopAutoRefresh();
});

/**
 * Utilisateur connecté, lu sur le téléphone sans appel réseau.
 * `supabase.auth.getUser()` interroge le serveur à chaque appel (100 à 300 ms perdues à chaque
 * écran) ; `getSession()` relit la session locale et la renouvelle toute seule si besoin. Les droits
 * d'accès restent vérifiés par le serveur à chaque requête (RLS), donc rien n'est affaibli.
 */
export async function currentUser() {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.user ?? null;
}

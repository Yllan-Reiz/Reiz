import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://vpaizbtetwsnvbpmeuab.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_dAHRrHfSQvNwm1LEpNw5Ww_EOTyejXT';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Recommandation officielle Supabase pour React Native : ne rafraîchir le token
// que lorsque l'app est au premier plan.
AppState.addEventListener('change', (state) => {
  if (state === 'active') supabase.auth.startAutoRefresh();
  else supabase.auth.stopAutoRefresh();
});

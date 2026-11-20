import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';
import { lang } from '../i18n';

// La langue de l'app et le fuseau horaire de l'iPhone sont rangés dans le profil (users.language, users.timezone) :
// le serveur écrit les notifications, la carte du duo et les rappels dans la langue de chacun, avec son heure.
// Appelé à chaque lancement une fois connecté, donc un changement de langue (qui relance l'app) arrive tout seul.
// Audit du 20/11/2026 : l'écriture partait à chaque ouverture, même sans changement. Elle ne part plus que si la
// langue ou le fuseau ont changé depuis la dernière fois (retenus sur le téléphone, par compte).
export function saveLanguage(userId: string) {
  let timezone: string | undefined;
  try { timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || undefined; } catch {}
  const now = `${lang()}|${timezone ?? ''}`;
  const key = `reiz.lang.saved.${userId}`;
  AsyncStorage.getItem(key).catch(() => null).then(saved => {
    if (saved === now) return;
    supabase.from('users').update({ language: lang(), ...(timezone ? { timezone } : {}) }).eq('id', userId)
      .then(({ error }) => { if (!error) AsyncStorage.setItem(key, now).catch(() => {}); }, () => {});
  });
}

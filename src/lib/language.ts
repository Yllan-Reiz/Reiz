import { supabase } from './supabase';
import { lang } from '../i18n';

// La langue de l'app et le fuseau horaire de l'iPhone sont rangés dans le profil (users.language, users.timezone) :
// le serveur écrit les notifications, la carte du duo et les rappels dans la langue de chacun, avec son heure.
// Appelé à chaque lancement une fois connecté, donc un changement de langue (qui relance l'app) arrive tout seul.
export function saveLanguage(userId: string) {
  let timezone: string | undefined;
  try { timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || undefined; } catch {}
  supabase.from('users').update({ language: lang(), ...(timezone ? { timezone } : {}) }).eq('id', userId).then(() => {}, () => {});
}

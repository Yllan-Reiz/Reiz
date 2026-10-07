import * as Notifications from 'expo-notifications';

// Pastille rouge sur l'icône de l'app (écran d'accueil de l'iPhone) : le nombre de notifications non lues,
// le même que sur le cœur du fil. Le serveur la pose quand il envoie une notification (champ `badge`),
// l'app la remet à jour à l'ouverture et la vide quand tu as tout lu.
// Sans autorisation « pastille » ou sur un lanceur Android qui ne l'affiche pas : sans effet, jamais d'erreur.
export async function setAppBadge(count: number): Promise<void> {
  try { await Notifications.setBadgeCountAsync(Math.max(0, Math.floor(count) || 0)); } catch {}
}

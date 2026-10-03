import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { supabase } from './supabase';

// « Je suis à la salle » : prévenir le cercle proche quand on arrive à un lieu d'entraînement.
//
// CONFIDENTIALITÉ : les lieux (coordonnées) sont stockés UNIQUEMENT sur ce téléphone, dans
// AsyncStorage. Le serveur ne reçoit jamais de position : seulement l'événement
// « arrivé à <nom du lieu> » (voir supabase/phase11-presence.sql). La détection
// automatique ne démarre qu'après consentement explicite, et se coupe à tout moment.

export type Place = { id: string; label: string; lat: number; lng: number; radius: number };

const PLACES_KEY = 'reiz.presence.places';
const AUTO_KEY = 'reiz.presence.auto';
const LAST_KEY = 'reiz.presence.last';
export const PRESENCE_TASK = 'reiz-presence-geofence';
export const DEFAULT_RADIUS = 150; // mètres : en dessous, iOS ne détecte pas fiablement
export const MAX_PLACES = 5;
export const COOLDOWN_HOURS = 3;

// Tâche système appelée à l'arrivée dans un lieu, même appli fermée. Elle doit être
// définie à l'échelle du module (importé au démarrage dans App.tsx), pas dans un composant.
TaskManager.defineTask(PRESENCE_TASK, async ({ data, error }: any) => {
  if (error || !data) return;
  if (data.eventType !== Location.GeofencingEventType.Enter) return;
  const place = (await loadPlaces()).find(p => p.id === data.region?.identifier);
  if (place) await announcePresence(place.label, 'auto');
});

export async function loadPlaces(): Promise<Place[]> {
  try { return JSON.parse((await AsyncStorage.getItem(PLACES_KEY)) || '[]'); } catch { return []; }
}
const savePlaces = (p: Place[]) => AsyncStorage.setItem(PLACES_KEY, JSON.stringify(p));

export async function isAutoEnabled(): Promise<boolean> {
  try { return (await AsyncStorage.getItem(AUTO_KEY)) === '1'; } catch { return false; }
}

export type Announce = 'sent' | 'throttled' | 'no-circle' | 'error';

/** Envoie « je suis à <label> » au cercle proche. Une alerte toutes les 3 h au maximum. */
export async function announcePresence(label: string, source: 'manual' | 'auto'): Promise<Announce> {
  try {
    const last = Number((await AsyncStorage.getItem(LAST_KEY)) || 0);
    if (Date.now() - last < COOLDOWN_HOURS * 3600 * 1000) return 'throttled';
    const { data: { session } } = await supabase.auth.getSession(); // renouvelle le jeton si besoin, même en tâche de fond
    const uid = session?.user?.id;
    if (!uid) return 'error';
    const { count } = await supabase.from('close_friends').select('id', { count: 'exact', head: true }).eq('owner_id', uid);
    if (!count) return 'no-circle';
    const { data, error } = await supabase.from('presence').insert({ user_id: uid, place_label: label.trim().slice(0, 60) || 'la salle', source }).select('id');
    if (error) return 'error';
    await AsyncStorage.setItem(LAST_KEY, String(Date.now()));
    // Aucune ligne renvoyée : le serveur a ignoré l'envoi (déjà prévenu récemment).
    return data && data.length > 0 ? 'sent' : 'throttled';
  } catch {
    return 'error';
  }
}

/** Message à afficher après un envoi : [titre, texte]. */
export const ANNOUNCE_MESSAGES: Record<Announce, [string, string]> = {
  sent: ['Cercle proche prévenu 💪', "Ils savent que tu es en train de t'entraîner."],
  throttled: ['Déjà prévenu', `Une alerte toutes les ${COOLDOWN_HOURS} heures au maximum.`],
  'no-circle': ['Ton cercle proche est vide', "Ajoute des amis à ton cercle proche (Réglages, Mon cercle proche) pour qu'ils reçoivent l'alerte."],
  error: ['Erreur', 'Impossible de prévenir pour le moment. Réessaie.'],
};

// ---------- Autorisations ----------

export type PermState = { fg: string; bg: string; canAsk: boolean };

export async function permissionState(): Promise<PermState> {
  try {
    const fg = await Location.getForegroundPermissionsAsync();
    const bg = await Location.getBackgroundPermissionsAsync();
    return { fg: fg.status, bg: bg.status, canAsk: fg.canAskAgain };
  } catch {
    return { fg: 'undetermined', bg: 'undetermined', canAsk: true };
  }
}

const askForeground = async () => { try { return (await Location.requestForegroundPermissionsAsync()).status === 'granted'; } catch { return false; } };
const askAlways = async () => { try { return (await Location.requestBackgroundPermissionsAsync()).status === 'granted'; } catch { return false; } };

// ---------- Détection automatique ----------

/** Aligne la surveillance du système sur les lieux enregistrés et l'interrupteur. */
export async function syncGeofencing(): Promise<void> {
  try {
    const [enabled, places] = await Promise.all([isAutoEnabled(), loadPlaces()]);
    const started = await Location.hasStartedGeofencingAsync(PRESENCE_TASK);
    if (!enabled || places.length === 0) {
      if (started) await Location.stopGeofencingAsync(PRESENCE_TASK);
      return;
    }
    await Location.startGeofencingAsync(PRESENCE_TASK, places.map(p => ({
      identifier: p.id, latitude: p.lat, longitude: p.lng, radius: p.radius, notifyOnEnter: true, notifyOnExit: false,
    })));
  } catch {
    // Expo Go et certains appareils ne supportent pas la surveillance en arrière-plan : on n'échoue pas.
  }
}

/** Active ou coupe la détection. Activer demande les deux autorisations (pendant l'usage, puis « toujours »). */
export async function setAutoEnabled(on: boolean): Promise<'ok' | 'denied'> {
  if (on) {
    if (!(await askForeground())) return 'denied';
    if (!(await askAlways())) return 'denied';
  }
  await AsyncStorage.setItem(AUTO_KEY, on ? '1' : '0');
  await syncGeofencing();
  return 'ok';
}

/** Enregistre l'endroit où l'on se trouve comme lieu d'entraînement. */
export async function addPlaceHere(label: string): Promise<Place> {
  if (!(await askForeground())) throw new Error('denied');
  const places = await loadPlaces();
  if (places.length >= MAX_PLACES) throw new Error('max');
  const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
  const place: Place = {
    id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    label: label.trim().slice(0, 40) || 'À la salle',
    lat: pos.coords.latitude,
    lng: pos.coords.longitude,
    radius: DEFAULT_RADIUS,
  };
  await savePlaces([...places, place]);
  await syncGeofencing();
  return place;
}

export async function removePlace(id: string): Promise<void> {
  await savePlaces((await loadPlaces()).filter(p => p.id !== id));
  await syncGeofencing();
}

/** À la déconnexion : on arrête tout, pour qu'un autre compte sur ce téléphone ne soit pas prévenu à la place. */
export async function stopAllPresence(): Promise<void> {
  try {
    await AsyncStorage.multiRemove([AUTO_KEY, PLACES_KEY, LAST_KEY]);
    if (await Location.hasStartedGeofencingAsync(PRESENCE_TASK)) await Location.stopGeofencingAsync(PRESENCE_TASK);
  } catch {}
}

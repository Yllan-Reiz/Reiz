import { useEffect, useState } from 'react';
import { currentUser } from './supabase';
import { cacheGet, cacheSet } from './cache';
import { loadCircleRhythm } from './rhythm';

// La flamme (12/11/2026, demande de Yllan : « une flamme rouge à côté de la photo de profil, dès que l'on valide une
// semaine, comme sur Insta, et que ça se voie partout »). Elle remplace la série affichée en haut à droite du fil.
// Règle : on a la flamme quand sa série vaut au moins une semaine (weekly.ts), c'est-à-dire dès que la semaine en
// cours est validée, et tant que la suivante reste jouable. Une semaine ratée l'éteint.
// Qui : toi et tes amis (ce que le téléphone a le droit de lire). Un seul magasin pour toute l'app : n'importe quel
// écran pose <FlameBadge userId=... /> à côté d'une photo de profil, sans rien charger lui-même.

const lit = new Set<string>();
const listeners = new Set<() => void>();
let loadedFor: string | null = null;
let loadedAt = 0;

const emit = () => { listeners.forEach(l => l()); };

export const hasFlame = (userId?: string | null) => !!userId && lit.has(userId);

/** Allume ou éteint la flamme d'une personne (le fil le fait pour toi dès que ta semaine est recalculée). */
export function setFlame(userId: string, on: boolean) {
  if (on === lit.has(userId)) return;
  if (on) lit.add(userId); else lit.delete(userId);
  if (loadedFor === userId) cacheSet(`flames.${userId}`, [...lit]);
  emit();
}

export function resetFlames() { lit.clear(); loadedFor = null; loadedAt = 0; emit(); }

/** Vrai si cette personne a la flamme. Se met à jour tout seul. */
export function useFlame(userId?: string | null): boolean {
  const [on, setOn] = useState(() => hasFlame(userId));
  useEffect(() => {
    const sync = () => setOn(hasFlame(userId));
    sync();
    listeners.add(sync);
    return () => { listeners.delete(sync); };
  }, [userId]);
  return on;
}

/** Charge les flammes : d'abord celles gardées sur le téléphone (affichage immédiat), puis le calcul à jour. */
export async function loadFlames(force = false): Promise<void> {
  const user = await currentUser();
  if (!user) return;
  if (loadedFor !== user.id) {
    lit.clear();
    const saved = await cacheGet<string[]>(`flames.${user.id}`, 7 * 24 * 3600 * 1000).catch(() => null);
    (saved || []).forEach(id => lit.add(id));
    loadedFor = user.id;
    loadedAt = 0;
    emit();
  }
  if (!force && Date.now() - loadedAt < 5 * 60 * 1000) return;
  loadedAt = Date.now();
  // Mes amis seulement : ma propre flamme est posée par le fil (setFlame), qui calcule déjà ma série. La recalculer
  // ici doublait une lecture de 370 jours de séances à chaque ouverture.
  const circle = await loadCircleRhythm(force).catch(() => null);
  // Calcul incomplet (réseau) : on garde ce qu'on savait.
  if (!circle || loadedFor !== user.id) { loadedAt = 0; return; }
  const mine = lit.has(user.id);
  lit.clear();
  if (mine) lit.add(user.id);
  circle.friends.forEach(f => { if (f.weeks >= 1) lit.add(f.id); });
  cacheSet(`flames.${user.id}`, [...lit]);
  emit();
}

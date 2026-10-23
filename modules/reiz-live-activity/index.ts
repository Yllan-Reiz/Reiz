import { requireOptionalNativeModule } from 'expo';

// Module natif local (modules/reiz-live-activity), arrivé avec le build 13 de la 1.0.1.
const Native = requireOptionalNativeModule<{ endAll(): Promise<number>; endExpired(): Promise<number> }>('ReizLiveActivity');

/** Ferme toutes les cartes du duo (la séance vient d'être postée). */
export const endAllLiveActivities = () => Native?.endAll().catch(() => 0) ?? Promise.resolve(0);
/** Ferme les cartes dont l'heure du duo est passée. */
export const endExpiredLiveActivities = () => Native?.endExpired().catch(() => 0) ?? Promise.resolve(0);

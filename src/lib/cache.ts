import AsyncStorage from '@react-native-async-storage/async-storage';

// Petite mémoire locale : on affiche d'abord ce qu'on avait la dernière fois, puis on rafraîchit
// en arrière-plan. C'est ce qui fait que l'app « est déjà là » dès l'ouverture, sans attendre le réseau.

const PREFIX = 'reiz.cache.';

/** Relit une valeur gardée depuis moins de `maxAgeMs`. Renvoie null si absente, trop vieille ou illisible. */
export async function cacheGet<T>(key: string, maxAgeMs: number): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(PREFIX + key);
    if (!raw) return null;
    const { at, v } = JSON.parse(raw);
    return Date.now() - at <= maxAgeMs ? (v as T) : null;
  } catch {
    return null;
  }
}

export function cacheSet(key: string, value: unknown): void {
  AsyncStorage.setItem(PREFIX + key, JSON.stringify({ at: Date.now(), v: value })).catch(() => {});
}

/** À la déconnexion : rien de ce compte ne doit rester affiché pour le suivant. */
export async function cacheClearAll(): Promise<void> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const mine = keys.filter(k => k.startsWith(PREFIX) || k === 'reiz.signed.v1');
    if (mine.length) await AsyncStorage.multiRemove(mine);
  } catch {}
}

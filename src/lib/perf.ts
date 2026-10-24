// Repères de temps du démarrage, en mode développement seulement (rien en production).
// Chaque repère est écrit dans les journaux de Metro : « [perf] feed:cache +412 ms ».
const t0: number = (global as any).__REIZ_T0 ?? Date.now();
const seen = new Set<string>();

export function mark(name: string, once = true) {
  if (!__DEV__) return;
  if (once && seen.has(name)) return;
  seen.add(name);
  console.log(`[perf] ${name} +${Date.now() - t0} ms`);
}

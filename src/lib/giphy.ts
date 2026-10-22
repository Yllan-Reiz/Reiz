// GIF dans les commentaires, via l'API GIPHY (clé « Reiz », compte reizappcontact).
// La clé n'est PAS dans le dépôt (il est public) : elle vient de EXPO_PUBLIC_GIPHY_KEY
// (.env.local en local, variable d'environnement EAS pour les builds). Sans clé, le bouton GIF est caché.
//
// Un GIF est enregistré comme un commentaire normal, sous la forme « [GIF] https://media.giphy.com/media/<id>/giphy.gif » :
// aucune colonne en plus dans la base, et une ancienne version de l'app affiche au pire cette ligne de texte.

export const GIPHY_KEY = process.env.EXPO_PUBLIC_GIPHY_KEY || '';
export const gifsAvailable = () => GIPHY_KEY.length > 0;

export type Gif = { id: string; preview: string; width: number; height: number };

const PREFIX = '[GIF] ';
// On n'affiche que des GIF hébergés par GIPHY : pas d'image arbitraire glissée dans un commentaire.
const GIF_RE = /^\[GIF\] https:\/\/media\d?\.giphy\.com\/media\/([A-Za-z0-9]+)\/giphy\.gif$/;

/** Texte enregistré pour un GIF. */
export const gifContent = (id: string) => `${PREFIX}https://media.giphy.com/media/${id}/giphy.gif`;

/** L'identifiant du GIF si le commentaire en est un, sinon null. */
export function gifIdOf(content?: string | null): string | null {
  const m = content ? GIF_RE.exec(content.trim()) : null;
  return m ? m[1] : null;
}

/** Version 200 px de large (légère) d'un GIF, pour l'afficher dans l'app. */
export const gifUrl = (id: string) => `https://media.giphy.com/media/${id}/200w.gif`;



async function call(path: string, params: Record<string, string>): Promise<Gif[]> {
  if (!GIPHY_KEY) return [];
  const qs = new URLSearchParams({ api_key: GIPHY_KEY, limit: '24', rating: 'pg-13', bundle: 'messaging_non_clips', ...params });
  const res = await fetch(`https://api.giphy.com/v1/gifs/${path}?${qs.toString()}`);
  if (!res.ok) throw new Error(String(res.status));
  const json = await res.json();
  return (json.data || []).map((g: any) => {
    const img = g.images?.fixed_width || {};
    return { id: g.id, preview: img.url, width: Number(img.width) || 200, height: Number(img.height) || 200 };
  }).filter((g: Gif) => !!g.id && !!g.preview);
}

export const trendingGifs = () => call('trending', {});
export const searchGifs = (q: string) => call('search', { q, lang: 'fr' });

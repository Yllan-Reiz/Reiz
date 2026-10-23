import { I18nManager, NativeModules, Platform, Settings, DevSettings } from 'react-native';
import { fr, type Dict } from './fr';
import { en } from './en';
import { es } from './es';
import { he } from './he';

// Langues de Reiz. Le texte de l'app vit dans fr.ts (la référence), et en.ts, es.ts, he.ts en sont la
// traduction clé pour clé (TypeScript refuse une clé manquante).
//
// La langue est choisie au lancement : celle réglée dans Reiz (Réglages > Langue), sinon celle du
// téléphone si Reiz la parle, sinon l'anglais. Changer de langue relance l'app : rien n'a besoin de se
// redessiner à chaud, et l'hébreu (de droite à gauche) ne s'applique de toute façon qu'au lancement.

export type Lang = 'fr' | 'en' | 'es' | 'he';
export const LANGS: { code: Lang; name: string }[] = [
  { code: 'fr', name: 'Français' },
  { code: 'en', name: 'English' },
  { code: 'es', name: 'Español' },
  { code: 'he', name: 'עברית' },
];
const DICTS: Record<Lang, Dict> = { fr, en, es, he };
const LOCALES: Record<Lang, string> = { fr: 'fr-FR', en: 'en-US', es: 'es-ES', he: 'he-IL' };
const PICKED_KEY = 'reiz.lang';

function asLang(code?: string | null): Lang | null {
  const c = (code || '').slice(0, 2).toLowerCase();
  if (c === 'iw') return 'he';
  return c in DICTS ? (c as Lang) : null;
}

// Langues du téléphone, la préférée d'abord (iOS : celle réglée pour Reiz dans Réglages > Reiz > Langue).
function deviceLangs(): string[] {
  try {
    if (Platform.OS === 'ios') {
      const s = NativeModules.SettingsManager?.settings || {};
      return [...(s.AppleLanguages || []), s.AppleLocale].filter(Boolean);
    }
    return [NativeModules.I18nManager?.localeIdentifier].filter(Boolean);
  } catch {
    return [];
  }
}

function pickedLang(): Lang | null {
  try {
    return Platform.OS === 'ios' ? asLang(Settings.get(PICKED_KEY)) : null;
  } catch {
    return null;
  }
}

export function deviceLang(): Lang {
  for (const l of deviceLangs()) {
    const hit = asLang(l);
    if (hit) return hit;
  }
  return 'en';
}

let current: Lang = pickedLang() || deviceLang();
let dict: Dict = DICTS[current];

export const lang = () => current;
export const locale = () => LOCALES[current];
export const isRTL = () => current === 'he';
// Langue choisie à la main dans Reiz (null : celle du téléphone).
export const chosenLang = () => pickedLang();

type Plural = { one: string; other: string };
type Leaves<T, P extends string = ''> = {
  [K in keyof T & string]: T[K] extends string ? `${P}${K}` : T[K] extends Plural ? never : T[K] extends readonly any[] ? never : Leaves<T[K], `${P}${K}.`>;
}[keyof T & string];
type Plurals<T, P extends string = ''> = {
  [K in keyof T & string]: T[K] extends Plural ? `${P}${K}` : T[K] extends string | readonly any[] ? never : Plurals<T[K], `${P}${K}.`>;
}[keyof T & string];
type Lists<T, P extends string = ''> = {
  [K in keyof T & string]: T[K] extends readonly string[] ? `${P}${K}` : T[K] extends string | Plural ? never : Lists<T[K], `${P}${K}.`>;
}[keyof T & string];
export type TKey = Leaves<Dict>;
export type TPluralKey = Plurals<Dict>;
export type TListKey = Lists<Dict>;
type Params = Record<string, string | number | null | undefined>;

function lookup(d: any, key: string): any {
  let v = d;
  for (const part of key.split('.')) v = v?.[part];
  return v;
}

function fill(s: string, params?: Params) {
  if (!params) return s;
  return s.replace(/\{(\w+)\}/g, (m, k) => (params[k] == null ? m : String(params[k])));
}

// Texte d'une clé : t('feed.empty'), t('post.taggedBy', { name: 'Théo' }) pour « {name} t'a identifié ».
export function t(key: TKey, params?: Params): string {
  const v = lookup(dict, key) ?? lookup(fr, key);
  return typeof v === 'string' ? fill(v, params) : key;
}

// Texte qui dépend d'un nombre : tp('feed.likes', 3) prend « other », tp('feed.likes', 1) prend « one ».
// {count} est remplacé par le nombre.
export function tp(key: TPluralKey, count: number, params?: Params): string {
  const v: Plural | undefined = lookup(dict, key) ?? lookup(fr, key);
  if (!v) return key;
  let rule = 'other';
  try { rule = new Intl.PluralRules(LOCALES[current]).select(count); } catch { rule = count === 1 ? 'one' : 'other'; }
  // Le français dit « 0 séance » (singulier), l'anglais « 0 sessions » : Intl le sait.
  return fill(rule === 'one' ? v.one : v.other, { count, ...params });
}

// Liste de textes (jours de la semaine, étapes) : tl('common.daysShort').
export function tl(key: TListKey): string[] {
  const v = lookup(dict, key) ?? lookup(fr, key);
  return Array.isArray(v) ? v : [];
}

// Unités enregistrées en base en français (« séances », « fois », « pas ») : on les affiche dans la langue.
export function unitLabel(unit?: string | null): string {
  if (!unit) return '';
  const u = (dict.units as Record<string, string>)[unit];
  return u ?? unit;
}

// Applique l'écriture de droite à gauche (hébreu) ou de gauche à droite. Renvoie true si l'app doit se
// relancer pour que ça prenne effet (React Native ne bascule le sens qu'au démarrage).
export function syncDirection(): boolean {
  const rtl = isRTL();
  try {
    I18nManager.allowRTL(rtl);
    I18nManager.forceRTL(rtl);
  } catch {}
  if (I18nManager.isRTL === rtl) return false;
  // Une seule relance par lancement : si le sens refuse de basculer, on ne boucle pas.
  try {
    const last = Number(Settings.get('reiz.rtlReloadAt') || 0);
    if (Date.now() - last < 15000) return false;
    Settings.set({ 'reiz.rtlReloadAt': Date.now() });
  } catch {
    return false;
  }
  return true;
}

export async function reloadApp() {
  try {
    const Updates = require('expo-updates');
    await Updates.reloadAsync();
  } catch {
    DevSettings.reload();
  }
}

// Choix fait dans Réglages > Langue (null : suivre le téléphone). Relance l'app.
export async function setLanguage(next: Lang | null) {
  if (Platform.OS === 'ios') {
    // AppleLanguages fait aussi parler iOS dans la langue choisie (demandes d'autorisation) au prochain lancement.
    Settings.set({ [PICKED_KEY]: next, AppleLanguages: next ? [next] : null });
  }
  current = next || deviceLang();
  dict = DICTS[current];
  syncDirection();
  await reloadApp();
}

// Dates et nombres dans la langue de l'app.
export function formatDate(d: Date | string | number, opts: Intl.DateTimeFormatOptions) {
  try { return new Date(d).toLocaleDateString(LOCALES[current], opts); } catch { return new Date(d).toDateString(); }
}
export function formatTime(d: Date | string | number) {
  try { return new Date(d).toLocaleTimeString(LOCALES[current], { hour: '2-digit', minute: '2-digit' }); } catch { return ''; }
}
export function formatNumber(n: number, opts?: Intl.NumberFormatOptions) {
  try { return n.toLocaleString(LOCALES[current], opts); } catch { return String(n); }
}

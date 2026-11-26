import { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, Alert } from 'react-native';
import { requireOptionalNativeModule } from 'expo';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { supabase } from '../lib/supabase';
import { signAvatars } from '../lib/storage';
import { timeAgo, frError } from '../lib/helpers';
import { track } from '../lib/track';
import { s, F } from '../styles';
import { t } from '../i18n';
import { CachedImage } from './CachedImage';
import { makeBlurhash } from '../lib/blurhash';

// Fil de découverte (26/11/2026, idée de Yllan) : un nouveau venu n'arrive plus sur un fil vide. Sous son fil, la
// dernière séance de chaque membre, floutée ; pour la voir, il ajoute la personne en ami.
// Le serveur (discover_feed, phase 39) ne renvoie qu'une empreinte floue de la séance, jamais la photo ni la vidéo :
// le flou n'est pas un voile posé sur l'image, il n'y a pas d'image dessous.
// Phase 40 (même jour) : une séance sans empreinte (postée avant la 1.8, ou vidéo pas encore traitée) apparaît quand
// même, sur l'empreinte de sa photo de profil (déjà visible de tous les membres), ou sur un flou neutre sans photo de
// profil. Les amis de mes amis passent en premier, avec « En commun : Ilan ». Au-delà de DISCOVER_MAX_FRIENDS amis,
// seuls eux restent (onlyMutual), quatre au plus.

type Row = {
  id: string; user_id: string; full_name: string; username: string; avatar_url: string | null;
  created_at: string; blurhash: string | null; is_video: boolean; request_sent: boolean;
  mutual_count?: number; mutual_name?: string | null;
};

// Flous neutres pour qui n'a ni empreinte ni photo de profil : des tons de salle, tirés de vraies séances, sans rien
// de reconnaissable. Le même pour une personne donnée (choisi d'après son identifiant).
const NEUTRAL = ['LBEL:0xb%LogpK%MR-of~q%NWExt', 'L9Ef7+-p-o-:E.S5IoWX~qtRWBof', 'L8EyD2IU-ot70oM{Rka#_4E1xuR*'];
const neutralFor = (id: string) => NEUTRAL[id.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % NEUTRAL.length];

// Sans empreinte de séance : l'empreinte de sa photo de profil (calculée ici, gardée en mémoire), sinon un flou neutre.
// Le 26/11/2026, un simple flou de la photo de profil laissait reconnaître le visage (un lama, en l'occurrence) :
// l'empreinte, elle, ne garde que quelques couleurs.
const avatarHashes = new Map<string, string | null>();
function backdropHash(r: Row, avatarHash: string | null | undefined): string {
  return r.blurhash ?? avatarHash ?? neutralFor(r.user_id);
}

let ExpoImage: any | null | undefined;
function expoImage(): any | null {
  if (ExpoImage !== undefined) return ExpoImage;
  try { ExpoImage = requireOptionalNativeModule('ExpoImage') ? require('expo-image').Image : null; } catch { ExpoImage = null; }
  return ExpoImage;
}

const firstName = (r: Row) => (r.full_name || r.username || '').trim().split(' ')[0] || r.username;

export function DiscoverFeed({ userId, reloadKey, onOpenProfile, bottomPad, onlyMutual = false }: { userId: string; reloadKey: number; onOpenProfile: (id: string) => void; bottomPad: number; onlyMutual?: boolean }) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [sent, setSent] = useState<Set<string>>(new Set());
  const [, setHashTick] = useState(0);
  const seen = useRef(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data, error } = await supabase.rpc('discover_feed', onlyMutual ? { p_limit: 4, p_only_mutual: true } : { p_limit: 20 });
      // Fonction absente (base pas encore à jour) ou réseau : pas de section, rien d'autre ne change.
      if (!alive || error || !data) return;
      const list = data as Row[];
      const avatars = await signAvatars(list.map(r => r.avatar_url));
      list.forEach(r => { if (r.avatar_url) r.avatar_url = avatars[r.avatar_url] ?? null; });
      if (!alive) return;
      setRows(list);
      // Empreintes des photos de profil, pour les séances qui n'en ont pas encore : une par une, sans bloquer l'affichage.
      (async () => {
        for (const r of list) {
          if (r.blurhash || !r.avatar_url || avatarHashes.has(r.user_id)) continue;
          avatarHashes.set(r.user_id, await makeBlurhash(r.avatar_url, false));
          if (alive) setHashTick(n => n + 1);
        }
      })().catch(() => {});
      setSent(new Set(list.filter(r => r.request_sent).map(r => r.user_id)));
      if (!seen.current && list.length > 0) {
        seen.current = true;
        track('discover_view', { n: list.length, mutual: list.filter(r => (r.mutual_count ?? 0) > 0).length, onlyMutual }, 'feed');
      }
    })().catch(() => {});
    return () => { alive = false; };
  }, [userId, reloadKey, onlyMutual]);

  const add = async (r: Row) => {
    if (sent.has(r.user_id)) return;
    setSent(prev => new Set(prev).add(r.user_id));
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    const { error } = await supabase.from('friendships').insert({ requester_id: userId, receiver_id: r.user_id, status: 'pending' });
    // 23505 : une demande existe déjà entre vous deux, le bouton « Demande envoyée » dit vrai.
    if (error && error.code !== '23505') {
      setSent(prev => { const n = new Set(prev); n.delete(r.user_id); return n; });
      Alert.alert(t('common.error'), frError(error));
      return;
    }
    track('discover_add', { video: r.is_video, mutual: (r.mutual_count ?? 0) > 0 }, 'feed');
  };

  if (!rows || rows.length === 0) return null;
  const Img = expoImage();

  return (
    // Le bas de la liste a déjà la place de la barre d'onglets ; la section la redonne sous sa dernière carte.
    <View style={{ paddingTop: 28, paddingBottom: bottomPad }}>
      <View style={{ paddingHorizontal: 2, marginBottom: 22 }}>
        <Text style={{ color: '#fff', fontSize: 24, lineHeight: 29, fontFamily: F.black, letterSpacing: -0.6 }} maxFontSizeMultiplier={1.3}>{t(onlyMutual ? 'discover.mutualTitle' : 'discover.title')}</Text>
        <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 15, lineHeight: 21, fontFamily: F.regular, marginTop: 6 }} numberOfLines={3}>{t(onlyMutual ? 'discover.mutualSub' : 'discover.sub')}</Text>
      </View>
      {rows.map(r => {
        const name = firstName(r);
        const isSent = sent.has(r.user_id);
        const mutualName = (r.mutual_count ?? 0) > 0 ? r.mutual_name : null;
        const common = !mutualName ? null : (r.mutual_count ?? 0) > 1
          ? t('discover.commonMany', { mutual: mutualName, n: (r.mutual_count ?? 1) - 1 })
          : t('discover.common', { mutual: mutualName });
        return (
          <View key={r.id} style={s.feedCard}>
            <View style={s.brHeader}>
              <TouchableOpacity onPress={() => onOpenProfile(r.user_id)} activeOpacity={0.7} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }} accessibilityLabel={t('feed.profileOf', { name })}>
                {r.avatar_url
                  ? <CachedImage uri={r.avatar_url} style={s.avImg} />
                  : <View style={s.av}><Text style={s.avText}>{name.charAt(0).toUpperCase()}</Text></View>}
              </TouchableOpacity>
              <View style={s.cardMeta}>
                <Text style={s.cardName} onPress={() => onOpenProfile(r.user_id)} suppressHighlighting numberOfLines={1}>{r.full_name || r.username}</Text>
                <Text style={s.brSub} numberOfLines={1}>{t(r.is_video ? 'discover.postedVideo' : 'discover.posted')}, {timeAgo(r.created_at, true)}</Text>
                {!!common && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 }}>
                    <Ionicons name="people" size={13} color="#fff" />
                    <Text style={{ color: '#fff', fontSize: 12.5, fontFamily: F.semibold }} numberOfLines={1}>{common}</Text>
                  </View>
                )}
              </View>
            </View>
            <View style={s.feedPhotoWrap}>
              {Img
                ? <Img source={{ blurhash: backdropHash(r, avatarHashes.get(r.user_id)), width: 24, height: 36 }} contentFit="cover" transition={0} style={s.feedPhoto} accessible={false} />
                : <View style={[s.feedPhoto, { backgroundColor: '#1c1c1c' }]} />}
              <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, backgroundColor: 'rgba(10,10,10,0.28)' }}>
                <Ionicons name={isSent ? 'time-outline' : 'eye-off-outline'} size={30} color="#fff" />
                <Text style={{ color: '#fff', fontSize: 22, lineHeight: 27, fontFamily: F.black, letterSpacing: -0.5, textAlign: 'center', marginTop: 14 }} maxFontSizeMultiplier={1.3}>
                  {t(isSent ? 'discover.sentTitle' : 'discover.lockTitle', { name })}
                </Text>
                <Text style={{ color: 'rgba(255,255,255,0.75)', fontSize: 14.5, lineHeight: 21, fontFamily: F.regular, textAlign: 'center', marginTop: 8 }}>
                  {t(isSent ? 'discover.sentText' : mutualName ? 'discover.lockTextMutual' : 'discover.lockText', { name, mutual: mutualName ?? '' })}
                </Text>
                {isSent ? (
                  <View style={{ height: 48, borderRadius: 24, paddingHorizontal: 22, marginTop: 18, backgroundColor: 'rgba(255,255,255,0.14)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.28)', alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ color: '#fff', fontSize: 15, fontFamily: F.bold }} maxFontSizeMultiplier={1.3}>{t('discover.sent')}</Text>
                  </View>
                ) : (
                  <TouchableOpacity onPress={() => add(r)} activeOpacity={0.85} accessibilityRole="button" accessibilityLabel={t('discover.add', { name })}
                    style={{ height: 48, borderRadius: 24, paddingHorizontal: 22, marginTop: 18, backgroundColor: '#fff', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                    <Ionicons name="person-add" size={17} color="#000" />
                    <Text style={{ color: '#000', fontSize: 15, fontFamily: F.extrabold }} maxFontSizeMultiplier={1.3}>{t('discover.add', { name })}</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </View>
        );
      })}
    </View>
  );
}

import { useRef, useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Modal, Image, ActivityIndicator, Alert, Share, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Sharing from 'expo-sharing';
import * as Haptics from 'expo-haptics';
import ViewShot, { captureRef } from 'react-native-view-shot';
import { useVideoPlayer, VideoView } from 'expo-video';
import { videoStoryAvailable, composeVideoStory } from '../../modules/reiz-video-story';
import { APP_STORE_URL } from '../constants';
import { isVideo } from '../lib/storage';
import { videoStill } from '../lib/videoTools';
import { F } from '../styles';

export type StoryData = {
  photoUri?: string | null;   // image ou vidéo (vidéo : story vidéo avec le build 13, sinon son image ; sans rien : fond sombre)
  emoji?: string;
  title: string;
  progressLabel: string;      // « 150 / 170 kg »
  pct: number;                // 0-100
  caption?: string;
  username?: string;
  streak?: number;
  duoNames?: string;                // « Eden » ou « Eden et Logan » : séance en duo
  partnerPhotoUri?: string | null;  // photo de l'autre : les deux séances côte à côte
};

// Visuel 9:16 aux couleurs de Reiz, prêt à poster en story Instagram. Le but : que ceux qui
// voient la story découvrent l'appli. On capture la carte en PNG puis on ouvre la feuille de
// partage iOS (Instagram, puis « Story »). Reiz ne publie jamais rien à la place de l'utilisateur.
// Séance en vidéo (build 13 et plus) : on capture seulement l'habillage, transparent, et le module
// natif reiz-video-story le pose sur la vidéo. La story part en MP4, la vidéo bouge, le son est gardé.
//
// Une image n'est jamais cliquable, et Instagram ne laisse pas une app ajouter un lien toute seule
// (l'API de partage en story n'accepte que des images et des couleurs). Le seul élément cliquable
// est le sticker « Lien » d'Instagram, que la personne ajoute elle-même : la carte lui laisse donc
// la place en bas, et l'écran lui donne son lien d'invitation à coller dedans.
export function ShareStoryModal({ visible, data, onClose }: { visible: boolean; data: StoryData | null; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const ref = useRef<ViewShot>(null);
  const [loaded, setLoaded] = useState(0);
  const [busy, setBusy] = useState(false);

  // Vidéo seule (pas de duo côte à côte) et module présent : vraie story vidéo.
  const videoSrc = visible && !!data?.photoUri && isVideo(data.photoUri) && !data.partnerPhotoUri && videoStoryAvailable() ? data.photoUri : null;
  // Sinon, une vidéo devient son image du début (build 1.0.1 et plus) : la story ne part plus sur un fond gris.
  const main = useStill(visible && !videoSrc ? data?.photoUri : null);
  const partner = useStill(visible ? data?.partnerPhotoUri : null);

  // On ne capture qu'une fois toutes les photos affichées (une ou deux en duo) :
  // sinon la carte partirait avec une moitié vide.
  const need = main ? (partner ? 2 : 1) : 0;
  useEffect(() => { if (visible) setLoaded(0); }, [visible, main, partner]);
  const ready = main !== undefined && partner !== undefined && loaded >= need;
  if (!data) return null;

  // La carte garde toujours le ratio 9:16 et tient dans l'écran, boutons compris.
  const maxH = height - insets.top - insets.bottom - 270;
  const cardW = Math.min(width - 48, maxH * 9 / 16);
  const cardH = cardW * 16 / 9;
  const k = cardW / 360; // tout est dessiné pour 360 de large, puis mis à l'échelle

  const share = async () => {
    if (busy) return;
    setBusy(true);
    try {
      if (videoSrc) {
        // L'habillage seul, en PNG transparent. Le module télécharge lui-même une vidéo du fil.
        const overlay = await captureRef(ref, { format: 'png', quality: 1, width: 1080, height: 1920, result: 'tmpfile' });
        const mp4 = await composeVideoStory(videoSrc, overlay);
        if (!(await Sharing.isAvailableAsync())) { Alert.alert('Partage indisponible', "Ton téléphone ne permet pas de partager cette vidéo."); return; }
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        await Sharing.shareAsync(mp4, { mimeType: 'video/mp4', UTI: 'public.mpeg-4', dialogTitle: 'Partager en story' });
        return;
      }
      const uri = await captureRef(ref, { format: 'png', quality: 1, width: 1080, height: 1920, result: 'tmpfile' });
      if (!(await Sharing.isAvailableAsync())) { Alert.alert('Partage indisponible', "Ton téléphone ne permet pas de partager ce visuel."); return; }
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      await Sharing.shareAsync(uri, { mimeType: 'image/png', UTI: 'public.png', dialogTitle: 'Partager en story' });
    } catch (e) {
      Alert.alert('Erreur', __DEV__ ? String((e as any)?.message || e) : "Impossible de créer le visuel. Réessaie.");
    } finally {
      setBusy(false);
    }
  };

  const pct = Math.max(0, Math.min(100, data.pct || 0));
  // Le lien à coller dans le sticker : la fiche Reiz sur l'App Store.
  const link = APP_STORE_URL;
  const shortLink = link.replace(/^https?:\/\//, '');
  // La feuille de partage iOS propose « Copier » : seule façon de copier sans module natif en plus.
  const copyLink = () => { Share.share({ message: link }).catch(() => {}); };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: '#050505', paddingTop: insets.top, paddingBottom: insets.bottom + 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, height: 48 }}>
          <TouchableOpacity onPress={onClose} style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }} accessibilityLabel="Fermer" hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="close" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={{ flex: 1, textAlign: 'center', color: '#fff', fontSize: 16, fontFamily: F.bold }}>Partager en story</Text>
          <View style={{ width: 40 }} />
        </View>

        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <View style={{ width: cardW, height: cardH, borderRadius: 22 * k, overflow: 'hidden', backgroundColor: '#0a0a0a' }}>
          {/* Vidéo : elle tourne derrière l'habillage, qui seul est capturé (fond transparent). */}
          {!!videoSrc && <StoryVideo uri={videoSrc} style={{ position: 'absolute', width: cardW, height: cardH }} />}
          <ViewShot ref={ref} style={{ position: 'absolute', width: cardW, height: cardH, backgroundColor: videoSrc ? 'transparent' : '#0a0a0a' }}>
            {videoSrc ? null : main && partner ? (
              // Duo validé : les deux séances côte à côte, séparées par un filet blanc.
              <View style={{ position: 'absolute', width: cardW, height: cardH, flexDirection: 'row' }}>
                <Image source={{ uri: main }} style={{ width: cardW / 2, height: cardH }} resizeMode="cover" onLoadEnd={() => setLoaded(n => n + 1)} />
                <View style={{ width: 2 * k, backgroundColor: '#fff' }} />
                <Image source={{ uri: partner }} style={{ flex: 1, height: cardH }} resizeMode="cover" onLoadEnd={() => setLoaded(n => n + 1)} />
              </View>
            ) : main
              ? <Image source={{ uri: main }} style={{ position: 'absolute', width: cardW, height: cardH }} resizeMode="cover" onLoadEnd={() => setLoaded(n => n + 1)} />
              : <LinearGradient colors={['#1b1b1b', '#0a0a0a']} style={{ position: 'absolute', width: cardW, height: cardH }} />}
            <LinearGradient colors={['rgba(0,0,0,0.55)', 'rgba(0,0,0,0.05)', 'rgba(0,0,0,0.25)', 'rgba(0,0,0,0.9)']} locations={[0, 0.3, 0.55, 1]} style={{ position: 'absolute', width: cardW, height: cardH }} />

            <View style={{ position: 'absolute', top: 34 * k, left: 0, right: 0, alignItems: 'center' }}>
              <Image source={require('../../assets/ecriture-reiz-blanc.png')} style={{ width: 150 * k, height: 52 * k }} resizeMode="contain" />
              <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 9 * k, letterSpacing: 3 * k, fontFamily: F.semibold, marginTop: -2 * k }}>RISE TO YOUR GOALS</Text>
              {!!data.duoNames && (
                <View style={{ marginTop: 14 * k, backgroundColor: 'rgba(15,15,15,0.72)', borderRadius: 16 * k, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 14 * k, paddingVertical: 7 * k }}>
                  <Text style={{ color: '#fff', fontSize: 13 * k, fontFamily: F.extrabold }}>🤝 Duo avec {data.duoNames}</Text>
                </View>
              )}
            </View>

            <View style={{ position: 'absolute', left: 22 * k, right: 22 * k, bottom: 40 * k }}>
              <View style={{ backgroundColor: 'rgba(15,15,15,0.72)', borderRadius: 24 * k, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', padding: 18 * k }}>
                <Text style={{ color: '#fff', fontSize: 14 * k, fontFamily: F.semibold }} numberOfLines={2}>{data.emoji ? `${data.emoji} ` : ''}{data.title}</Text>
                <Text style={{ color: '#fff', fontSize: 34 * k, fontFamily: F.black, letterSpacing: -1 * k, marginTop: 6 * k }} numberOfLines={1} adjustsFontSizeToFit>{data.progressLabel}</Text>
                <View style={{ height: 8 * k, borderRadius: 4 * k, backgroundColor: 'rgba(255,255,255,0.18)', marginTop: 10 * k, overflow: 'hidden' }}>
                  <View style={{ width: `${pct}%`, height: '100%', backgroundColor: '#fff', borderRadius: 4 * k }} />
                </View>
                {!!data.caption && data.caption !== data.title && (
                  <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 13 * k, fontFamily: F.regular, lineHeight: 19 * k, marginTop: 12 * k }} numberOfLines={3}>{data.caption}</Text>
                )}
                {!!data.streak && data.streak > 1 && (
                  <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12 * k, fontFamily: F.semibold, marginTop: 10 * k }}>🔥 {data.streak} jours d'affilée</Text>
                )}
              </View>

              {/* Pas de faux bouton : un texte, et la place du sticker « Lien » que la personne ajoute dans Instagram. */}
              <Text style={{ color: '#fff', fontSize: 16 * k, fontFamily: F.extrabold, textAlign: 'center', marginTop: 16 * k }}>{data.duoNames ? 'Rejoins-nous sur Reiz' : data.username ? `Rejoins @${data.username} sur Reiz` : 'Rejoins mon cercle sur Reiz'}</Text>
              <Text style={{ color: 'rgba(255,255,255,0.65)', fontSize: 11 * k, fontFamily: F.regular, textAlign: 'center', marginTop: 4 * k }}>Ton cercle te regarde. Disponible sur iPhone.</Text>
              <View style={{ height: 66 * k }} />
            </View>
          </ViewShot>
          </View>
        </View>

        <View style={{ paddingHorizontal: 24 }}>
          <TouchableOpacity onPress={share} activeOpacity={0.85} disabled={!ready || busy}
            style={{ backgroundColor: ready ? '#fff' : '#1e1e1e', borderRadius: 16, padding: 15, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8 }}>
            {busy && videoSrc
              ? <><ActivityIndicator color="#000" /><Text style={{ color: '#000', fontSize: 15, fontFamily: F.extrabold }}>Création de la vidéo…</Text></>
              : busy || !ready
                ? <ActivityIndicator color={ready ? '#000' : '#888'} />
                : <><Ionicons name="logo-instagram" size={18} color="#000" /><Text style={{ color: '#000', fontSize: 15, fontFamily: F.extrabold }}>{videoSrc ? 'Partager la vidéo' : 'Partager'}</Text></>}
          </TouchableOpacity>

          {/* Le lien à coller dans le sticker « Lien » d'Instagram : c'est lui qui rend la story cliquable. */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12, backgroundColor: '#141414', borderRadius: 14, borderWidth: 1, borderColor: '#262626', paddingLeft: 14, paddingRight: 6, paddingVertical: 6 }}>
            <Ionicons name="link" size={16} color="#888" />
            <Text style={{ flex: 1, color: '#bbb', fontSize: 12, fontFamily: F.semibold }} numberOfLines={1}>{shortLink}</Text>
            <TouchableOpacity onPress={copyLink} activeOpacity={0.8} style={{ backgroundColor: '#262626', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 }} accessibilityLabel="Copier mon lien d'invitation">
              <Text style={{ color: '#fff', fontSize: 13, fontFamily: F.bold }}>Copier</Text>
            </TouchableOpacity>
          </View>
          <Text style={{ color: '#777', fontSize: 12, fontFamily: F.regular, textAlign: 'center', lineHeight: 17, marginTop: 10 }}>
            Pour que ta story soit cliquable : copie ton lien, partage en story, puis ajoute le sticker « Lien » d'Instagram, colle-le et pose-le en bas.
          </Text>
        </View>
      </View>
    </Modal>
  );
}

// L'aperçu de la story vidéo : en boucle et sans le son (le son est gardé dans la story).
function StoryVideo({ uri, style }: { uri: string; style: any }) {
  const player = useVideoPlayer(uri, p => { p.loop = true; p.muted = true; p.play(); });
  return <VideoView player={player} style={style} contentFit="cover" nativeControls={false} />;
}

// Image à afficher pour un média : la photo telle quelle, ou l'image tirée d'une vidéo.
// undefined = en cours (la carte attend), null = rien à montrer (fond dégradé).
function useStill(uri?: string | null): string | null | undefined {
  const [still, setStill] = useState<string | null | undefined>(uri && isVideo(uri) ? undefined : uri || null);
  useEffect(() => {
    if (!uri || !isVideo(uri)) { setStill(uri || null); return; }
    let alive = true;
    setStill(undefined);
    videoStill(uri).then(img => { if (alive) setStill(img); });
    return () => { alive = false; };
  }, [uri]);
  return still;
}

import { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, Modal, Image, ScrollView, ActivityIndicator, Alert, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as Sharing from 'expo-sharing';
import ViewShot, { captureRef } from 'react-native-view-shot';
import { useVideoPlayer, VideoView } from 'expo-video';
import { journeyVideoAvailable, composeJourneyVideo, JourneySegment } from '../../modules/reiz-video-story';
import { loadJourney, pickSteps, Journey, JourneyStep } from '../lib/journey';
import { galleryAvailable, saveToGallery } from '../lib/saveToGallery';
import { track } from '../lib/track';
import { F } from '../styles';
import { t, tp } from '../i18n';

// « Ton parcours » (1.2, 30/10/2026) : toutes les étapes d'un objectif, du premier post à la victoire.
//   Image  une carte récap 9:16 (première et dernière photo en grand, les étapes entre les deux)
//   Vidéo  un film 9:16 : chaque photo un peu plus d'une seconde, chaque vidéo ses 2 premières secondes,
//          le jour et la progression par-dessus, la carte récap à la fin (module natif, builds 1.2 et plus)
// L'auteur partage (Instagram, WhatsApp... par la feuille de partage d'iPhone) ou enregistre dans sa galerie.
// Un ami ne fait que regarder : on ne repartage pas les photos de quelqu'un d'autre.
// Instagram ne laisse pas une app poser un lien : la carte garde la place du sticker « Lien » en bas.

const W = 360;          // tout est dessiné pour 360 x 640, puis mis à l'échelle (capture en 1080 x 1920)
const H = 640;
const IMAGE_SECONDS = 1.2;
const VIDEO_SECONDS = 2;
const OUTRO_SECONDS = 2.5;

export function JourneyModal({ objectiveId, own, ownerName, from, onClose }: {
  objectiveId: string | null;
  own: boolean;
  ownerName?: string;
  /** Pour le back-office : victoire, fil, profil. */
  from: string;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const [journey, setJourney] = useState<Journey | null | undefined>(undefined);
  const [mode, setMode] = useState<'image' | 'video'>('image');
  const [videoUri, setVideoUri] = useState<string | null>(null);
  const [making, setMaking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [overlayStep, setOverlayStep] = useState<JourneyStep | null>(null);
  const cardRef = useRef<ViewShot>(null);
  const overlayRef = useRef<ViewShot>(null);

  useEffect(() => {
    if (!objectiveId) return;
    let alive = true;
    setJourney(undefined); setMode('image'); setVideoUri(null); setMaking(false);
    track('journey_open', { from, own }, 'journey');
    loadJourney(objectiveId).then(j => { if (alive) setJourney(j); }, () => { if (alive) setJourney(null); });
    return () => { alive = false; };
  }, [objectiveId, from, own]);

  if (!objectiveId) return null;

  const canVideo = own && journeyVideoAvailable() && !!journey && journey.steps.some(s => s.media);
  // La carte tient dans l'écran avec les boutons et la bande des étapes.
  const maxH = height - insets.top - insets.bottom - (own ? 410 : 230);
  const cardW = Math.min(width - 48, (maxH * 9) / 16);
  const cardH = (cardW * 16) / 9;

  const capture = (ref: React.RefObject<ViewShot | null>) =>
    captureRef(ref, { format: 'png', quality: 1, width: 1080, height: 1920, result: 'tmpfile' });
  const nextFrame = () => new Promise<void>(r => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(r, 30))));

  // Le film : l'habillage de chaque étape est capturé à tour de rôle (vue cachée hors écran), puis le module
  // natif assemble les médias et les habillages. La carte récap ferme le film.
  const makeVideo = async () => {
    if (!journey || making) return;
    setMaking(true);
    try {
      const picked = pickSteps(journey.steps);
      const segments: JourneySegment[] = [];
      for (const step of picked) {
        setOverlayStep(step);
        await nextFrame();
        const overlay = await capture(overlayRef);
        segments.push({ uri: step.media!, type: step.video ? 'video' : 'image', seconds: step.video ? VIDEO_SECONDS : IMAGE_SECONDS, overlay });
      }
      setOverlayStep(null);
      segments.push({ uri: await capture(cardRef), type: 'image', seconds: OUTRO_SECONDS });
      const uri = await composeJourneyVideo(segments);
      setVideoUri(uri);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      track('journey_video', { steps: picked.length }, 'journey');
    } catch (e) {
      Alert.alert(t('common.error'), __DEV__ ? String((e as any)?.message || e) : t('journey.videoFailed'));
    } finally {
      setOverlayStep(null);
      setMaking(false);
    }
  };

  const fileForMode = async () => (mode === 'video' ? videoUri : await capture(cardRef));

  const share = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const uri = await fileForMode();
      if (!uri) return;
      if (!(await Sharing.isAvailableAsync())) { Alert.alert(t('story.unavailableTitle'), t('story.unavailableImage')); return; }
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      track('journey_share', { kind: mode }, 'journey');
      await Sharing.shareAsync(uri, mode === 'video'
        ? { mimeType: 'video/mp4', UTI: 'public.mpeg-4', dialogTitle: t('journey.share') }
        : { mimeType: 'image/png', UTI: 'public.png', dialogTitle: t('journey.share') });
    } catch (e) {
      Alert.alert(t('common.error'), __DEV__ ? String((e as any)?.message || e) : t('story.failed'));
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const uri = await fileForMode();
      if (!uri) return;
      const res = await saveToGallery(uri);
      if (res === 'saved') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        track('journey_save', { kind: mode }, 'journey');
        Alert.alert(t('journey.saved'));
      } else {
        Alert.alert(t('common.error'), res === 'denied' ? t('journey.denied') : t('story.failed'));
      }
    } finally {
      setBusy(false);
    }
  };

  const k = cardW / W;
  const steps = journey?.steps ?? [];

  return (
    <Modal visible animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: '#050505', paddingTop: insets.top, paddingBottom: insets.bottom + 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, height: 48 }}>
          <TouchableOpacity onPress={onClose} hitSlop={12} accessibilityLabel={t('common.close')} style={{ width: 40 }}>
            <Ionicons name="close" size={26} color="#fff" />
          </TouchableOpacity>
          <Text numberOfLines={1} style={{ flex: 1, textAlign: 'center', color: '#fff', fontSize: 17, fontFamily: F.bold }}>
            {own || !ownerName ? t('journey.title') : t('journey.titleOf', { name: ownerName.split(' ')[0] })}
          </Text>
          <View style={{ width: 40 }} />
        </View>

        {journey === undefined ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color="#fff" /></View>
        ) : !journey || steps.length === 0 ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}>
            <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 15, fontFamily: F.regular, textAlign: 'center' }}>{t('journey.empty')}</Text>
          </View>
        ) : (
          <>
            {canVideo && (
              <View style={{ flexDirection: 'row', alignSelf: 'center', backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 18, padding: 3, marginBottom: 10 }}>
                {(['image', 'video'] as const).map(m => (
                  <TouchableOpacity key={m} onPress={() => { Haptics.selectionAsync().catch(() => {}); setMode(m); }} accessibilityRole="button" accessibilityState={{ selected: mode === m }}
                    style={{ paddingHorizontal: 18, height: 32, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: mode === m ? '#fff' : 'transparent' }}>
                    <Text style={{ color: mode === m ? '#000' : 'rgba(255,255,255,0.7)', fontSize: 14, fontFamily: F.bold }}>{t(m === 'image' ? 'journey.image' : 'journey.video')}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            <View style={{ alignItems: 'center' }}>
              <View style={{ width: cardW, height: cardH, borderRadius: 18, overflow: 'hidden', backgroundColor: '#0a0a0a' }}>
                {/* La carte est toujours là (elle finit le film) ; en mode vidéo, le film se pose par-dessus. */}
                <ViewShot ref={cardRef} style={{ width: cardW, height: cardH }}>
                  <RecapCard journey={journey} k={k} />
                </ViewShot>
                {mode === 'video' && (
                  <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(5,5,5,0.72)', alignItems: 'center', justifyContent: 'center' }}>
                    {videoUri ? (
                      <JourneyVideo uri={videoUri} style={{ position: 'absolute', top: 0, left: 0, width: cardW, height: cardH }} />
                    ) : making ? (
                      <>
                        <ActivityIndicator color="#fff" />
                        <Text style={{ color: '#fff', fontSize: 15, fontFamily: F.semibold, marginTop: 12 }}>{t('journey.making')}</Text>
                      </>
                    ) : (
                      <TouchableOpacity onPress={makeVideo} activeOpacity={0.85} accessibilityRole="button"
                        style={{ backgroundColor: '#fff', borderRadius: 16, height: 48, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Ionicons name="film-outline" size={19} color="#000" />
                        <Text style={{ color: '#000', fontSize: 16, fontFamily: F.extrabold }}>{t('journey.makeVideo')}</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}
              </View>
            </View>

            {/* Toutes les étapes, dans l'ordre */}
            <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 10, fontFamily: F.bold, letterSpacing: 1.5, marginTop: 14, marginBottom: 8, paddingHorizontal: 20 }}>
              {tp('journey.steps', steps.length)}
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 20 }} style={{ flexGrow: 0 }}>
              {steps.map(s => (
                <View key={s.id} style={{ width: 54 }}>
                  <View style={{ width: 54, height: 68, borderRadius: 10, overflow: 'hidden', backgroundColor: '#1a1a1a', alignItems: 'center', justifyContent: 'center' }}>
                    {s.thumb ? <Image source={{ uri: s.thumb }} style={{ width: 54, height: 68 }} /> : <Ionicons name="checkmark" size={18} color="rgba(255,255,255,0.5)" />}
                    {s.video && <Ionicons name="play" size={14} color="#fff" style={{ position: 'absolute', right: 4, bottom: 4 }} />}
                  </View>
                  <Text numberOfLines={1} style={{ color: 'rgba(255,255,255,0.6)', fontSize: 10.5, fontFamily: F.semibold, marginTop: 4, textAlign: 'center' }}>{t('journey.dayShort', { n: s.day })}</Text>
                </View>
              ))}
            </ScrollView>

            <View style={{ flex: 1 }} />
            {own && (
              <View style={{ paddingHorizontal: 24, gap: 10 }}>
                <TouchableOpacity onPress={share} disabled={busy || (mode === 'video' && !videoUri)} activeOpacity={0.85} accessibilityRole="button"
                  style={{ backgroundColor: busy || (mode === 'video' && !videoUri) ? 'rgba(255,255,255,0.35)' : '#fff', borderRadius: 16, minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                  {busy ? <ActivityIndicator color="#000" /> : (
                    <>
                      <Ionicons name="share-outline" size={20} color="#000" />
                      <Text style={{ color: '#000', fontSize: 17, fontFamily: F.extrabold }}>{t('journey.share')}</Text>
                    </>
                  )}
                </TouchableOpacity>
                {galleryAvailable() && (
                  <TouchableOpacity onPress={save} disabled={busy || (mode === 'video' && !videoUri)} activeOpacity={0.8} accessibilityRole="button"
                    style={{ borderRadius: 16, minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: 'rgba(255,255,255,0.1)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', opacity: mode === 'video' && !videoUri ? 0.5 : 1 }}>
                    <Ionicons name="download-outline" size={19} color="#fff" />
                    <Text style={{ color: '#fff', fontSize: 16, fontFamily: F.bold }}>{t('journey.save')}</Text>
                  </TouchableOpacity>
                )}
                <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12.5, fontFamily: F.regular, textAlign: 'center' }}>{t('journey.shareHint')}</Text>
              </View>
            )}

            {/* Habillage d'une étape du film, hors écran : capturé à tour de rôle pendant le montage. */}
            <View pointerEvents="none" style={{ position: 'absolute', left: -4000, top: 0 }}>
              <ViewShot ref={overlayRef} style={{ width: W, height: H, backgroundColor: 'transparent' }}>
                {overlayStep && <StepOverlay journey={journey} step={overlayStep} />}
              </ViewShot>
            </View>
          </>
        )}
      </View>
    </Modal>
  );
}

function JourneyVideo({ uri, style }: { uri: string; style: any }) {
  const player = useVideoPlayer(uri, p => { p.loop = true; p.muted = true; p.play(); });
  return <VideoView player={player} style={style} contentFit="cover" nativeControls={false} />;
}

const label = (j: Journey) => `${j.objective.emoji} ${j.objective.title}`.trim();
const summary = (j: Journey) => tp('journey.summary', j.days, { progress: j.steps[j.steps.length - 1]?.progress ?? '' });

/** La carte récap 9:16 : avant, après, et les étapes entre les deux. Dessinée à 360 de large, `k` l'agrandit. */
function RecapCard({ journey: j, k }: { journey: Journey; k: number }) {
  const withMedia = j.steps.filter(s => s.thumb);
  const first = withMedia[0];
  const lastStep = withMedia.length > 1 ? withMedia[withMedia.length - 1] : null;
  const middle = withMedia.slice(1, -1);
  const strip = middle.length <= 6 ? middle : Array.from({ length: 6 }, (_, i) => middle[Math.round((i * (middle.length - 1)) / 5)]);
  const big = (s: JourneyStep, w: number) => (
    <View style={{ width: w * k, height: 250 * k, borderRadius: 16 * k, overflow: 'hidden', backgroundColor: '#1a1a1a' }}>
      <Image source={{ uri: s.thumb! }} style={{ width: '100%', height: '100%' }} />
      <LinearGradient colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.7)']} style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 70 * k }} />
      <Text style={{ position: 'absolute', left: 10 * k, bottom: 9 * k, color: '#fff', fontSize: 13 * k, fontFamily: F.black, letterSpacing: 0.6 * k }}>{t('journey.day', { n: s.day })}</Text>
    </View>
  );
  return (
    <View style={{ flex: 1, backgroundColor: '#0a0a0a', paddingHorizontal: 20 * k, paddingTop: 34 * k }}>
      <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11 * k, fontFamily: F.bold, letterSpacing: 1.6 * k }}>{j.objective.won ? t('journey.won') : t('journey.ongoing')}</Text>
      <Text numberOfLines={2} style={{ color: '#fff', fontSize: 30 * k, lineHeight: 33 * k, fontFamily: F.black, letterSpacing: -1 * k, marginTop: 6 * k }}>{label(j)}</Text>
      <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 14 * k, fontFamily: F.semibold, marginTop: 6 * k }}>{summary(j)}</Text>

      <View style={{ flexDirection: 'row', gap: 8 * k, marginTop: 20 * k }}>
        {first && big(first, lastStep ? 156 : 320)}
        {lastStep && big(lastStep, 156)}
      </View>
      {strip.length > 0 && (
        <View style={{ flexDirection: 'row', gap: 6 * k, marginTop: 8 * k }}>
          {strip.map(s => (
            <Image key={s.id} source={{ uri: s.thumb! }} style={{ width: 48 * k, height: 48 * k, borderRadius: 10 * k, backgroundColor: '#1a1a1a' }} />
          ))}
        </View>
      )}

      <View style={{ flex: 1 }} />
      {/* En bas : la signature, et la place du sticker « Lien » d'Instagram. */}
      <View style={{ marginBottom: 92 * k }}>
        <Text style={{ color: '#fff', fontSize: 26 * k, fontFamily: F.black, letterSpacing: -0.8 * k }}>Reiz.</Text>
        <Text style={{ color: 'rgba(255,255,255,0.55)', fontSize: 12 * k, fontFamily: F.semibold, marginTop: 2 * k }}>{t('journey.tagline')}</Text>
      </View>
    </View>
  );
}

/** L'habillage d'une étape du film (PNG transparent) : le titre en haut, le jour et la progression en bas. */
function StepOverlay({ journey: j, step }: { journey: Journey; step: JourneyStep }) {
  return (
    <View style={{ width: W, height: H }}>
      <LinearGradient colors={['rgba(0,0,0,0.55)', 'rgba(0,0,0,0)']} style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 150 }} />
      <LinearGradient colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.75)']} style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 230 }} />
      <View style={{ position: 'absolute', left: 20, right: 20, top: 36 }}>
        <Text style={{ color: '#fff', fontSize: 18, fontFamily: F.black, letterSpacing: -0.5 }}>Reiz.</Text>
        <Text numberOfLines={1} style={{ color: 'rgba(255,255,255,0.85)', fontSize: 14, fontFamily: F.bold, marginTop: 4 }}>{label(j)}</Text>
      </View>
      <View style={{ position: 'absolute', left: 20, right: 20, bottom: 110 }}>
        <Text style={{ color: '#fff', fontSize: 34, fontFamily: F.black, letterSpacing: -1 }}>{t('journey.day', { n: step.day })}</Text>
        <View style={{ height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.25)', marginTop: 10, overflow: 'hidden' }}>
          <View style={{ width: `${step.pct}%`, height: 6, borderRadius: 3, backgroundColor: '#fff' }} />
        </View>
        <Text style={{ color: '#fff', fontSize: 15, fontFamily: F.bold, marginTop: 8 }}>{step.progress}</Text>
      </View>
    </View>
  );
}

import { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput, Image, Alert, ActivityIndicator, KeyboardAvoidingView, Platform, PanResponder, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { askCamera } from '../lib/mediaPerms';
import * as Haptics from 'expo-haptics';
import { supabase, currentUser } from '../lib/supabase';
import { frError, inUnit, num, andList } from '../lib/helpers';
import { uploadImage, uploadVideo, compressVideo, signAvatars, removeUpload } from '../lib/storage';
import { GlassIconButton } from '../components/ProfileSections';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Objective } from '../lib/types';
import { QUICK_UNITS, GUTTER, hasSchedule, todayIso } from '../constants';
import { isRhythm, weekLabel } from '../lib/goal';
import { GOAL_COLUMNS, knowsGoalColumns } from '../lib/objectives';
import { ShareStoryModal, StoryData } from '../components/ShareStoryModal';
import { ObjectiveDoneModal, DoneObjective } from '../components/ObjectiveDoneModal';
import { JourneyModal } from '../components/JourneyModal';
import { loadDuoStats, ordinalDuo, DUO_WINDOW_MS } from '../lib/duo';
import { trimAvailable, trimVideo, cleanTrimmed } from '../lib/videoTools';
import { galleryAvailable, saveToGallery } from '../lib/saveToGallery';
import { endAllLiveActivities } from '../lib/liveActivity';
import { track } from '../lib/track';
import { loadDuels, proposeDuel } from '../lib/duel';
import { loadTodayMoment, lateMinutes, ON_TIME_MIN, TodayMoment, MomentKind } from '../lib/moment';
import { s, F } from '../styles';
import { t, tp, unitLabel, isRTL } from '../i18n';
import { CachedImage } from '../components/CachedImage';
import { FEATURES } from '../lib/features';
import { choose } from '../lib/choose';
import { makeBlurhash } from '../lib/blurhash';

// Vidéo de progression : 25 s max (15 s jusqu'à la 1.1). Au-delà, le fichier pèse
// trop lourd pour la 4G et le fil devient une plateforme vidéo.
const VIDEO_MAX_SEC = 25;
const VIDEO_MAX_MB = 45;

// Aperçu de la vidéo choisie, muet et en boucle.
function VideoPreview({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri, p => { p.loop = true; p.muted = true; p.play(); });
  return <VideoView player={player} style={s.postPhotoImg} contentFit="contain" nativeControls={false} />;
}

const THUMB = 22;

// Barre de progression qu'on fait glisser du doigt, comme un volume.
// Ces unités se comptent une par une : une séance de plus, c'est +1. Le reste (kg, km...) dépend de ce qu'on a fait.
const isCountUnit = (u: string) => /^(s[ée]ances?|fois|x)$/i.test(u.trim());

// `onChange` reçoit une part de 0 à 1 ; c'est l'écran qui l'arrondit dans l'unité.
function ProgressSlider({ pct, onChange }: { pct: number; onChange: (ratio: number) => void }) {
  const track = useRef<View>(null);
  const box = useRef({ x: 0, w: 1 });
  const cb = useRef(onChange);
  cb.current = onChange;
  // En hébreu la barre se remplit depuis la droite : le doigt compte à partir du bord droit.
  const at = (pageX: number) => {
    const ratio = Math.max(0, Math.min(1, (pageX - box.current.x - THUMB / 2) / (box.current.w - THUMB)));
    cb.current(isRTL() ? 1 - ratio : ratio);
  };
  const pan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    // Sans ça, la ScrollView reprend le geste dès que le doigt dévie un peu.
    onPanResponderTerminationRequest: () => false,
    onPanResponderGrant: e => {
      const pageX = e.nativeEvent.pageX;
      track.current?.measureInWindow((x, _y, w) => { if (w > 0) box.current = { x, w }; at(pageX); });
    },
    onPanResponderMove: e => at(e.nativeEvent.pageX),
  })).current;
  return (
    <View
      ref={track}
      {...pan.panHandlers}
      style={{ width: '100%', height: 36, justifyContent: 'center', marginTop: 4 }}
      accessibilityRole="adjustable"
      accessibilityLabel={t('post.progress')}
      accessibilityValue={{ min: 0, max: 100, now: pct }}
    >
      {/* Le rond s'arrête aux bords : la partie remplie suit son centre. */}
      <View style={{ height: 6, backgroundColor: '#222', borderRadius: 3, overflow: 'hidden' }}>
        <View style={{ position: 'absolute', left: 0, right: THUMB, top: 0, bottom: 0 }}>
          <View style={{ height: 6, backgroundColor: '#fff', width: `${pct}%` as any, paddingRight: THUMB / 2, boxSizing: 'content-box' }} />
        </View>
      </View>
      <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: THUMB, top: (36 - THUMB) / 2 }}>
        <View style={{ width: THUMB, height: THUMB, borderRadius: THUMB / 2, backgroundColor: '#fff', left: `${pct}%` as any }} />
      </View>
    </View>
  );
}

// 142.5 → « 142,5 » ; 4 → « 4 ».
const fmt = (n: number) => num(Math.round(n * 10) / 10);

// Séance en duo : 3 amis identifiés maximum (vérifié aussi côté serveur).
const MAX_DUO = 3;

export function PostScreen({ onBack, onPublish, duoWith, objectiveId }: { onBack: () => void, onPublish: (next?: 'new_objective') => void, duoWith?: string | null, objectiveId?: string | null }) {
  const insets = useSafeAreaInsets();
  const [selectedObj, setSelectedObj] = useState(0);
  const [objectives, setObjectives] = useState<Objective[]>([]);
  const [loadingObj, setLoadingObj] = useState(true);
  const [value, setValue] = useState(0);
  const [caption, setCaption] = useState('');
  // Après publication : proposition de partager la progression en story Instagram.
  const [story, setStory] = useState<StoryData | null>(null);
  // Objectif que ce post vient de faire gagner : l'écran « Objectif atteint » remplace le simple « Publié ».
  const [done, setDone] = useState<{ objective: DoneObjective; story: StoryData } | null>(null);
  const [journeyId, setJourneyId] = useState<string | null>(null);
  // Le moment Reiz du jour (phase 29) : séance ou récup, et le compte à rebours des 10 minutes « à l'heure ».
  const [moment, setMoment] = useState<TodayMoment | null>(null);
  const [momentKind, setMomentKind] = useState<MomentKind>('session');
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!FEATURES.momentReiz) return;
    loadTodayMoment().then(m => { setMoment(m); if (m) setMomentKind(m.kind); }, () => {});
    const id = setInterval(() => setTick(x => x + 1), 15000);
    return () => clearInterval(id);
  }, []);
  // Un moment ne compte qu'une fois par jour, et seulement une fois son heure arrivée.
  const momentOn = FEATURES.momentReiz && !!moment && !moment.posted && Date.now() >= new Date(moment.at).getTime();
  const momentLate = moment ? lateMinutes(moment.at) : 0;
  const [publishing, setPublishing] = useState(false);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<'image' | 'video'>('image');
  // Photo ou vidéo prise dans Reiz (pas importée) : on propose de l'enregistrer dans la galerie.
  const [fromCamera, setFromCamera] = useState(false);
  const [savedToGallery, setSavedToGallery] = useState(false);
  // Amis du cercle, pour « Avec qui ? ». Réponse à un duo : l'auteur est déjà coché.
  const [friends, setFriends] = useState<{ id: string; full_name: string; avatar_url?: string | null }[]>([]);
  const [withIds, setWithIds] = useState<string[]>(duoWith ? [duoWith] : []);
  // Ton cercle proche : un objectif « Cercle proche » ne peut identifier que lui.
  const [closeIds, setCloseIds] = useState<Set<string>>(new Set());
  const [friendsLoaded, setFriendsLoaded] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  // Saisie directe du chiffre (tap sur la valeur).
  const [typing, setTyping] = useState<string | null>(null);
  // Passage d'un objectif en % vers une vraie unité (kg, km...).
  const [converting, setConverting] = useState(false);
  const [convTarget, setConvTarget] = useState('');
  const [convUnit, setConvUnit] = useState('kg');

  useEffect(() => {
    const load = async () => {
      const user = await currentUser();
      if (!user) { setLoadingObj(false); return; }
      const { data, error } = await supabase.from('objectives').select((knowsGoalColumns() ? `id, emoji, title, current_value, target_value, unit, visibility, training_days, ${GOAL_COLUMNS}` : 'id, emoji, title, current_value, target_value, unit, visibility, training_days') as string).eq('user_id', user.id).order('created_at', { ascending: false });
      if (!error && data) setObjectives((data as unknown as Objective[]).map(inUnit));
      setLoadingObj(false);

      const { data: fr } = await supabase
        .from('friendships')
        .select('requester_id, receiver_id')
        .or(`requester_id.eq.${user.id},receiver_id.eq.${user.id}`)
        .eq('status', 'accepted');
      const ids = (fr || []).map(f => (f.requester_id === user.id ? f.receiver_id : f.requester_id));
      if (ids.length > 0) {
        const { data: us } = await supabase.from('users').select('id, full_name, avatar_url').in('id', ids).order('full_name');
        const list = (us || []) as { id: string; full_name: string; avatar_url?: string | null }[];
        const signed = await signAvatars(list.map(u => u.avatar_url));
        list.forEach(u => { if (u.avatar_url) u.avatar_url = signed[u.avatar_url] ?? null; });
        // L'ami du duo en premier, pour qu'on le voie coché sans faire défiler.
        if (duoWith) list.sort((a, b) => (a.id === duoWith ? -1 : b.id === duoWith ? 1 : 0));
        setFriends(list);
        const { data: cf } = await supabase.from('close_friends').select('friend_id').eq('owner_id', user.id);
        setCloseIds(new Set((cf || []).map((c: any) => c.friend_id)));
      }
      setFriendsLoaded(true);
    };
    load();
  }, []);

  // Réponse à un duo : on part sur le premier objectif où l'ami peut être identifié
  // (un objectif privé, ou « Cercle proche » sans lui, faisait sauter le duo en silence).
  // Ouvert depuis un moment Reiz qui parle d'un objectif : celui-là est déjà choisi.
  const objectivePicked = useRef(false);
  useEffect(() => {
    if (!objectiveId || objectivePicked.current || objectives.length === 0) return;
    objectivePicked.current = true;
    const i = objectives.findIndex(o => o.id === objectiveId);
    if (i > 0) setSelectedObj(i);
  }, [objectiveId, objectives]);
  const duoPicked = useRef(false);
  useEffect(() => {
    if (!duoWith || duoPicked.current || !friendsLoaded || objectives.length === 0) return;
    duoPicked.current = true;
    const i = objectives.findIndex(o => o.visibility === 'friends' || o.visibility === 'public' || (o.visibility === 'close' && closeIds.has(duoWith)));
    if (i > 0) setSelectedObj(i);
  }, [duoWith, friendsLoaded, objectives, closeIds]);

  const obj = objectives[selectedObj];
  // Un objectif privé n'est visible que par soi : identifier quelqu'un n'aurait pas de sens.
  const taggable = obj?.visibility === 'close' ? friends.filter(f => closeIds.has(f.id)) : friends;
  const canTag = !!obj && obj.visibility !== 'private' && taggable.length > 0;
  // Amis cochés qui ne peuvent pas être identifiés sur l'objectif choisi : on le dit.
  const dropped = obj ? friends.filter(f => withIds.includes(f.id) && !(canTag && taggable.some(t => t.id === f.id))) : [];

  const toggleWith = (id: string) => {
    Haptics.selectionAsync().catch(() => {});
    setWithIds(prev => {
      if (prev.includes(id)) return prev.filter(x => x !== id);
      if (prev.length >= MAX_DUO) { Alert.alert(t('feed.duoSession'), t('post.maxFriends', { n: MAX_DUO })); return prev; }
      return [...prev, id];
    });
  };

  // Une séance sert souvent plusieurs objectifs (prépa compétition, squat, bench les mêmes jours) : les autres objectifs
  // prévus aujourd'hui avancent avec ce post, sans post en plus dans le fil. Un compteur (séances, fois) prend +1, coché
  // d'office ; une charge ou une distance ne se devine pas : on la tape, et vide veut dire qu'on n'y touche pas.
  const alsoToday = objectives.filter(o => o.id !== obj?.id && o.unit !== '%' && (o.current_value || 0) < o.target_value && hasSchedule(o.training_days) && o.training_days!.includes(todayIso()));
  const [alsoOff, setAlsoOff] = useState<string[]>([]);
  const [alsoTyped, setAlsoTyped] = useState<Record<string, string>>({});
  /** La nouvelle valeur de chaque autre objectif à faire avancer. Jamais au-delà de la cible, jamais en arrière. */
  const alsoUpdates = () => alsoToday.flatMap(o => {
    const current = o.current_value || 0;
    if (isCountUnit(o.unit)) return alsoOff.includes(o.id) ? [] : [{ o, next: Math.min(o.target_value, current + 1) }];
    const n = Number((alsoTyped[o.id] ?? '').replace(',', '.'));
    if (!(n > current)) return [];
    return [{ o, next: Math.min(o.target_value, Math.round(n * 10) / 10) }];
  });

  // Un objectif chiffré (4 séances, 10 km...) se compte dans son unité, pas en
  // pourcentage : `value` est toujours la vraie valeur, le pourcentage n'en est
  // que la conséquence. Les objectifs en % gardent l'ancien pas de 5.
  const isPercent = !obj || obj.unit === '%';
  // Rythme hebdo (phase 31) : pas de curseur, ce post est une séance de plus.
  const rhythm = isRhythm(obj);
  const target = obj?.target_value ?? 100;
  const max = isPercent ? 100 : target;
  // Pas du curseur : 1 par défaut, plus large sur les gros objectifs (10 000 pas).
  const slideStep = isPercent ? 1 : Math.max(1, Math.round(target / 200));
  const bump = (d: number) => { Haptics.selectionAsync().catch(() => {}); setValue(v => Math.max(0, Math.min(max, Math.round((v + d) * 10) / 10))); };
  const slideTo = (ratio: number) => {
    const next = Math.min(max, Math.round((ratio * max) / slideStep) * slideStep);
    setValue(prev => { if (prev !== next) Haptics.selectionAsync().catch(() => {}); return next; });
  };
  const commitTyping = () => {
    const n = Number((typing ?? '').replace(',', '.'));
    if (typing !== null && typing.trim() !== '' && !isNaN(n)) setValue(Math.max(0, Math.min(max, Math.round(n * 10) / 10)));
    setTyping(null);
  };

  // Objectif créé en % (« Barre à 170 kg » sans chiffre) : on lui donne une unité
  // et une cible, la progression déjà acquise est convertie.
  const convert = async () => {
    const target = Number(convTarget.replace(',', '.'));
    if (!obj || isNaN(target) || target <= 0) { Alert.alert(t('common.error'), t('post.convertNeedTarget')); return; }
    const current = Math.round((pct / 100) * target * 10) / 10;
    const { error } = await supabase.from('objectives').update({ unit: convUnit, target_value: target, current_value: current }).eq('id', obj.id);
    if (error) { Alert.alert(t('common.error'), frError(error)); return; }
    setObjectives(list => list.map(o => (o.id === obj.id ? { ...o, unit: convUnit, target_value: target, current_value: current } : o)));
    setConverting(false); setConvTarget('');
  };
  const pct = isPercent
    ? Math.round(value)
    : (target > 0 ? Math.min(Math.round((value / target) * 100), 100) : 0);

  // Le compteur démarre sur la progression actuelle de l'objectif sélectionné :
  // publier sans toucher au compteur ne doit jamais faire reculer la progression.
  useEffect(() => {
    if (!obj) return;
    if (obj.unit === '%') {
      const p = obj.target_value > 0 ? Math.min(Math.round((obj.current_value / obj.target_value) * 100), 100) : 0;
      setValue(p);
    } else {
      setValue(isRhythm(obj) ? (obj.current_value || 0) + 1 : (obj.current_value || 0));
    }
    setTyping(null); setConverting(false);
  }, [selectedObj, objectives]);

  // Les morceaux rognés lors d'une publication précédente ne servent plus.
  useEffect(() => { cleanTrimmed(); }, []);

  // Garde un média choisi (photo ou vidéo) après vérification de la durée et du poids.
  // Vidéo de la galerie : l'éditeur s'ouvre toujours (couper, recadrer, couper le son...), builds 1.0.1 et plus.
  // Trop longue, il faut couper pour continuer ; assez courte, « Annuler » garde la vidéo telle quelle.
  const acceptAsset = async (asset: ImagePicker.ImagePickerAsset, openEditor = false, camera = false) => {
    let uri = asset.uri;
    if (asset.type === 'video') {
      const tooLong = !!asset.duration && asset.duration > (VIDEO_MAX_SEC + 0.5) * 1000;
      if (tooLong && !trimAvailable()) {
        Alert.alert(t('post.videoTooLongTitle'), t('post.videoTooLongText', { n: VIDEO_MAX_SEC }));
        return;
      }
      if (trimAvailable() && (tooLong || openEditor)) {
        const cut = await trimVideo(uri, VIDEO_MAX_SEC);
        if (!cut && tooLong) return;
        if (cut) uri = cut;
      } else if (asset.fileSize && asset.fileSize > VIDEO_MAX_MB * 1024 * 1024) {
        Alert.alert(t('post.videoTooBigTitle'), t('post.videoTooBigText'));
        return;
      }
      setMediaType('video');
    } else {
      setMediaType('image');
    }
    setPhotoUri(uri);
    setFromCamera(camera);
    setSavedToGallery(false);
  };

  const keepInGallery = async () => {
    if (!photoUri || savedToGallery) return;
    const r = await saveToGallery(photoUri);
    if (r === 'saved') { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}); setSavedToGallery(true); }
    else if (r === 'denied') Alert.alert(t('post.gallery'), t('post.galleryDenied'));
    else Alert.alert(t('post.gallery'), t('post.galleryFailed'));
  };

  // Recouper la vidéo déjà choisie (garder un autre passage, la raccourcir encore).
  const recutVideo = async () => {
    if (!photoUri) return;
    const cut = await trimVideo(photoUri, VIDEO_MAX_SEC);
    if (cut) setPhotoUri(cut);
  };

  const handlePickPhoto = async () => {
    const needCamera = askCamera;
    choose(t('post.mediaTitle'), t('post.mediaSub', { n: VIDEO_MAX_SEC }), [
      {
        text: t('common.takePhoto'),
        onPress: async () => {
          if (!(await needCamera())) return;
          const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.9 }); // sans recadrage : la photo reste telle que prise
          if (!result.canceled) acceptAsset(result.assets[0], false, true);
        }
      },
      {
        text: t('post.recordVideo'),
        onPress: async () => {
          if (!(await needCamera())) return;
          const result = await ImagePicker.launchCameraAsync({
            mediaTypes: ['videos'],
            videoMaxDuration: VIDEO_MAX_SEC,
            // 720p suffit largement pour un écran de téléphone et divise le poids par ~4.
            videoExportPreset: ImagePicker.VideoExportPreset.H264_1280x720,
            videoQuality: ImagePicker.UIImagePickerControllerQualityType.Medium,
          });
          if (!result.canceled) acceptAsset(result.assets[0], false, true);
        }
      },
      {
        text: trimAvailable() ? t('post.importPhoto') : t('common.pickFromLibrary'),
        onPress: async () => {
          const trim = trimAvailable();
          const result = await ImagePicker.launchImageLibraryAsync({
            // Avec l'éditeur de rognage, photos et vidéos ont chacune leur bouton : le recadrage
            // d'iOS ne s'applique plus qu'aux photos, la coupe des vidéos passe par notre éditeur.
            mediaTypes: trim ? ['images'] : ['images', 'videos'],
            quality: 0.9, // la vraie compression se fait à l'envoi (compressImage) : ne pas abîmer la photo deux fois
            // Photo sans recadrage (le 4:3 imposé zoomait). Sans l'éditeur (build 1.0.0), allowsEditing permet encore de
            // couper une vidéo trop longue sur iPhone.
            allowsEditing: !trim,
            videoMaxDuration: VIDEO_MAX_SEC,
            videoExportPreset: ImagePicker.VideoExportPreset.H264_1280x720,
          });
          if (!result.canceled) acceptAsset(result.assets[0]);
        }
      },
      ...(trimAvailable() ? [{
        text: t('post.importVideo'),
        onPress: async () => {
          const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['videos'],
            videoExportPreset: ImagePicker.VideoExportPreset.H264_1280x720,
          });
          if (!result.canceled) acceptAsset(result.assets[0], true);
        }
      }] : []),
      ...(photoUri && mediaType === 'video' && trimAvailable() ? [{ text: t('post.editVideo'), onPress: recutVideo }] : []),
      ...(photoUri ? [{ text: t('common.remove'), style: 'destructive' as const, onPress: () => { setPhotoUri(null); setMediaType('image'); setFromCamera(false); } }] : []),
      { text: t('common.cancel'), style: 'cancel' }
    ]);
  };

  // Vidéo : allégée (720p, sortie en mp4) puis envoyée. L'extension sert à reconnaître une vidéo à l'affichage (isVideo).
  const sendVideo = async (uri: string, userId: string) => {
    const sendUri = await compressVideo(uri);
    const isMov = /\.mov$/i.test(sendUri);
    return uploadVideo(`${userId}/${Date.now()}.${isMov ? 'mov' : 'mp4'}`, sendUri, isMov ? 'video/quicktime' : 'video/mp4');
  };

  // Vidéo préparée en avance (20/11/2026, FEATURES.videoPrepare). Avant, tout partait à l'appui sur « Publier » :
  // recompression, puis envoi, et on regardait tourner la roue. Maintenant le travail commence dès que la vidéo est
  // choisie, pendant qu'on choisit l'objectif et qu'on écrit la légende. À « Publier », on attend seulement ce qui reste.
  // Une vidéo changée, retirée ou jamais publiée : son fichier déjà envoyé est effacé du serveur.
  type Prepared = { uri: string; promise: Promise<{ path: string | null; error: { message?: string } | null }>; used: boolean };
  const prepared = useRef<Prepared | null>(null);
  const [prep, setPrep] = useState<'idle' | 'running' | 'ready'>('idle');
  const dropPrepared = () => {
    const p = prepared.current;
    prepared.current = null;
    setPrep('idle');
    if (p && !p.used) p.promise.then(r => removeUpload(r.path), () => {});
  };
  useEffect(() => {
    if (!FEATURES.videoPrepare) return;
    dropPrepared();
    if (!photoUri || mediaType !== 'video') return;
    const uri = photoUri;
    const promise = (async () => {
      const user = await currentUser();
      if (!user) return { path: null, error: { message: t('post.mustBeSignedIn') } };
      return sendVideo(uri, user.id);
    })().catch((e: any) => ({ path: null, error: { message: e?.message } }));
    prepared.current = { uri, promise, used: false };
    setPrep('running');
    promise.then(r => { if (prepared.current?.promise === promise) setPrep(r.path ? 'ready' : 'idle'); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photoUri, mediaType]);
  // Écran quitté sans publier : la vidéo préparée ne reste pas sur le serveur.
  useEffect(() => () => { const p = prepared.current; if (p && !p.used) p.promise.then(r => removeUpload(r.path), () => {}); }, []);

  // Renvoie le CHEMIN de stockage (pas une URL) : le bucket est privé, les URLs
  // sont signées au moment de l'affichage.
  const uploadPhoto = async (uri: string, userId: string): Promise<string | null> => {
    setUploadingPhoto(true);
    let result: { path: string | null; error: { message?: string } | null };
    if (mediaType === 'video') {
      // La vidéo préparée en avance, si c'est bien celle-là. Préparation ratée (réseau) : on repart de zéro, une fois.
      const ready = prepared.current && prepared.current.uri === uri ? prepared.current : null;
      result = ready ? await ready.promise : { path: null, error: null };
      if (!result.path) result = await sendVideo(uri, userId);
      if (ready && result.path) ready.used = true;
    } else {
      result = await uploadImage(`${userId}/${Date.now()}.jpg`, uri);
    }
    const { path, error } = result;
    setUploadingPhoto(false);
    if (error) {
      // Message précis pour les vidéos : « trop lourde » se corrige, « réessaie » non.
      const tooBig = /413|too large|exceeded the maximum/i.test(error.message || '');
      Alert.alert(
        mediaType === 'video' ? t('post.videoUploadFailed') : t('post.uploadFailed'),
        tooBig ? t('post.videoTooBig50') : frError(error),
      );
      return null;
    }
    return path;
  };

  // Sans photo ni vidéo, la séance perd tout son intérêt pour ton cercle : on te le dit (gentiment) avant de publier.
  const handlePublish = () => {
    if (!obj) { Alert.alert(t('common.error'), t('post.pickObjective')); return; }
    if (photoUri) { publish(); return; }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
    Alert.alert(
      t('post.noPhotoTitle'),
      t('post.noPhotoText'),
      [
        { text: t('post.addPhoto'), onPress: handlePickPhoto },
        { text: t('post.publishWithout'), style: 'destructive', onPress: publish },
      ],
    );
  };

  // Audit du 20/11/2026 : deux appuis rapides sur « Publier » lançaient deux envois avant que le bouton ne se grise
  // (l'état React n'est à jour qu'au rendu suivant). Le verrou, lui, est immédiat.
  const publishLock = useRef(false);
  const publish = async () => {
    if (!obj || publishLock.current) return;
    publishLock.current = true;
    try { await publishOnce(); } finally { publishLock.current = false; }
  };
  const publishOnce = async () => {
    if (!obj) return;
    setPublishing(true);
    const user = await currentUser();
    if (!user) { setPublishing(false); Alert.alert(t('common.error'), t('post.mustBeSignedIn')); return; }
    let photoUrl: string | null = null;
    // Empreinte floue pour le fil de découverte (phase 39), calculée pendant l'envoi : rien de plus à attendre.
    const hashing = photoUri && FEATURES.discoverFeed ? makeBlurhash(photoUri, mediaType === 'video') : Promise.resolve(null);
    if (photoUri) {
      photoUrl = await uploadPhoto(photoUri, user.id);
      // Échec d'envoi : on s'arrête là plutôt que de publier sans le média choisi.
      if (!photoUrl) { setPublishing(false); return; }
    }
    const blurhash = await hashing;
    // progress_value = pourcentage (0-100), c'est ce que le feed affiche.
    // current_value = valeur absolue dans l'unité de l'objectif (séances, km...),
    // affichée partout ailleurs. Les deux sont calculées à partir du même compteur.
    const absoluteValue = isPercent
      ? Math.round((value / 100) * obj.target_value * 10) / 10
      : value;
    // Ce post fait-il franchir la cible ? (il ne l'était pas avant, il l'est maintenant)
    const reachedNow = !rhythm && obj.target_value > 0 && (obj.current_value || 0) < obj.target_value && absoluteValue >= obj.target_value;
    const { error } = await supabase.from('updates').insert({
      user_id: user.id, objective_id: obj.id,
      caption: caption || obj.title,
      ...(momentOn ? { moment: momentKind, moment_late_min: lateMinutes(moment!.at) } : {}),
      // Pourcentage exact, pas arrondi : 215 sur 240 kg arrondi à 90 % s'affichait 216 kg dans le fil.
      progress_value: isPercent || !(target > 0) ? pct : Math.min(100, Math.round((value / target) * 1000000) / 10000),
      photo_url: photoUrl,
      ...(blurhash ? { blurhash } : {}),
      // Seulement les amis encore autorisés (changement d'objectif après avoir coché).
      with_user_ids: canTag ? withIds.filter(id => taggable.some(f => f.id === id)) : [],
    });
    // Après le post : l'objectif, les autres objectifs du jour, le compte de mes posts et mon nom partent ENSEMBLE
    // (20/11/2026 : ils se suivaient un par un, quatre allers-retours à attendre avant le retour au fil).
    const noCount = { count: null as number | null };
    const [, also, { count: postCount }, meRes] = error
      ? [null, [] as { o: Objective; next: number; failed: boolean }[], noCount, { data: null as { username?: string; full_name?: string } | null }] as const
      : await Promise.all([
        supabase.from('objectives').update({ current_value: absoluteValue, unit: obj.unit, target_value: obj.target_value }).eq('id', obj.id).then(r => r, () => null),
        Promise.all(alsoUpdates().map(async u => ({
          ...u, failed: !!(await supabase.from('objectives').update({ current_value: u.next }).eq('id', u.o.id)).error,
        }))),
        // Premier post du compte ou non : pour le back-office, et pour la fenêtre de fin (le post tout juste écrit compte déjà).
        supabase.from('updates').select('id', { count: 'exact', head: true }).eq('user_id', user.id).then(r => r, () => noCount),
        supabase.from('users').select('username, full_name').eq('id', user.id).maybeSingle().then(r => r, () => ({ data: null })),
      ]);
    setPublishing(false);
    if (error) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      Alert.alert(t('common.error'), frError(error));
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      track('post_published', { first: postCount === 1, duo: !!duoWith, moment: momentOn ? momentKind : null });
      // 1.4 : la première séance validée, dernière marche de l'entonnoir d'onboarding.
      if (postCount === 1) track('first_session', { duo: !!duoWith }, 'onboarding');
      // Séance postée : la carte du duo (Activité en direct) n'a plus lieu d'être.
      endAllLiveActivities();
      const me = meRes.data;
      const storyData: StoryData = {
        // Vidéo : la story en tire une image (voir ShareStoryModal).
        photoUri,
        emoji: obj.emoji,
        title: obj.title,
        progressLabel: isPercent ? `${pct}%` : `${num(value)} / ${num(obj.target_value)} ${unitLabel(obj.unit)}`,
        pct,
        caption,
        username: me?.username,
        firstName: me?.full_name?.trim().split(' ')[0] || undefined,
      };
      // Séance en duo : prénoms identifiés, et si c'est une réponse à un duo, le décompte
      // du binôme (« 3e duo avec Eden, 2 semaines d'affilée ») avec la photo de l'autre.
      const tagged = canTag ? friends.filter(f => withIds.includes(f.id) && taggable.some(t => t.id === f.id)) : [];
      if (reachedNow) {
        setDone({ objective: { id: obj.id, emoji: obj.emoji, title: obj.title, unit: obj.unit, target_value: obj.target_value }, story: storyData });
        return;
      }
      let title = t('post.publishedTitle');
      const alsoDone = also.filter(u => !u.failed);
      const alsoNote = [
        alsoDone.length > 0 ? t('post.alsoUpdated', { list: andList(alsoDone.map(u => u.o.title)) }) : '',
        ...alsoDone.filter(u => u.next >= u.o.target_value).map(u => t('post.alsoReached', { title: u.o.title })),
        also.some(u => u.failed) ? t('post.alsoFailed', { list: andList(also.filter(u => u.failed).map(u => u.o.title)) }) : '',
      ].filter(Boolean).join('\n');
      let message = t('post.publishedText');
      if (tagged.length > 0) {
        storyData.duoNames = andList(tagged.map(f => f.full_name.split(' ')[0]));
        if (duoWith && tagged.some(f => f.id === duoWith)) {
          const st = await loadDuoStats(user.id, duoWith).catch(() => null);
          const who = tagged.find(f => f.id === duoWith)!.full_name.split(' ')[0];
          // Validé « à l'instant » : le dernier duo compté est celui qu'on vient de poster.
          const justNow = !!st?.last && Date.now() - new Date(st.last).getTime() < 5 * 60 * 1000;
          if (st && !justNow) {
            message = t('post.duoNotValidated', { name: who });
          }
          if (st && justNow) {
            title = t('post.duoValidatedTitle');
            message = t('post.duoValidatedText', { ordinal: ordinalDuo(st.validated), name: who, weeks: st.weeks > 0 ? tp('post.duoWeeks', st.weeks) : '' });
            storyData.partnerPhotoUri = st.partnerPhoto;
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
          }
        }
      }
      // Séance à deux, sans défi en cours avec cet ami : le bon moment pour le proposer (chantier 6 : 14 paires
      // postent en duo, aucune ne s'était lancé de défi).
      const duels = FEATURES.duels && tagged.length > 0 ? await loadDuels().catch(() => null) : null;
      const rival = duels ? tagged.find(f => !duels.some(d => d.otherId === f.id && (d.status === 'active' || d.status === 'pending'))) : undefined;
      // Essai du 19/11/2026 : « Partager en story ? » revenait après chaque séance. La fenêtre ne s'ouvre plus que
      // lorsqu'elle a quelque chose à dire : le premier post, un duo, d'autres objectifs avancés, un défi à proposer.
      // Sinon retour direct au fil, où la séance est déjà en haut (la story reste dans le menu du post).
      if (FEATURES.rareStoryPrompt && postCount !== 1 && postCount !== null && tagged.length === 0 && !alsoNote && !rival) { onPublish(); return; }
      Alert.alert(title, alsoNote ? `${alsoNote}\n\n${message}` : message, [
        ...(rival ? [{ text: t('duelCard.challengeThisWeek', { name: rival.full_name.split(' ')[0] }), onPress: async () => {
          const err = await proposeDuel(rival.id);
          if (err) Alert.alert(t('duelCard.duel'), err);
          else track('duel_propose', { from: 'post' }, 'post');
          onPublish();
        } }] : []),
        { text: t('post.shareStory'), onPress: () => setStory(storyData) },
        { text: t('post.finish'), style: 'cancel', onPress: () => onPublish() },
      ]);
    }
  };

  return (
    // Clavier : sur iPhone, KeyboardAvoidingView remontait le bouton « Publier »
    // (fixé en bas) pile sur le champ Légende, sans faire défiler jusqu'au champ.
    // On le coupe sur iOS et on laisse la ScrollView gérer le clavier elle-même
    // (automaticallyAdjustKeyboardInsets) : le champ touché reste visible, le
    // bouton reste sous le clavier. Android garde l'ancien comportement.
    <KeyboardAvoidingView style={s.container} behavior="height" enabled={Platform.OS === 'android'}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: GUTTER, paddingTop: insets.top + 8, paddingBottom: 12 }}>
        <GlassIconButton icon="chevron-back" label={t('common.back')} onPress={onBack} />
        <Text style={{ color: '#fff', fontSize: 22, fontFamily: F.black, letterSpacing: -0.5 }}>{t('post.title')}</Text>
      </View>

      {momentOn && (
        <View style={{ marginHorizontal: GUTTER, marginBottom: 12, padding: 12, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: '#fff', fontSize: 15, fontFamily: F.extrabold }}>{t('moment.title')}</Text>
            <Text style={{ color: momentLate < ON_TIME_MIN ? '#fff' : 'rgba(255,255,255,0.6)', fontSize: 12.5, fontFamily: F.semibold, marginTop: 2 }}>
              {momentLate < ON_TIME_MIN ? t('moment.left', { n: ON_TIME_MIN - momentLate }) : t('moment.lateOk')}
            </Text>
          </View>
          {/* 1.3 : plus de choix Séance / Récup (la récup n'existe plus depuis la phase 31). Le type vient du moment du jour. */}
        </View>
      )}

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 120 + insets.bottom }}
        automaticallyAdjustKeyboardInsets
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled"
      >
        {/* Photo */}
        <TouchableOpacity style={s.postPhotoZone} onPress={handlePickPhoto} activeOpacity={0.85}>
          {photoUri
            ? <>
                {mediaType === 'video'
                  ? <VideoPreview uri={photoUri} />
                  : <CachedImage uri={photoUri} style={s.postPhotoImg} resizeMode="contain" />}
                <View style={s.postPhotoChangeBadge}>
                  <Text style={s.postPhotoChangeText}>{t('post.change')}</Text>
                </View>
                {/* Prise dans Reiz : la garder aussi dans la galerie de l'iPhone. */}
                {fromCamera && galleryAvailable() && (
                  <TouchableOpacity onPress={keepInGallery} disabled={savedToGallery} activeOpacity={0.85} accessibilityLabel={savedToGallery ? t('post.savedToGallery') : t('post.saveToGallery')}
                    style={[s.postPhotoChangeBadge, { bottom: undefined, top: 14, flexDirection: 'row', alignItems: 'center', gap: 6 }]}>
                    <Ionicons name={savedToGallery ? 'checkmark' : 'download-outline'} size={15} color="#fff" />
                    <Text style={s.postPhotoChangeText}>{savedToGallery ? t('post.saved') : t('common.save')}</Text>
                  </TouchableOpacity>
                )}
                {/* Vidéo : bouton « Modifier » bien visible, qui rouvre l'éditeur (couper, recadrer, son, vitesse). */}
                {mediaType === 'video' && trimAvailable() && (
                  <TouchableOpacity onPress={recutVideo} activeOpacity={0.85} accessibilityLabel={t('post.editVideo')}
                    style={[s.postPhotoChangeBadge, { right: undefined, left: 14, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#fff', borderColor: '#fff' }]}>
                    <Ionicons name="cut-outline" size={15} color="#000" />
                    <Text style={[s.postPhotoChangeText, { color: '#000' }]}>{t('common.edit')}</Text>
                  </TouchableOpacity>
                )}
              </>
            : <View style={s.postPhotoEmpty}>
                <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="camera-outline" size={26} color="#fff" />
                </View>
                <Text style={s.postPhotoEmptyText}>{t('post.addMedia')}</Text>
                <Text style={s.postPhotoEmptyHint}>{t('post.addMediaHint', { n: VIDEO_MAX_SEC })}</Text>
              </View>
          }
        </TouchableOpacity>

        {FEATURES.videoPrepare && mediaType === 'video' && !!photoUri && prep !== 'idle' && (
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 10 }} accessibilityLiveRegion="polite">
            {prep === 'running' ? <ActivityIndicator color="#fff" size="small" /> : <Ionicons name="checkmark-circle" size={16} color="#fff" />}
            <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, fontFamily: F.semibold }}>{t(prep === 'running' ? 'post.videoPreparing' : 'post.videoReady')}</Text>
          </View>
        )}

        <View style={s.postBody}>
          {/* Objectif */}
          <Text style={s.postLabel}>{t('post.objectiveLabel')}</Text>
          {loadingObj
            ? <ActivityIndicator color="#fff" style={{ marginBottom: 20 }} />
            : objectives.length === 0
              ? FEATURES.createGoalFromPost
                ? (
                  // Essai du 19/11/2026 : la phrase renvoyait vers « Mes objectifs », un nom qu'aucun onglet ne porte.
                  <View style={[s.postEmptyObj, { gap: 12, paddingVertical: 18 }]}>
                    <Text style={{ color: '#ddd', fontSize: 14, lineHeight: 20, fontFamily: F.regular, textAlign: 'center' }}>{t('post.noObjectiveYet')}</Text>
                    <TouchableOpacity style={s.emptyStateBtn} onPress={() => onPublish('new_objective')} accessibilityRole="button">
                      <Text style={s.emptyStateBtnText}>{t('post.createObjective')}</Text>
                    </TouchableOpacity>
                  </View>
                )
                : <View style={s.postEmptyObj}>
                  <Text style={{ color: '#888', fontSize: 13 }}>{t('post.noObjective')}</Text>
                </View>
              : <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.postObjScroll} contentContainerStyle={{ gap: 10, paddingHorizontal: GUTTER }}>
                  {objectives.map((o, i) => (
                    <TouchableOpacity key={o.id} style={[s.postObjCard, selectedObj === i && s.postObjCardActive]} onPress={() => setSelectedObj(i)}>
                      <Text style={[s.postObjTitle, selectedObj === i && s.postObjTitleActive]} numberOfLines={2}>{o.title}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
          }

          {/* Avec qui ? (séance en duo) */}
          {dropped.length > 0 && (
            <View style={{ marginTop: 20, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 18, padding: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' }}>
              <Text style={{ color: '#ddd', fontSize: 13, lineHeight: 18 }}>
                {tp(obj?.visibility === 'private' ? 'post.droppedPrivate' : 'post.droppedClose', dropped.length, { names: andList(dropped.map(f => f.full_name)) })}
              </Text>
            </View>
          )}
          {canTag && <>
            <Text style={[s.postLabel, { marginTop: 28 }]}>{t('post.withWho')}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -GUTTER }} contentContainerStyle={{ gap: 14, paddingHorizontal: GUTTER }}>
              {taggable.map(f => {
                const on = withIds.includes(f.id);
                return (
                  <TouchableOpacity key={f.id} onPress={() => toggleWith(f.id)} activeOpacity={0.8} style={{ alignItems: 'center', width: 60 }} accessibilityLabel={t(on ? 'post.untag' : 'post.tag', { name: f.full_name })}>
                    <View style={{ width: 52, height: 52, borderRadius: 26, borderWidth: 2, borderColor: on ? '#fff' : 'transparent', padding: 2 }}>
                      {f.avatar_url
                        ? <CachedImage uri={f.avatar_url} style={{ width: '100%', height: '100%', borderRadius: 24 }} />
                        : <View style={{ flex: 1, borderRadius: 24, backgroundColor: '#2a2a2a', alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: '#fff', fontFamily: F.bold }}>{f.full_name.charAt(0).toUpperCase()}</Text></View>}
                      {on && (
                        <View style={{ position: 'absolute', right: -2, bottom: -2, width: 18, height: 18, borderRadius: 9, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' }}>
                          <Ionicons name="checkmark" size={12} color="#000" />
                        </View>
                      )}
                    </View>
                    <Text numberOfLines={1} style={{ color: on ? '#fff' : '#888', fontSize: 11, fontFamily: F.semibold, marginTop: 5 }}>{f.full_name}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            {withIds.length > 0 && (
              <Text style={{ color: '#8a8a8a', fontSize: 12, marginTop: 8 }}>
                {t('post.taggedHint')}
              </Text>
            )}
          </>}

          {/* Progression */}
          {obj && <>
            <Text style={[s.postLabel, { marginTop: 28 }]}>{t('post.progressLabel')}</Text>
            {rhythm ? (
              <View style={{ backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', borderRadius: 24, padding: 18, alignItems: 'center' }}>
                <Text style={s.postProgressPct}>{t('goal.postSession', { n: fmt(value), total: fmt(obj.target_value) })}</Text>
                <Text style={[s.postProgressVal, { marginTop: 4 }]}>{weekLabel(obj)}</Text>
              </View>
            ) : (
            <View style={s.postProgressWrap}>
              <TouchableOpacity
                style={s.postProgressBtn}
                onPress={() => bump(-1)}
                accessibilityLabel={t('common.less')}
              >
                <Ionicons name="remove" size={22} color="#fff" />
              </TouchableOpacity>
              <View style={s.postProgressCenter}>
                {typing !== null ? (
                  <TextInput
                    style={[s.postProgressPct, { minWidth: 90, textAlign: 'center', padding: 0 }]}
                    value={typing}
                    onChangeText={setTyping}
                    keyboardType="decimal-pad"
                    returnKeyType="done"
                    autoFocus
                    placeholder={fmt(value)}
                    placeholderTextColor="#555"
                    maxLength={7}
                    onBlur={commitTyping}
                    onSubmitEditing={commitTyping}
                  />
                ) : (
                  <TouchableOpacity onPress={() => setTyping('')} accessibilityLabel={t('post.typeValue')}>
                    <Text style={s.postProgressPct}>
                      {fmt(value)}
                      <Text style={{ fontSize: 16, color: '#888', fontFamily: F.bold }}>{isPercent ? ' %' : ` ${unitLabel(obj.unit)}`}</Text>
                    </Text>
                  </TouchableOpacity>
                )}
                <Text style={s.postProgressVal}>
                  {isPercent ? t('post.slideHint') : t('post.outOf', { target: fmt(obj.target_value), unit: unitLabel(obj.unit) })}
                </Text>
                <ProgressSlider pct={pct} onChange={slideTo} />
              </View>
              <TouchableOpacity
                style={s.postProgressBtn}
                onPress={() => bump(1)}
                accessibilityLabel={t('common.more')}
              >
                <Ionicons name="add" size={22} color="#fff" />
              </TouchableOpacity>
            </View>
            )}
            {isPercent && !converting && (
              <TouchableOpacity onPress={() => setConverting(true)} style={{ paddingVertical: 12 }}>
                <Text style={{ color: '#aaa', fontSize: 13, fontFamily: F.semibold }}>{t('post.pickUnit')}</Text>
              </TouchableOpacity>
            )}
            {isPercent && converting && (
              <View style={{ backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', borderRadius: 24, padding: 16, marginTop: 10, gap: 12 }}>
                <Text style={{ color: '#fff', fontSize: 14, fontFamily: F.semibold }}>{t('post.whatTarget')}</Text>
                <View style={s.targetRow}>
                  <TextInput
                    style={[s.inputField, s.targetInput]}
                    placeholder="170"
                    placeholderTextColor="#666"
                    value={convTarget}
                    onChangeText={setConvTarget}
                    keyboardType="decimal-pad"
                    maxLength={6}
                  />
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }} keyboardShouldPersistTaps="handled">
                    {QUICK_UNITS.map(u => (
                      <TouchableOpacity key={u} style={[s.durationPill, convUnit === u && s.durationPillActive]} onPress={() => setConvUnit(u)}>
                        <Text style={[s.durationPillText, convUnit === u && s.durationPillTextActive]}>{unitLabel(u)}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <TouchableOpacity onPress={() => setConverting(false)} style={[s.durationPill, { flex: 1, alignItems: 'center' }]}>
                    <Text style={s.durationPillText}>{t('common.cancel')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={convert} style={[s.durationPill, s.durationPillActive, { flex: 1, alignItems: 'center' }]}>
                    <Text style={[s.durationPillText, s.durationPillTextActive]}>{t('common.validate')}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </>}

          {/* Les autres objectifs prévus aujourd'hui */}
          {alsoToday.length > 0 && <>
            <Text style={[s.postLabel, { marginTop: 28 }]}>{t('post.alsoLabel')}</Text>
            <Text style={{ color: '#888', fontSize: 13, fontFamily: F.regular, marginTop: -6, marginBottom: 10 }}>{t('post.alsoHint')}</Text>
            <View style={{ gap: 8 }}>
              {alsoToday.map(o => {
                const count = isCountUnit(o.unit);
                const on = count && !alsoOff.includes(o.id);
                const body = (
                  <>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: '#fff', fontSize: 14, fontFamily: F.bold }} numberOfLines={1}>{o.title}</Text>
                      <Text style={{ color: 'rgba(255,255,255,0.55)', fontSize: 12.5, fontFamily: F.regular, marginTop: 2 }}>
                        {count && on
                          ? `${fmt(o.current_value || 0)} → ${fmt(Math.min(o.target_value, (o.current_value || 0) + 1))} ${t('post.outOf', { target: fmt(o.target_value), unit: unitLabel(o.unit) })}`
                          : `${fmt(o.current_value || 0)} ${t('post.outOf', { target: fmt(o.target_value), unit: unitLabel(o.unit) })}`}
                      </Text>
                    </View>
                    {count
                      ? <Ionicons name={on ? 'checkmark-circle' : 'ellipse-outline'} size={24} color={on ? '#fff' : 'rgba(255,255,255,0.35)'} />
                      : <TextInput
                          style={{ width: 92, height: 38, borderRadius: 19, paddingHorizontal: 12, textAlign: 'center', color: '#fff', fontFamily: F.bold, fontSize: 14, backgroundColor: 'rgba(255,255,255,0.1)' }}
                          value={alsoTyped[o.id] ?? ''}
                          onChangeText={v => setAlsoTyped(m => ({ ...m, [o.id]: v }))}
                          keyboardType="decimal-pad"
                          returnKeyType="done"
                          placeholder={unitLabel(o.unit)}
                          placeholderTextColor="rgba(255,255,255,0.45)"
                          maxLength={7}
                          accessibilityLabel={t('post.alsoValue', { title: o.title })}
                        />}
                  </>
                );
                const row = { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 12, minHeight: 60, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' };
                return count
                  ? <TouchableOpacity key={o.id} style={row} activeOpacity={0.8} accessibilityRole="checkbox" accessibilityState={{ checked: on }} onPress={() => { Haptics.selectionAsync().catch(() => {}); setAlsoOff(l => (l.includes(o.id) ? l.filter(x => x !== o.id) : [...l, o.id])); }}>{body}</TouchableOpacity>
                  : <View key={o.id} style={row}>{body}</View>;
              })}
            </View>
          </>}

          {/* Caption */}
          <Text style={[s.postLabel, { marginTop: 28 }]}>{t('post.captionLabel')}</Text>
          <TextInput
            style={s.postCaptionInput}
            placeholder={t('post.captionPlaceholder')}
            placeholderTextColor="#666"
            value={caption}
            onChangeText={setCaption}
            multiline
            maxLength={300}
          />
        </View>
      </ScrollView>

      <View style={[s.ctaContainer, { backgroundColor: 'transparent', paddingTop: 28, paddingBottom: Math.max(insets.bottom, 20) }]}>
        {/* Fondu sous le bouton : le contenu qui défile ne passe pas net derrière. */}
        <LinearGradient pointerEvents="none" colors={['rgba(10,10,10,0)', 'rgba(10,10,10,0.85)']} locations={[0, 0.45]} style={StyleSheet.absoluteFill} />
        <TouchableOpacity
          style={[s.cta, (!obj || publishing || uploadingPhoto) && s.btnDisabled]}
          onPress={!obj || publishing || uploadingPhoto ? undefined : handlePublish}>
          {publishing || uploadingPhoto
            ? <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <ActivityIndicator color="#000" />
                {uploadingPhoto && mediaType === 'video' && <Text style={s.ctaText}>{t('post.uploadingVideo')}</Text>}
              </View>
            : <Text style={s.ctaText}>{t('post.publish')}</Text>}
        </TouchableOpacity>
      </View>
      <ShareStoryModal visible={!!story} data={story} onClose={() => { setStory(null); onPublish(); }} />
      <ObjectiveDoneModal
        objective={done?.objective ?? null}
        onJourney={() => { const id = done?.objective.id ?? null; setDone(null); setJourneyId(id); }}
        onNewObjective={() => { setDone(null); onPublish('new_objective'); }}
        onClose={() => { setDone(null); onPublish(); }}
      />
      <JourneyModal objectiveId={journeyId} own from="victory" onClose={() => { setJourneyId(null); onPublish(); }} />
    </KeyboardAvoidingView>
  );
}

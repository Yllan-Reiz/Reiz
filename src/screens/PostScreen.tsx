import { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput, Image, Alert, ActivityIndicator, KeyboardAvoidingView, Platform, PanResponder } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { supabase, currentUser } from '../lib/supabase';
import { frError, inUnit } from '../lib/helpers';
import { uploadImage, uploadVideo, compressVideo, signAvatars } from '../lib/storage';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Objective } from '../lib/types';
import { QUICK_UNITS } from '../constants';
import { ShareStoryModal, StoryData } from '../components/ShareStoryModal';
import { loadDuoStats, ordinalDuo, DUO_WINDOW_MS } from '../lib/duo';
import { s, F } from '../styles';

// Vidéo de progression : 15 s max, comme une story. Au-delà, le fichier pèse
// trop lourd pour la 4G et le fil devient une plateforme vidéo.
const VIDEO_MAX_SEC = 15;
const VIDEO_MAX_MB = 45;

// Aperçu de la vidéo choisie, muet et en boucle.
function VideoPreview({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri, p => { p.loop = true; p.muted = true; p.play(); });
  return <VideoView player={player} style={s.postPhotoImg} contentFit="cover" nativeControls={false} />;
}

const THUMB = 22;

// Barre de progression qu'on fait glisser du doigt, comme un volume.
// `onChange` reçoit une part de 0 à 1 ; c'est l'écran qui l'arrondit dans l'unité.
function ProgressSlider({ pct, onChange }: { pct: number; onChange: (ratio: number) => void }) {
  const track = useRef<View>(null);
  const box = useRef({ x: 0, w: 1 });
  const cb = useRef(onChange);
  cb.current = onChange;
  const at = (pageX: number) => cb.current(Math.max(0, Math.min(1, (pageX - box.current.x - THUMB / 2) / (box.current.w - THUMB))));
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
      accessibilityLabel="Progression"
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
const fmt = (n: number) => String(Math.round(n * 10) / 10).replace('.', ',');

// Séance en duo : 3 amis identifiés maximum (vérifié aussi côté serveur).
const MAX_DUO = 3;

export function PostScreen({ onBack, onPublish, duoWith }: { onBack: () => void, onPublish: () => void, duoWith?: string | null }) {
  const insets = useSafeAreaInsets();
  const [selectedObj, setSelectedObj] = useState(0);
  const [objectives, setObjectives] = useState<Objective[]>([]);
  const [loadingObj, setLoadingObj] = useState(true);
  const [value, setValue] = useState(0);
  const [caption, setCaption] = useState('');
  // Après publication : proposition de partager la progression en story Instagram.
  const [story, setStory] = useState<StoryData | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<'image' | 'video'>('image');
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
      const { data, error } = await supabase.from('objectives').select('id, emoji, title, current_value, target_value, unit, visibility').eq('user_id', user.id).order('created_at', { ascending: false });
      if (!error && data) setObjectives((data as Objective[]).map(inUnit));
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
      if (prev.length >= MAX_DUO) { Alert.alert('Séance en duo', `${MAX_DUO} amis maximum.`); return prev; }
      return [...prev, id];
    });
  };

  // Un objectif chiffré (4 séances, 10 km...) se compte dans son unité, pas en
  // pourcentage : `value` est toujours la vraie valeur, le pourcentage n'en est
  // que la conséquence. Les objectifs en % gardent l'ancien pas de 5.
  const isPercent = !obj || obj.unit === '%';
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
    const t = Number(convTarget.replace(',', '.'));
    if (!obj || isNaN(t) || t <= 0) { Alert.alert('Erreur', 'Indique le chiffre à atteindre.'); return; }
    const current = Math.round((pct / 100) * t * 10) / 10;
    const { error } = await supabase.from('objectives').update({ unit: convUnit, target_value: t, current_value: current }).eq('id', obj.id);
    if (error) { Alert.alert('Erreur', frError(error)); return; }
    setObjectives(list => list.map(o => (o.id === obj.id ? { ...o, unit: convUnit, target_value: t, current_value: current } : o)));
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
      setValue(obj.current_value || 0);
    }
    setTyping(null); setConverting(false);
  }, [selectedObj, objectives]);

  // Garde un média choisi (photo ou vidéo) après vérification de la durée et du poids.
  const acceptAsset = (asset: ImagePicker.ImagePickerAsset) => {
    if (asset.type === 'video') {
      if (asset.duration && asset.duration > (VIDEO_MAX_SEC + 0.5) * 1000) {
        Alert.alert('Vidéo trop longue', `${VIDEO_MAX_SEC} secondes maximum. Coupe-la puis réessaie.`);
        return;
      }
      if (asset.fileSize && asset.fileSize > VIDEO_MAX_MB * 1024 * 1024) {
        Alert.alert('Vidéo trop lourde', 'Essaie une vidéo plus courte ou filme directement depuis Reiz.');
        return;
      }
      setMediaType('video');
    } else {
      setMediaType('image');
    }
    setPhotoUri(asset.uri);
  };

  const handlePickPhoto = async () => {
    const needCamera = async () => {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') { Alert.alert('Permission refusée', 'Active la caméra dans les réglages.'); return false; }
      return true;
    };
    Alert.alert('Photo ou vidéo', `Vidéo : ${VIDEO_MAX_SEC} secondes maximum`, [
      {
        text: 'Prendre une photo',
        onPress: async () => {
          if (!(await needCamera())) return;
          const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.7, allowsEditing: true, aspect: [4, 3] });
          if (!result.canceled) acceptAsset(result.assets[0]);
        }
      },
      {
        text: 'Filmer une vidéo',
        onPress: async () => {
          if (!(await needCamera())) return;
          const result = await ImagePicker.launchCameraAsync({
            mediaTypes: ['videos'],
            videoMaxDuration: VIDEO_MAX_SEC,
            // 720p suffit largement pour un écran de téléphone et divise le poids par ~4.
            videoExportPreset: ImagePicker.VideoExportPreset.H264_1280x720,
            videoQuality: ImagePicker.UIImagePickerControllerQualityType.Medium,
          });
          if (!result.canceled) acceptAsset(result.assets[0]);
        }
      },
      {
        text: 'Importer depuis la galerie',
        onPress: async () => {
          const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (status !== 'granted') { Alert.alert('Permission refusée', 'Active la galerie dans les réglages.'); return; }
          const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images', 'videos'],
            quality: 0.7,
            // Sur iPhone, allowsEditing permet aussi de couper une vidéo trop longue.
            allowsEditing: true,
            aspect: [4, 3],
            videoMaxDuration: VIDEO_MAX_SEC,
            videoExportPreset: ImagePicker.VideoExportPreset.H264_1280x720,
          });
          if (!result.canceled) acceptAsset(result.assets[0]);
        }
      },
      ...(photoUri ? [{ text: 'Retirer', style: 'destructive' as const, onPress: () => { setPhotoUri(null); setMediaType('image'); } }] : []),
      { text: 'Annuler', style: 'cancel' }
    ]);
  };

  // Renvoie le CHEMIN de stockage (pas une URL) : le bucket est privé, les URLs
  // sont signées au moment de l'affichage.
  const uploadPhoto = async (uri: string, userId: string): Promise<string | null> => {
    setUploadingPhoto(true);
    // L'extension du fichier sert à reconnaître une vidéo à l'affichage (voir isVideo).
    // Vidéo : recompressée en 720p (sortie en mp4) avant envoi.
    const sendUri = mediaType === 'video' ? await compressVideo(uri) : uri;
    const isMov = /\.mov$/i.test(sendUri);
    const { path, error } = mediaType === 'video'
      ? await uploadVideo(`${userId}/${Date.now()}.${isMov ? 'mov' : 'mp4'}`, sendUri, isMov ? 'video/quicktime' : 'video/mp4')
      : await uploadImage(`${userId}/${Date.now()}.jpg`, uri);
    setUploadingPhoto(false);
    if (error) {
      // Message précis pour les vidéos : « trop lourde » se corrige, « réessaie » non.
      const tooBig = /413|too large|exceeded the maximum/i.test(error.message || '');
      Alert.alert(
        mediaType === 'video' ? "La vidéo n'a pas pu partir" : 'Erreur upload',
        tooBig ? 'Vidéo trop lourde (50 Mo max). Filme un peu plus court ou en qualité réduite.' : frError(error),
      );
      return null;
    }
    return path;
  };

  const handlePublish = async () => {
    if (!obj) { Alert.alert('Erreur', 'Sélectionne un objectif.'); return; }
    setPublishing(true);
    const user = await currentUser();
    if (!user) { setPublishing(false); Alert.alert('Erreur', 'Tu dois être connecté.'); return; }
    let photoUrl: string | null = null;
    if (photoUri) {
      photoUrl = await uploadPhoto(photoUri, user.id);
      // Échec d'envoi : on s'arrête là plutôt que de publier sans le média choisi.
      if (!photoUrl) { setPublishing(false); return; }
    }
    // progress_value = pourcentage (0-100), c'est ce que le feed affiche.
    // current_value = valeur absolue dans l'unité de l'objectif (séances, km...),
    // affichée partout ailleurs. Les deux sont calculées à partir du même compteur.
    const absoluteValue = isPercent
      ? Math.round((value / 100) * obj.target_value * 10) / 10
      : value;
    const { error } = await supabase.from('updates').insert({
      user_id: user.id, objective_id: obj.id,
      caption: caption || obj.title,
      progress_value: pct,
      photo_url: photoUrl,
      // Seulement les amis encore autorisés (changement d'objectif après avoir coché).
      with_user_ids: canTag ? withIds.filter(id => taggable.some(f => f.id === id)) : [],
    });
    if (!error) {
      await supabase.from('objectives').update({ current_value: absoluteValue, unit: obj.unit, target_value: obj.target_value }).eq('id', obj.id);
    }
    setPublishing(false);
    if (error) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      Alert.alert('Erreur', frError(error));
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      const fmtN = (n: number) => String(n).replace('.', ',');
      const storyData: StoryData = {
        photoUri: mediaType === 'image' ? photoUri : null,
        emoji: obj.emoji,
        title: obj.title,
        progressLabel: isPercent ? `${pct}%` : `${fmtN(value)} / ${fmtN(obj.target_value)} ${obj.unit}`,
        pct,
        caption,
        username: (await supabase.from('users').select('username').eq('id', user.id).maybeSingle()).data?.username,
      };
      // Séance en duo : prénoms identifiés, et si c'est une réponse à un duo, le décompte
      // du binôme (« 3e duo avec Eden, 2 semaines d'affilée ») avec la photo de l'autre.
      const tagged = canTag ? friends.filter(f => withIds.includes(f.id) && taggable.some(t => t.id === f.id)) : [];
      let title = 'Publié';
      let message = 'Ta mise à jour est en ligne. Tu veux la partager en story pour faire découvrir Reiz ?';
      if (tagged.length > 0) {
        storyData.duoNames = tagged.map(f => f.full_name.split(' ')[0]).join(' et ');
        if (duoWith && tagged.some(f => f.id === duoWith)) {
          const st = await loadDuoStats(user.id, duoWith).catch(() => null);
          const who = tagged.find(f => f.id === duoWith)!.full_name.split(' ')[0];
          // Validé « à l'instant » : le dernier duo compté est celui qu'on vient de poster.
          const justNow = !!st?.last && Date.now() - new Date(st.last).getTime() < 5 * 60 * 1000;
          if (st && !justNow) {
            message = `Ta séance est publiée, mais le duo avec ${who} n'est pas validé : il faut poster à moins d'une heure d'écart. Partage-la quand même en story ?`;
          }
          if (st && justNow) {
            title = 'Duo validé 🤝';
            message = `${ordinalDuo(st.validated)} avec ${who}${st.weeks > 0 ? `, ${st.weeks} ${st.weeks > 1 ? 'semaines' : 'semaine'} d'affilée 🔥` : ''}. Partage votre duo en story ?`;
            storyData.partnerPhotoUri = st.partnerPhoto;
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
          }
        }
      }
      Alert.alert(title, message, [
        { text: 'Partager en story', onPress: () => setStory(storyData) },
        { text: 'Terminer', style: 'cancel', onPress: onPublish },
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
      <View style={[s.header, { paddingTop: insets.top + 6 }]}>
        <TouchableOpacity style={s.backBtn} onPress={onBack} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="chevron-back" size={20} color="#888" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Poste ta progression</Text>
        <View style={{ width: 34 }} />
      </View>

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
                  : <Image source={{ uri: photoUri }} style={s.postPhotoImg} resizeMode="cover" />}
                <View style={s.postPhotoChangeBadge}>
                  <Text style={s.postPhotoChangeText}>Changer</Text>
                </View>
              </>
            : <View style={s.postPhotoEmpty}>
                <Text style={s.postPhotoEmptyText}>Ajoute une photo ou une vidéo</Text>
                <Text style={s.postPhotoEmptyHint}>Vidéo : {VIDEO_MAX_SEC} secondes max</Text>
              </View>
          }
        </TouchableOpacity>

        <View style={s.postBody}>
          {/* Objectif */}
          <Text style={s.postLabel}>OBJECTIF</Text>
          {loadingObj
            ? <ActivityIndicator color="#fff" style={{ marginBottom: 20 }} />
            : objectives.length === 0
              ? <View style={s.postEmptyObj}>
                  <Text style={{ color: '#888', fontSize: 13 }}>Aucun objectif. Crée-en un dans "Mes objectifs".</Text>
                </View>
              : <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.postObjScroll} contentContainerStyle={{ gap: 10, paddingHorizontal: 20 }}>
                  {objectives.map((o, i) => (
                    <TouchableOpacity key={o.id} style={[s.postObjCard, selectedObj === i && s.postObjCardActive]} onPress={() => setSelectedObj(i)}>
                      <Text style={s.postObjEmoji}>{o.emoji}</Text>
                      <Text style={[s.postObjTitle, selectedObj === i && s.postObjTitleActive]} numberOfLines={2}>{o.title}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
          }

          {/* Avec qui ? (séance en duo) */}
          {dropped.length > 0 && (
            <View style={{ marginTop: 20, backgroundColor: '#161616', borderRadius: 14, padding: 12, borderWidth: 1, borderColor: '#2a2a2a' }}>
              <Text style={{ color: '#ddd', fontSize: 13, lineHeight: 18 }}>
                {obj?.visibility === 'private' ? '🔒 Objectif privé' : '★ Objectif réservé à ton cercle proche'} : {dropped.map(f => f.full_name).join(' et ')} ne {dropped.length > 1 ? 'seront' : 'sera'} pas identifié{dropped.length > 1 ? 's' : ''}. Choisis un objectif visible par ton cercle pour poster en duo.
              </Text>
            </View>
          )}
          {canTag && <>
            <Text style={[s.postLabel, { marginTop: 28 }]}>AVEC QUI ? (FACULTATIF)</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -20 }} contentContainerStyle={{ gap: 14, paddingHorizontal: 20 }}>
              {taggable.map(f => {
                const on = withIds.includes(f.id);
                return (
                  <TouchableOpacity key={f.id} onPress={() => toggleWith(f.id)} activeOpacity={0.8} style={{ alignItems: 'center', width: 60 }} accessibilityLabel={`${on ? 'Retirer' : 'Identifier'} ${f.full_name}`}>
                    <View style={{ width: 52, height: 52, borderRadius: 26, borderWidth: 2, borderColor: on ? '#fff' : 'transparent', padding: 2 }}>
                      {f.avatar_url
                        ? <Image source={{ uri: f.avatar_url }} style={{ width: '100%', height: '100%', borderRadius: 24 }} />
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
              <Text style={{ color: '#777', fontSize: 12, marginTop: 8 }}>
                Ils seront prévenus et pourront poster leur séance en duo avec toi.
              </Text>
            )}
          </>}

          {/* Progression */}
          {obj && <>
            <Text style={[s.postLabel, { marginTop: 28 }]}>PROGRESSION</Text>
            <View style={s.postProgressWrap}>
              <TouchableOpacity
                style={s.postProgressBtn}
                onPress={() => bump(-1)}
                accessibilityLabel="Moins"
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
                  <TouchableOpacity onPress={() => setTyping('')} accessibilityLabel="Saisir le chiffre">
                    <Text style={s.postProgressPct}>
                      {fmt(value)}
                      <Text style={{ fontSize: 16, color: '#888', fontFamily: F.bold }}>{isPercent ? ' %' : ` ${obj.unit}`}</Text>
                    </Text>
                  </TouchableOpacity>
                )}
                <Text style={s.postProgressVal}>
                  {isPercent ? 'Glisse la barre ou touche le chiffre' : `sur ${fmt(obj.target_value)} ${obj.unit}`}
                </Text>
                <ProgressSlider pct={pct} onChange={slideTo} />
              </View>
              <TouchableOpacity
                style={s.postProgressBtn}
                onPress={() => bump(1)}
                accessibilityLabel="Plus"
              >
                <Ionicons name="add" size={22} color="#fff" />
              </TouchableOpacity>
            </View>
            {isPercent && !converting && (
              <TouchableOpacity onPress={() => setConverting(true)} style={{ paddingVertical: 12 }}>
                <Text style={{ color: '#aaa', fontSize: 13, fontFamily: F.semibold }}>Choisir l'unité de cet objectif (kg, km, séances...)</Text>
              </TouchableOpacity>
            )}
            {isPercent && converting && (
              <View style={{ backgroundColor: '#111', borderRadius: 20, padding: 16, marginTop: 10, gap: 12 }}>
                <Text style={{ color: '#fff', fontSize: 14, fontFamily: F.semibold }}>Quel chiffre veux-tu atteindre ?</Text>
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
                        <Text style={[s.durationPillText, convUnit === u && s.durationPillTextActive]}>{u}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <TouchableOpacity onPress={() => setConverting(false)} style={[s.durationPill, { flex: 1, alignItems: 'center' }]}>
                    <Text style={s.durationPillText}>Annuler</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={convert} style={[s.durationPill, s.durationPillActive, { flex: 1, alignItems: 'center' }]}>
                    <Text style={[s.durationPillText, s.durationPillTextActive]}>Valider</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </>}

          {/* Caption */}
          <Text style={[s.postLabel, { marginTop: 28 }]}>LÉGENDE</Text>
          <TextInput
            style={s.postCaptionInput}
            placeholder="Décris ta séance, ton ressenti..."
            placeholderTextColor="#666"
            value={caption}
            onChangeText={setCaption}
            multiline
            maxLength={300}
          />
        </View>
      </ScrollView>

      <View style={[s.ctaContainer, { paddingBottom: Math.max(insets.bottom, 20) }]}>
        <TouchableOpacity
          style={[s.cta, (!obj || publishing || uploadingPhoto) && s.btnDisabled]}
          onPress={!obj || publishing || uploadingPhoto ? undefined : handlePublish}>
          {publishing || uploadingPhoto
            ? <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <ActivityIndicator color="#000" />
                {uploadingPhoto && mediaType === 'video' && <Text style={s.ctaText}>Compression et envoi de la vidéo...</Text>}
              </View>
            : <Text style={s.ctaText}>Publier</Text>}
        </TouchableOpacity>
      </View>
      <ShareStoryModal visible={!!story} data={story} onClose={() => { setStory(null); onPublish(); }} />
    </KeyboardAvoidingView>
  );
}

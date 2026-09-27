import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput, Image, Alert, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { supabase } from '../lib/supabase';
import { frError } from '../lib/helpers';
import { uploadImage, uploadFile, signMany } from '../lib/storage';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Objective } from '../lib/types';
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

// Séance en duo : 3 amis identifiés maximum (vérifié aussi côté serveur).
const MAX_DUO = 3;

export function PostScreen({ onBack, onPublish, duoWith }: { onBack: () => void, onPublish: () => void, duoWith?: string | null }) {
  const insets = useSafeAreaInsets();
  const [selectedObj, setSelectedObj] = useState(0);
  const [objectives, setObjectives] = useState<Objective[]>([]);
  const [loadingObj, setLoadingObj] = useState(true);
  const [value, setValue] = useState(0);
  const [caption, setCaption] = useState('');
  const [publishing, setPublishing] = useState(false);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<'image' | 'video'>('image');
  // Amis du cercle, pour « Avec qui ? ». Réponse à un duo : l'auteur est déjà coché.
  const [friends, setFriends] = useState<{ id: string; full_name: string; avatar_url?: string | null }[]>([]);
  const [withIds, setWithIds] = useState<string[]>(duoWith ? [duoWith] : []);
  // Ton cercle proche : un objectif « Cercle proche » ne peut identifier que lui.
  const [closeIds, setCloseIds] = useState<Set<string>>(new Set());
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoadingObj(false); return; }
      const { data, error } = await supabase.from('objectives').select('id, emoji, title, current_value, target_value, unit, visibility').eq('user_id', user.id).order('created_at', { ascending: false });
      if (!error && data) setObjectives(data as Objective[]);
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
        const signed = await signMany(list.map(u => u.avatar_url));
        list.forEach(u => { if (u.avatar_url) u.avatar_url = signed[u.avatar_url] ?? null; });
        // L'ami du duo en premier, pour qu'on le voie coché sans faire défiler.
        if (duoWith) list.sort((a, b) => (a.id === duoWith ? -1 : b.id === duoWith ? 1 : 0));
        setFriends(list);
        const { data: cf } = await supabase.from('close_friends').select('friend_id').eq('owner_id', user.id);
        setCloseIds(new Set((cf || []).map((c: any) => c.friend_id)));
      }
    };
    load();
  }, []);

  const obj = objectives[selectedObj];
  // Un objectif privé n'est visible que par soi : identifier quelqu'un n'aurait pas de sens.
  const taggable = obj?.visibility === 'close' ? friends.filter(f => closeIds.has(f.id)) : friends;
  const canTag = !!obj && obj.visibility !== 'private' && taggable.length > 0;

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
  const step = isPercent ? 5 : 1;
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
    const isMov = /\.mov$/i.test(uri);
    const { path, error } = mediaType === 'video'
      ? await uploadFile(`${userId}/${Date.now()}.${isMov ? 'mov' : 'mp4'}`, uri, isMov ? 'video/quicktime' : 'video/mp4')
      : await uploadImage(`${userId}/${Date.now()}.jpg`, uri);
    setUploadingPhoto(false);
    if (error) { Alert.alert('Erreur upload', frError(error)); return null; }
    return path;
  };

  const handlePublish = async () => {
    if (!obj) { Alert.alert('Erreur', 'Sélectionne un objectif.'); return; }
    setPublishing(true);
    const { data: { user } } = await supabase.auth.getUser();
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
      await supabase.from('objectives').update({ current_value: absoluteValue }).eq('id', obj.id);
    }
    setPublishing(false);
    if (error) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      Alert.alert('Erreur', frError(error));
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      Alert.alert('Publié', 'Ta mise à jour est en ligne.');
      onPublish();
    }
  };

  return (
    <KeyboardAvoidingView style={s.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={[s.header, { paddingTop: insets.top + 6 }]}>
        <TouchableOpacity style={s.backBtn} onPress={onBack} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="chevron-back" size={20} color="#888" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Poste ta progression</Text>
        <View style={{ width: 34 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 + insets.bottom }}>
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
                onPress={() => { Haptics.selectionAsync().catch(() => {}); setValue(v => Math.max(0, v - step)); }}
              >
                <Ionicons name="remove" size={22} color="#fff" />
              </TouchableOpacity>
              <View style={s.postProgressCenter}>
                {isPercent ? (
                  <>
                    <Text style={s.postProgressPct}>{pct}%</Text>
                    <Text style={s.postProgressVal}>objectif {obj.target_value}%</Text>
                  </>
                ) : (
                  <>
                    <Text style={s.postProgressPct}>
                      {value}
                      <Text style={{ fontSize: 16, color: '#888', fontFamily: F.bold }}> {obj.unit}</Text>
                    </Text>
                    <Text style={s.postProgressVal}>sur {obj.target_value} {obj.unit} · {pct}%</Text>
                  </>
                )}
                <View style={s.postProgressBar}>
                  <View style={[s.postProgressFill, { width: `${pct}%` as any }]} />
                </View>
              </View>
              <TouchableOpacity
                style={s.postProgressBtn}
                onPress={() => { Haptics.selectionAsync().catch(() => {}); setValue(v => isPercent ? Math.min(100, v + step) : Math.min(target, v + step)); }}
              >
                <Ionicons name="add" size={22} color="#fff" />
              </TouchableOpacity>
            </View>
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
                {uploadingPhoto && mediaType === 'video' && <Text style={s.ctaText}>Envoi de la vidéo...</Text>}
              </View>
            : <Text style={s.ctaText}>Publier</Text>}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

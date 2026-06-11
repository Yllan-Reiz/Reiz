import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput, Image, Alert, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { supabase } from '../lib/supabase';
import { frError } from '../lib/helpers';
import { Objective } from '../lib/types';
import { s, F } from '../styles';

export function PostScreen({ onBack, onPublish }: { onBack: () => void, onPublish: () => void }) {
  const [selectedObj, setSelectedObj] = useState(0);
  const [objectives, setObjectives] = useState<Objective[]>([]);
  const [loadingObj, setLoadingObj] = useState(true);
  const [progress, setProgress] = useState(0);
  const [caption, setCaption] = useState('');
  const [publishing, setPublishing] = useState(false);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoadingObj(false); return; }
      const { data, error } = await supabase.from('objectives').select('id, emoji, title, current_value, target_value, unit, visibility').eq('user_id', user.id).order('created_at', { ascending: false });
      if (!error && data) setObjectives(data as Objective[]);
      setLoadingObj(false);
    };
    load();
  }, []);

  const obj = objectives[selectedObj];

  // Le compteur démarre sur la progression actuelle de l'objectif sélectionné :
  // publier sans toucher au compteur ne doit jamais faire reculer la progression.
  useEffect(() => {
    if (!obj) return;
    const pct = obj.target_value > 0 ? Math.min(Math.round((obj.current_value / obj.target_value) * 100), 100) : 0;
    setProgress(pct);
  }, [selectedObj, objectives]);

  const handlePickPhoto = async () => {
    Alert.alert('Ajouter une photo', 'Choisis une option', [
      {
        text: '📷 Prendre une photo',
        onPress: async () => {
          const { status } = await ImagePicker.requestCameraPermissionsAsync();
          if (status !== 'granted') { Alert.alert('Permission refusée', 'Active la caméra dans les réglages.'); return; }
          const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.7, allowsEditing: true, aspect: [4, 3] });
          if (!result.canceled) setPhotoUri(result.assets[0].uri);
        }
      },
      {
        text: '🖼️ Importer depuis la galerie',
        onPress: async () => {
          const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (status !== 'granted') { Alert.alert('Permission refusée', 'Active la galerie dans les réglages.'); return; }
          const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7, allowsEditing: true, aspect: [4, 3] });
          if (!result.canceled) setPhotoUri(result.assets[0].uri);
        }
      },
      { text: 'Annuler', style: 'cancel' }
    ]);
  };

  const uploadPhoto = async (uri: string, userId: string): Promise<string | null> => {
    try {
      setUploadingPhoto(true);
      const fileName = `${userId}/${Date.now()}.jpg`;
      const response = await fetch(uri);
      const arrayBuffer = await response.arrayBuffer();
      const { error } = await supabase.storage.from('updates').upload(fileName, arrayBuffer, { contentType: 'image/jpeg' });
      if (error) { Alert.alert('Erreur upload', frError(error)); setUploadingPhoto(false); return null; }
      const { data } = supabase.storage.from('updates').getPublicUrl(fileName);
      setUploadingPhoto(false);
      return data.publicUrl;
    } catch (e: any) { setUploadingPhoto(false); return null; }
  };

  const handlePublish = async () => {
    if (!obj) { Alert.alert('Erreur', 'Sélectionne un objectif.'); return; }
    setPublishing(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setPublishing(false); Alert.alert('Erreur', 'Tu dois être connecté.'); return; }
    let photoUrl: string | null = null;
    if (photoUri) photoUrl = await uploadPhoto(photoUri, user.id);
    // progress_value = pourcentage (0-100), c'est ce que le feed affiche.
    // current_value = valeur absolue dans l'unité de l'objectif (km, livres...), affichée sur le profil.
    const absoluteValue = Math.round((progress / 100) * obj.target_value * 10) / 10;
    const { error } = await supabase.from('updates').insert({
      user_id: user.id, objective_id: obj.id,
      caption: caption || obj.title,
      progress_value: progress,
      photo_url: photoUrl,
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
      Alert.alert('Publié ! 🚀', 'Ta mise à jour est en ligne.');
      onPublish();
    }
  };

  return (
    <KeyboardAvoidingView style={s.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={onBack}><Text style={s.backText}>←</Text></TouchableOpacity>
        <Text style={s.headerTitle}>Poste ta progression</Text>
        <View style={{ width: 34 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
        {/* Photo */}
        <TouchableOpacity style={s.postPhotoZone} onPress={handlePickPhoto} activeOpacity={0.85}>
          {photoUri
            ? <>
                <Image source={{ uri: photoUri }} style={s.postPhotoImg} resizeMode="cover" />
                <View style={s.postPhotoChangeBadge}>
                  <Text style={s.postPhotoChangeText}>Changer</Text>
                </View>
              </>
            : <View style={s.postPhotoEmpty}>
                <Text style={s.postPhotoEmptyIcon}>📷</Text>
                <Text style={s.postPhotoEmptyText}>Ajoute une photo</Text>
                <Text style={s.postPhotoEmptyHint}>Optionnel — mais fortement recommandé</Text>
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
                  <Text style={{ color: '#888', fontSize: 13 }}>Aucun objectif — crée-en un dans "Mes objectifs"</Text>
                </View>
              : <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.postObjScroll} contentContainerStyle={{ gap: 10 }}>
                  {objectives.map((o, i) => (
                    <TouchableOpacity key={o.id} style={[s.postObjCard, selectedObj === i && s.postObjCardActive]} onPress={() => setSelectedObj(i)}>
                      <Text style={s.postObjEmoji}>{o.emoji}</Text>
                      <Text style={[s.postObjTitle, selectedObj === i && s.postObjTitleActive]} numberOfLines={2}>{o.title}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
          }

          {/* Progression */}
          {obj && <>
            <Text style={[s.postLabel, { marginTop: 28 }]}>PROGRESSION</Text>
            <View style={s.postProgressWrap}>
              <TouchableOpacity style={s.postProgressBtn} onPress={() => setProgress(p => Math.max(0, p - 5))}>
                <Text style={s.postProgressBtnText}>−</Text>
              </TouchableOpacity>
              <View style={s.postProgressCenter}>
                {obj.unit === '%' ? (
                  <>
                    <Text style={s.postProgressPct}>{progress}%</Text>
                    <Text style={s.postProgressVal}>objectif {obj.target_value}%</Text>
                  </>
                ) : (
                  <>
                    <Text style={s.postProgressPct}>
                      {Math.round((progress / 100) * obj.target_value * 10) / 10}
                      <Text style={{ fontSize: 16, color: '#888', fontFamily: F.bold }}> {obj.unit}</Text>
                    </Text>
                    <Text style={s.postProgressVal}>{progress}% · objectif {obj.target_value} {obj.unit}</Text>
                  </>
                )}
                <View style={s.postProgressBar}>
                  <View style={[s.postProgressFill, { width: `${progress}%` as any }]} />
                </View>
              </View>
              <TouchableOpacity style={s.postProgressBtn} onPress={() => setProgress(p => Math.min(100, p + 5))}>
                <Text style={s.postProgressBtnText}>+</Text>
              </TouchableOpacity>
            </View>
          </>}

          {/* Caption */}
          <Text style={[s.postLabel, { marginTop: 28 }]}>CAPTION</Text>
          <TextInput
            style={s.postCaptionInput}
            placeholder="Décris ta séance, ton ressenti..."
            placeholderTextColor="#666"
            value={caption}
            onChangeText={setCaption}
            multiline
          />
        </View>
      </ScrollView>

      <View style={s.ctaContainer}>
        <TouchableOpacity
          style={[s.cta, (!obj || publishing || uploadingPhoto) && s.btnDisabled]}
          onPress={!obj || publishing || uploadingPhoto ? undefined : handlePublish}>
          {publishing || uploadingPhoto
            ? <ActivityIndicator color="#000" />
            : <Text style={s.ctaText}>Publier</Text>}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

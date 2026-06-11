import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput, Image, Alert, ActivityIndicator, RefreshControl } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../lib/supabase';
import { frError } from '../lib/helpers';
import { Objective } from '../lib/types';
import { HEATMAP_MAX_DAYS, daysFor, dayKeysFor } from '../constants';
import { s } from '../styles';
import { ProfileSkeleton } from '../components/Skeleton';

export function ProfileScreen({ onClose, streak, onCreateObjective }: { onClose: () => void; streak: number; onCreateObjective: () => void }) {
  const [profile, setProfile] = useState<any>(null);
  const [objectives, setObjectives] = useState<Objective[]>([]);
  const [activityByObj, setActivityByObj] = useState<Record<string, Set<string>>>({});
  const [friendCount, setFriendCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [editingName, setEditingName] = useState(false);
  const [newName, setNewName] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [refreshingProfile, setRefreshingProfile] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => { loadProfile(); }, []);

  const loadProfile = async (silent = false) => {
    if (!silent) setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }
    const sinceISO = new Date(Date.now() - HEATMAP_MAX_DAYS * 24 * 60 * 60 * 1000).toISOString();
    const [profileRes, objRes, updatesRes, friendsRes] = await Promise.all([
      supabase.from('users').select('full_name, username, created_at, avatar_url').eq('id', user.id).single(),
      supabase.from('objectives').select('id, emoji, title, current_value, target_value, unit, visibility, duration_days').eq('user_id', user.id).order('created_at', { ascending: false }),
      supabase.from('updates').select('objective_id, created_at').eq('user_id', user.id).gte('created_at', sinceISO),
      supabase.from('friendships').select('id').or(`requester_id.eq.${user.id},receiver_id.eq.${user.id}`).eq('status', 'accepted'),
    ]);
    if (profileRes.data) { setProfile(profileRes.data); setNewName(profileRes.data.full_name); }
    if (objRes.data) setObjectives(objRes.data as Objective[]);
    if (updatesRes.data) {
      const map: Record<string, Set<string>> = {};
      (updatesRes.data as { objective_id: string; created_at: string }[]).forEach(u => {
        if (!u.objective_id) return;
        const key = new Date(u.created_at).toDateString();
        if (!map[u.objective_id]) map[u.objective_id] = new Set<string>();
        map[u.objective_id].add(key);
      });
      setActivityByObj(map);
    }
    if (friendsRes.data) setFriendCount(friendsRes.data.length);
    setLoading(false);
  };

  const handleSaveName = async () => {
    if (!newName.trim()) return;
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); return; }
    await supabase.from('users').update({ full_name: newName.trim() }).eq('id', user.id);
    setSaving(false); setEditingName(false); loadProfile();
  };

  const handlePickAvatar = async () => {
    Alert.alert('Photo de profil', 'Choisis une option', [
      {
        text: '📷 Prendre une photo',
        onPress: async () => {
          const { status } = await ImagePicker.requestCameraPermissionsAsync();
          if (status !== 'granted') { Alert.alert('Permission refusée', 'Active la caméra dans les réglages.'); return; }
          const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.7, allowsEditing: true, aspect: [1, 1] });
          if (!result.canceled) uploadAvatar(result.assets[0].uri);
        }
      },
      {
        text: '🖼️ Importer depuis la galerie',
        onPress: async () => {
          const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (status !== 'granted') { Alert.alert('Permission refusée', 'Active la galerie dans les réglages.'); return; }
          const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7, allowsEditing: true, aspect: [1, 1] });
          if (!result.canceled) uploadAvatar(result.assets[0].uri);
        }
      },
      { text: 'Annuler', style: 'cancel' }
    ]);
  };

  const uploadAvatar = async (uri: string) => {
    setUploadingAvatar(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const fileName = `avatars/${user.id}.jpg`;
      const response = await fetch(uri);
      const arrayBuffer = await response.arrayBuffer();
      const { error: upErr } = await supabase.storage.from('updates').upload(fileName, arrayBuffer, { contentType: 'image/jpeg', upsert: true });
      if (upErr) throw upErr;
      const { data } = supabase.storage.from('updates').getPublicUrl(fileName);
      // ?t=... force le rafraîchissement : sans ça, le cache d'images garde l'ancienne photo
      await supabase.from('users').update({ avatar_url: `${data.publicUrl}?t=${Date.now()}` }).eq('id', user.id);
      loadProfile();
    } catch (e: any) {
      Alert.alert('Erreur', frError(e));
    }
    setUploadingAvatar(false);
  };

  const handleSignOut = async () => {
    Alert.alert('Déconnexion', 'Tu veux vraiment te déconnecter ?', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Se déconnecter', style: 'destructive', onPress: () => supabase.auth.signOut() }
    ]);
  };

  // Obligatoire pour l'App Store : l'utilisateur doit pouvoir supprimer son compte.
  // La suppression réelle est faite côté serveur (edge function "delete-account").
  const handleDeleteAccount = () => {
    Alert.alert(
      'Supprimer mon compte',
      'Toutes tes données (posts, objectifs, amis, photos) seront définitivement effacées. Cette action est irréversible.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer définitivement', style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            const { error } = await supabase.functions.invoke('delete-account');
            setDeleting(false);
            if (error) { Alert.alert('Erreur', 'La suppression a échoué. Réessaie ou contacte-nous.'); return; }
            supabase.auth.signOut().catch(() => {});
          },
        },
      ]
    );
  };

  const progressPct = (o: Objective) => o.target_value > 0 ? Math.min(Math.round((o.current_value / o.target_value) * 100), 100) : 0;
  const initial = profile?.full_name?.charAt(0).toUpperCase() || '?';
  const memberSince = profile?.created_at ? new Date(profile.created_at).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }) : '';

  return (
    <View style={s.container}>
      {loading ? (
        <ProfileSkeleton />
      ) : (
        <ScrollView
          style={s.feed}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshingProfile}
              onRefresh={async () => { setRefreshingProfile(true); await loadProfile(true); setRefreshingProfile(false); }}
              tintColor="#fff" colors={['#fff']} progressBackgroundColor="#1a1a1a"
            />
          }
        >
          <View style={s.profileHero}>
            <TouchableOpacity style={s.profileAvatarWrap} onPress={handlePickAvatar} activeOpacity={0.8}>
              {profile?.avatar_url
                ? <Image source={{ uri: profile.avatar_url }} style={s.profileAvatarImg} />
                : <View style={s.profileAvatar}><Text style={s.profileAvatarText}>{initial}</Text></View>
              }
              {uploadingAvatar
                ? <View style={s.profileAvatarOverlay}><ActivityIndicator color="#fff" /></View>
                : <View style={s.profileAvatarOverlay}><Text style={s.profileAvatarEditIcon}>📷</Text></View>
              }
            </TouchableOpacity>
            {editingName ? (
              <View style={s.profileNameEdit}>
                <TextInput style={s.profileNameInput} value={newName} onChangeText={setNewName} autoFocus autoCapitalize="words" placeholderTextColor="#666" />
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <TouchableOpacity style={s.profileSaveBtn} onPress={saving ? undefined : handleSaveName}>
                    {saving ? <ActivityIndicator color="#000" size="small" /> : <Text style={s.profileSaveBtnText}>Sauvegarder</Text>}
                  </TouchableOpacity>
                  <TouchableOpacity style={s.profileCancelBtn} onPress={() => { setEditingName(false); setNewName(profile?.full_name || ''); }}>
                    <Text style={s.profileCancelBtnText}>Annuler</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <TouchableOpacity onPress={() => setEditingName(true)}>
                <Text style={s.profileName}>{profile?.full_name || 'Utilisateur'}</Text>
                <Text style={s.profileEditHint}>Appuie pour modifier ✏️</Text>
              </TouchableOpacity>
            )}
            <Text style={s.profileUsername}>@{profile?.username}</Text>
            <Text style={s.profileMember}>Membre depuis {memberSince}</Text>
          </View>

          <View style={s.statsRow}>
            <View style={s.statPill}><Text style={s.statVal}>🔥 {streak}j</Text><Text style={s.statLbl}>Streak</Text></View>
            <View style={s.statPill}><Text style={s.statVal}>{objectives.length}</Text><Text style={s.statLbl}>Objectifs</Text></View>
            <View style={s.statPill}><Text style={s.statVal}>{friendCount}</Text><Text style={s.statLbl}>Amis</Text></View>
          </View>

          {objectives.length === 0 ? (
            <View style={s.emptyState}>
              <Text style={s.emptyStateTitle}>Pose ton premier objectif</Text>
              <Text style={s.emptyStateText}>Choisis ce que tu veux dépasser. Ton cercle te suivra chaque jour.</Text>
              <TouchableOpacity style={s.emptyStateBtn} onPress={onCreateObjective}>
                <Text style={s.emptyStateBtnText}>Aller à mes objectifs →</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <Text style={s.sectionTitle}>MES OBJECTIFS</Text>
              {objectives.map((o) => {
                const set = activityByObj[o.id] || new Set<string>();
                const nbDays = daysFor(o);
                const dayKeys = dayKeysFor(nbDays);
                const doneCount = dayKeys.filter(d => set.has(d)).length;
                const pct = progressPct(o);
                const isInfinite = o.duration_days == null;
                return (
                  <View key={o.id} style={s.objCardProfile}>
                    <View style={s.objCardProfileHead}>
                      <Text style={s.objCardProfileTitle} numberOfLines={1}>{o.emoji} {o.title}</Text>
                      <Text style={s.objCardProfilePct}>{pct}%</Text>
                    </View>
                    <View style={s.progressBg}><View style={[s.progressFill, { width: `${pct}%` as any }]} /></View>
                    <View style={s.heatGrid}>
                      {dayKeys.map((d, i) => (
                        <View key={i} style={[s.heatCell, set.has(d) && s.heatCellActive]} />
                      ))}
                    </View>
                    <Text style={s.objCardProfileFoot}>
                      {doneCount} jours {isInfinite ? `sur les ${nbDays} derniers` : `sur ${nbDays}`}
                    </Text>
                  </View>
                );
              })}
            </>
          )}

          <TouchableOpacity style={s.signOutBtn} onPress={handleSignOut}>
            <Text style={s.signOutBtnText}>Se déconnecter</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.dangerBtn} onPress={deleting ? undefined : handleDeleteAccount}>
            {deleting ? <ActivityIndicator color="#ff3b30" size="small" /> : <Text style={s.dangerBtnText}>Supprimer mon compte</Text>}
          </TouchableOpacity>
          <View style={{ height: 60 }} />
        </ScrollView>
      )}
    </View>
  );
}

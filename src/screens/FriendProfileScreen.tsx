import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Image, Alert, ActivityIndicator } from 'react-native';
import { supabase } from '../lib/supabase';
import { calculateStreak, timeAgo, frError } from '../lib/helpers';
import { Update, Objective } from '../lib/types';
import { s } from '../styles';

export function FriendProfileScreen({ userId, onClose }: { userId: string; onClose: () => void }) {
  const [profile, setProfile] = useState<any>(null);
  const [objectives, setObjectives] = useState<Objective[]>([]);
  const [recentUpdates, setRecentUpdates] = useState<Update[]>([]);
  const [friendCount, setFriendCount] = useState(0);
  const [streak, setStreak] = useState(0);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setCurrentUserId(user.id);
      const [profileRes, objRes, updatesRes, friendsRes] = await Promise.all([
        supabase.from('users').select('full_name, username, created_at, avatar_url').eq('id', userId).single(),
        supabase.from('objectives').select('id, emoji, title, current_value, target_value, unit, visibility').eq('user_id', userId).in('visibility', ['public', 'friends']).order('created_at', { ascending: false }),
        supabase.from('updates').select('id, caption, progress_value, created_at, photo_url, objectives(visibility), users(full_name)').eq('user_id', userId).order('created_at', { ascending: false }).limit(10),
        supabase.from('friendships').select('id').or(`requester_id.eq.${userId},receiver_id.eq.${userId}`).eq('status', 'accepted'),
      ]);
      if (profileRes.data) setProfile(profileRes.data);
      if (objRes.data) setObjectives(objRes.data as Objective[]);
      if (updatesRes.data) setRecentUpdates((updatesRes.data as unknown as Update[]).filter(u => u.objectives?.visibility !== 'private').slice(0, 5));
      if (friendsRes.data) setFriendCount(friendsRes.data.length);
      const streakVal = await calculateStreak(userId);
      setStreak(streakVal);
      setLoading(false);
    };
    load();
  }, [userId]);

  const reportProfile = () => {
    const send = async (reason: string) => {
      if (!currentUserId) return;
      const { error } = await supabase.from('reports').insert({ reporter_id: currentUserId, reported_user_id: userId, reason });
      if (error) Alert.alert('Erreur', frError(error));
      else Alert.alert('Merci 🙏', 'Ton signalement a bien été envoyé.');
    };
    Alert.alert('Signaler ce profil', 'Pourquoi signales-tu ce profil ?', [
      { text: 'Spam', onPress: () => send('spam') },
      { text: 'Comportement inapproprié', onPress: () => send('inapproprié') },
      { text: 'Autre', onPress: () => send('autre') },
      { text: 'Annuler', style: 'cancel' },
    ]);
  };

  const blockProfile = () => {
    Alert.alert(`Bloquer ${profile?.full_name || 'cet utilisateur'}`, 'Vous ne verrez plus les contenus l\'un de l\'autre.', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Bloquer', style: 'destructive',
        onPress: async () => {
          if (!currentUserId) return;
          const { error } = await supabase.from('blocks').insert({ blocker_id: currentUserId, blocked_id: userId });
          if (error && !/duplicate key/i.test(error.message || '')) { Alert.alert('Erreur', frError(error)); return; }
          // On supprime aussi le lien d'amitié éventuel
          await supabase.from('friendships').delete().or(`and(requester_id.eq.${currentUserId},receiver_id.eq.${userId}),and(requester_id.eq.${userId},receiver_id.eq.${currentUserId})`);
          onClose();
        },
      },
    ]);
  };

  const openMenu = () => {
    Alert.alert(profile?.full_name || 'Profil', undefined, [
      { text: 'Signaler le profil', onPress: reportProfile },
      { text: 'Bloquer', style: 'destructive', onPress: blockProfile },
      { text: 'Annuler', style: 'cancel' },
    ]);
  };

  const progressPct = (o: Objective) => o.target_value > 0 ? Math.min(Math.round((o.current_value / o.target_value) * 100), 100) : 0;
  const initial = profile?.full_name?.charAt(0).toUpperCase() || '?';
  const memberSince = profile?.created_at ? new Date(profile.created_at).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }) : '';

  return (
    <View style={s.container}>
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={onClose}><Text style={s.backText}>←</Text></TouchableOpacity>
        <Text style={s.headerTitle}>{profile?.full_name || 'Profil'}</Text>
        <TouchableOpacity style={s.backBtn} onPress={openMenu}><Text style={s.backText}>⋯</Text></TouchableOpacity>
      </View>
      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color="#fff" /></View>
      ) : (
        <ScrollView style={s.feed} showsVerticalScrollIndicator={false}>
          <View style={s.profileHero}>
            <View style={s.profileAvatarWrap}>
              {profile?.avatar_url
                ? <Image source={{ uri: profile.avatar_url }} style={s.profileAvatarImg} />
                : <View style={s.profileAvatar}><Text style={s.profileAvatarText}>{initial}</Text></View>
              }
            </View>
            <Text style={s.profileName}>{profile?.full_name || 'Utilisateur'}</Text>
            <Text style={s.profileUsername}>@{profile?.username}</Text>
            <Text style={s.profileMember}>Membre depuis {memberSince}</Text>
          </View>

          <View style={s.statsRow}>
            <View style={s.statPill}><Text style={s.statVal}>🔥 {streak}j</Text><Text style={s.statLbl}>Streak</Text></View>
            <View style={s.statPill}><Text style={s.statVal}>{objectives.length}</Text><Text style={s.statLbl}>Objectifs</Text></View>
            <View style={s.statPill}><Text style={s.statVal}>{friendCount}</Text><Text style={s.statLbl}>Amis</Text></View>
          </View>

          <Text style={s.sectionTitle}>SES OBJECTIFS</Text>
          {objectives.length === 0 ? (
            <View style={{ paddingVertical: 20, alignItems: 'center' }}><Text style={{ color: '#888', fontSize: 13 }}>Pas d'objectifs visibles</Text></View>
          ) : objectives.map((o) => (
            <View key={o.id} style={s.profileObjRow}>
              <Text style={s.profileObjEmoji}>{o.emoji}</Text>
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={s.profileObjName}>{o.title}</Text>
                <View style={s.progressBg}><View style={[s.progressFill, { width: `${progressPct(o)}%` as any }]} /></View>
              </View>
              <Text style={s.profileObjPct}>{progressPct(o)}%</Text>
            </View>
          ))}

          <Text style={s.sectionTitle}>PUBLICATIONS RÉCENTES</Text>
          {recentUpdates.length === 0 ? (
            <View style={{ paddingVertical: 20, alignItems: 'center' }}><Text style={{ color: '#888', fontSize: 13 }}>Pas de publication pour l'instant</Text></View>
          ) : recentUpdates.map((u) => (
            <View key={u.id} style={s.profileUpdateRow}>
              {u.photo_url && <Image source={{ uri: u.photo_url }} style={s.profileUpdatePhoto} resizeMode="cover" />}
              <View style={{ flex: 1 }}>
                <Text style={s.profileUpdateCaption} numberOfLines={2}>{u.caption}</Text>
                <Text style={s.profileUpdateTime}>{timeAgo(u.created_at)}</Text>
              </View>
              <View style={s.profileProgressBadge}><Text style={s.profileProgressBadgeText}>{u.progress_value || 0}%</Text></View>
            </View>
          ))}
          <View style={{ height: 80 }} />
        </ScrollView>
      )}
    </View>
  );
}

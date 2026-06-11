import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput, Image, Alert, ActivityIndicator, RefreshControl, Share } from 'react-native';
import { supabase } from '../lib/supabase';
import { frError } from '../lib/helpers';
import { Friend, PendingRequest } from '../lib/types';
import { LANDING_URL } from '../constants';
import { s, F } from '../styles';

export function FriendsTab({ onViewProfile, onPendingCount }: { onViewProfile: (userId: string) => void; onPendingCount?: (n: number) => void }) {
  const [friends, setFriends] = useState<Friend[]>([]);
  const [pending, setPending] = useState<PendingRequest[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [refreshingFriends, setRefreshingFriends] = useState(false);
  const [blockedIds, setBlockedIds] = useState<Set<string>>(new Set());
  const [myUsername, setMyUsername] = useState<string | null>(null);

  // Le @pseudo sert de code d'invitation : l'ami télécharge l'app puis le cherche.
  const inviteFriends = async () => {
    const tag = myUsername ? `@${myUsername}` : 'mon prénom';
    try {
      await Share.share({
        message: `Rejoins mon cercle sur Reiz 💪 Je poste ma progression chaque jour — et toi ?\n\n1. Télécharge l'app : ${LANDING_URL}\n2. Dans l'onglet Amis, cherche ${tag} et ajoute-moi !`,
      });
    } catch {}
  };

  // Helpers d'avatar (image si dispo, sinon initiale)
  const RowAvatar = ({ url, name, active }: { url?: string | null; name: string; active?: boolean }) =>
    url
      ? <Image source={{ uri: url }} style={[s.friendRowAvImg, active && s.friendRowAvActive]} />
      : <View style={[s.friendRowAv, active && s.friendRowAvActive]}><Text style={s.friendRowAvText}>{name.charAt(0).toUpperCase()}</Text></View>;
  const SuggestAvatar = ({ url, name }: { url?: string | null; name: string }) =>
    url
      ? <Image source={{ uri: url }} style={s.suggestAvImg} />
      : <View style={s.suggestAv}><Text style={s.suggestAvText}>{name.charAt(0).toUpperCase()}</Text></View>;

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setCurrentUserId(user.id);
        supabase.from('users').select('username').eq('id', user.id).single()
          .then(({ data }) => { if (data) setMyUsername(data.username); });
        // Utilisateurs que j'ai bloqués : exclus de la recherche et des suggestions
        const { data: blocks } = await supabase.from('blocks').select('blocked_id').eq('blocker_id', user.id);
        const blocked = new Set<string>((blocks || []).map((b: any) => b.blocked_id));
        setBlockedIds(blocked);
        fetchFriends(user.id);
      }
    };
    init();
  }, []);

  const fetchFriends = async (uid: string, silent = false) => {
    if (!silent) setLoading(true);
    const { data, error } = await supabase
      .from('friendships')
      .select('id, status, requester_id, receiver_id, requester:users!friendships_requester_id_fkey(id, full_name, username, avatar_url), receiver:users!friendships_receiver_id_fkey(id, full_name, username, avatar_url)')
      .or(`requester_id.eq.${uid},receiver_id.eq.${uid}`);
    if (!error && data) {
      const accepted: Friend[] = [];
      const pendingReqs: PendingRequest[] = [];
      data.forEach((f: any) => {
        const isRequester = f.requester_id === uid;
        const other = isRequester ? f.receiver : f.requester;
        if (!other) return;
        if (f.status === 'accepted') accepted.push({ id: other.id, full_name: other.full_name, username: other.username, friendship_id: f.id, status: f.status, is_requester: isRequester, avatar_url: other.avatar_url });
        else if (f.status === 'pending' && !isRequester) pendingReqs.push({ id: other.id, full_name: other.full_name, username: other.username, friendship_id: f.id, avatar_url: other.avatar_url });
      });
      setFriends(accepted); setPending(pendingReqs);
      onPendingCount?.(pendingReqs.length);
      loadSuggestions(uid, accepted.map(f => f.id));
    }
    setLoading(false);
  };

  const loadSuggestions = async (uid: string, friendIds: string[]) => {
    const { data: myObjs } = await supabase.from('objectives').select('title').eq('user_id', uid);
    if (!myObjs || myObjs.length === 0) return;
    const myKeywords = myObjs.flatMap((o: any) => o.title.toLowerCase().split(/\s+/)).filter((w: string) => w.length > 3);
    // Uniquement les objectifs publics : on ne révèle jamais les objectifs privés ou réservés aux amis.
    const { data } = await supabase.from('objectives').select('user_id, title, users!inner(id, full_name, username, avatar_url)').neq('user_id', uid).eq('visibility', 'public').limit(40);
    if (!data) return;
    const excluded = new Set([uid, ...friendIds, ...blockedIds]);
    const seen = new Set<string>();
    const result: any[] = [];
    for (const o of data as any[]) {
      if (excluded.has(o.user_id) || seen.has(o.user_id)) continue;
      seen.add(o.user_id);
      const objWords = o.title.toLowerCase().split(/\s+/);
      const match = myKeywords.some((k: string) => objWords.some((w: string) => w.includes(k) || k.includes(w)));
      result.push({ ...o.users, objectiveTitle: o.title, match });
    }
    result.sort((a, b) => Number(b.match) - Number(a.match));
    setSuggestions(result.slice(0, 6));
  };

  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    // "@pseudo" fonctionne comme un code d'invitation ; on nettoie aussi les
    // caractères qui casseraient le filtre "or" de Supabase (virgules, parenthèses).
    const q = query.trim().replace(/^@/, '').replace(/[,()%]/g, '');
    if (q.length < 2) { setSearchResults([]); return; }
    setSearching(true);
    let req = supabase.from('users').select('id, full_name, username, avatar_url')
      .or(`full_name.ilike.%${q}%,username.ilike.%${q}%`)
      .limit(8);
    if (currentUserId) req = req.neq('id', currentUserId);
    const { data, error } = await req;
    if (!error && data) setSearchResults(data.filter((u: any) => !blockedIds.has(u.id)));
    setSearching(false);
  };

  const sendFriendRequest = async (receiverId: string) => {
    if (!currentUserId) return;
    const { error } = await supabase.from('friendships').insert({ requester_id: currentUserId, receiver_id: receiverId, status: 'pending' });
    if (error) { if (error.code === '23505') Alert.alert('Déjà envoyé', 'Une demande est déjà en cours.'); else Alert.alert('Erreur', frError(error)); return; }
    Alert.alert('Demande envoyée ! 🤝', 'En attente de confirmation.');
    setSearchResults([]); setSearchQuery('');
  };

  const acceptRequest = async (friendshipId: string) => {
    await supabase.from('friendships').update({ status: 'accepted' }).eq('id', friendshipId);
    if (currentUserId) fetchFriends(currentUserId);
  };

  const declineRequest = async (friendshipId: string) => {
    await supabase.from('friendships').delete().eq('id', friendshipId);
    if (currentUserId) fetchFriends(currentUserId);
  };

  const removeFriend = async (friendshipId: string, friendName: string) => {
    Alert.alert('Supprimer', `Retirer ${friendName} de tes amis ?`, [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Supprimer', style: 'destructive', onPress: async () => {
        await supabase.from('friendships').delete().eq('id', friendshipId);
        if (currentUserId) fetchFriends(currentUserId);
      }}
    ]);
  };

  const getFriendshipStatus = (userId: string) => friends.find(f => f.id === userId) ? 'ami' : null;

  return (
    <ScrollView
      style={s.feed}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingBottom: 110 }}
      refreshControl={
        <RefreshControl
          refreshing={refreshingFriends}
          onRefresh={async () => {
            if (!currentUserId) return;
            setRefreshingFriends(true);
            await fetchFriends(currentUserId, true);
            setRefreshingFriends(false);
          }}
          tintColor="#fff" colors={['#fff']} progressBackgroundColor="#1a1a1a"
        />
      }
    >

      {/* Invitation du cercle */}
      <TouchableOpacity style={s.myUpdate} onPress={inviteFriends} activeOpacity={0.85}>
        <View style={s.myUpdateInfo}>
          <Text style={s.myUpdateTitle}>Invite ton cercle 🤝</Text>
          <Text style={s.myUpdateSub}>Reiz marche mieux quand tes proches te regardent</Text>
        </View>
        <View style={s.postedBadge}><Text style={s.postedBadgeText}>Partager →</Text></View>
      </TouchableOpacity>

      {/* Barre de recherche */}
      <View style={s.searchBarActive}>
        <Text style={s.searchIcon}>🔍</Text>
        <TextInput style={s.searchInput} placeholder="Prénom ou @pseudo..." placeholderTextColor="#666" value={searchQuery} onChangeText={handleSearch} autoCapitalize="none" />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => { setSearchQuery(''); setSearchResults([]); }}>
            <Text style={{ color: '#777', fontSize: 16 }}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Résultats de recherche */}
      {searchResults.length > 0 && (
        <View style={{ marginBottom: 8 }}>
          <Text style={s.sectionTitle}>RÉSULTATS</Text>
          {searching && <ActivityIndicator color="#fff" style={{ marginBottom: 10 }} />}
          {searchResults.map((u) => (
            <TouchableOpacity key={u.id} style={s.friendRow} onPress={() => onViewProfile(u.id)} activeOpacity={0.8}>
              <RowAvatar url={u.avatar_url} name={u.full_name} />
              <View style={s.friendRowInfo}>
                <Text style={s.friendRowName}>{u.full_name}</Text>
                <Text style={s.friendRowSub}>@{u.username}</Text>
              </View>
              {getFriendshipStatus(u.id) === 'ami' ? (
                <View style={s.friendBadge}><Text style={s.friendBadgeText}>✓ Ami</Text></View>
              ) : (
                <TouchableOpacity style={s.addFriendBtn} onPress={() => sendFriendRequest(u.id)}>
                  <Text style={s.addFriendBtnText}>Ajouter</Text>
                </TouchableOpacity>
              )}
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Demandes reçues */}
      {pending.length > 0 && (
        <View style={{ marginBottom: 8 }}>
          <Text style={s.sectionTitle}>DEMANDES REÇUES · {pending.length}</Text>
          {pending.map((p) => (
            <View key={p.friendship_id} style={s.friendRow}>
              <RowAvatar url={p.avatar_url} name={p.full_name} active />
              <View style={s.friendRowInfo}>
                <Text style={s.friendRowName}>{p.full_name}</Text>
                <Text style={s.friendRowSub}>@{p.username}</Text>
              </View>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TouchableOpacity style={s.acceptBtn} onPress={() => acceptRequest(p.friendship_id)}>
                  <Text style={s.acceptBtnText}>✓</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.declineBtn} onPress={() => declineRequest(p.friendship_id)}>
                  <Text style={s.declineBtnText}>✕</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Découverte par objectif commun */}
      {suggestions.length > 0 && (
        <View style={{ marginBottom: 8 }}>
          <Text style={s.sectionTitle}>MÊME OBJECTIF</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.suggestScroll} contentContainerStyle={{ gap: 12 }}>
            {suggestions.map((u) => (
              <TouchableOpacity key={u.id} style={s.suggestCard} onPress={() => onViewProfile(u.id)} activeOpacity={0.8}>
                <SuggestAvatar url={u.avatar_url} name={u.full_name} />
                <Text style={s.suggestName} numberOfLines={1}>{u.full_name}</Text>
                <Text style={s.suggestObj} numberOfLines={2}>{u.objectiveTitle}</Text>
                <TouchableOpacity style={s.suggestAddBtn} onPress={() => sendFriendRequest(u.id)}>
                  <Text style={s.suggestAddText}>Ajouter</Text>
                </TouchableOpacity>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Liste d'amis */}
      <Text style={s.sectionTitle}>{friends.length > 0 ? `${friends.length} AMI${friends.length > 1 ? 'S' : ''}` : 'MES AMIS'}</Text>
      {loading ? (
        <View style={{ paddingTop: 20, alignItems: 'center' }}><ActivityIndicator color="#fff" /></View>
      ) : friends.length === 0 ? (
        <View style={{ paddingTop: 30, alignItems: 'center', gap: 8 }}>
          <Text style={{ fontSize: 36 }}>👥</Text>
          <Text style={{ color: '#888', fontSize: 15, fontFamily: F.bold }}>Pas encore d'amis</Text>
          <Text style={{ color: '#666', fontSize: 13 }}>Invite tes proches ou cherche-les par prénom</Text>
          <TouchableOpacity style={s.emptyStateBtn} onPress={inviteFriends}>
            <Text style={s.emptyStateBtnText}>Inviter mes amis →</Text>
          </TouchableOpacity>
        </View>
      ) : friends.map((f) => (
        <TouchableOpacity
          key={f.friendship_id}
          style={s.friendRow}
          onPress={() => onViewProfile(f.id)}
          onLongPress={() => removeFriend(f.friendship_id, f.full_name)}
          activeOpacity={0.8}
        >
          <RowAvatar url={f.avatar_url} name={f.full_name} active />
          <View style={s.friendRowInfo}>
            <Text style={s.friendRowName}>{f.full_name}</Text>
            <Text style={s.friendRowSub}>@{f.username}</Text>
          </View>
          <View style={s.friendBadge}><Text style={s.friendBadgeText}>✓</Text></View>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

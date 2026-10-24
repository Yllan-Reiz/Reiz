import { useState, useEffect, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { View, Text, TouchableOpacity, ScrollView, TextInput, Image, Alert, ActivityIndicator, RefreshControl, Share } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase, currentUser, storedUserId } from '../lib/supabase';
import { cacheGet, cacheSet } from '../lib/cache';
import { frError, sportName, localizeReason } from '../lib/helpers';
import { signAvatars, signOne } from '../lib/storage';
import { useCloseCircle, setClose } from '../lib/closeCircle';
import { contactsAvailable, contactsGranted, loadDeviceContacts, matchContacts } from '../lib/contacts';
import { ShareProfileSheet } from '../components/ShareProfileSheet';
import { ContactsScreen } from '../components/ContactsScreen';
import { GlassSurface } from '../components/GlassSurface';
import * as Haptics from 'expo-haptics';
import { Friend, PendingRequest } from '../lib/types';
import { APP_STORE_URL, GUTTER, navClearance, GLASS_FRIENDS } from '../constants';
import { FriendsGlassView } from '../components/FriendsGlassView';
import { s, F } from '../styles';
import { t, tp, dirIcon } from '../i18n';
import { CachedImage } from '../components/CachedImage';

export function FriendsTab({ onViewProfile, onPendingCount }: { onViewProfile: (userId: string) => void; onPendingCount?: (n: number) => void }) {
  const insets = useSafeAreaInsets();
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
  // Les suggestions attendent la liste des bloqués : jamais de personne bloquée proposée, même au premier
  // chargement (avant le 25/10/2026, elles lisaient une liste encore vide).
  const blockedReady = useRef<Promise<Set<string>>>(Promise.resolve(new Set()));
  const [myUsername, setMyUsername] = useState<string | null>(null);
  const [myName, setMyName] = useState('');
  const [myAvatar, setMyAvatar] = useState<string | null>(null);
  // La carte de partage façon BeReal (QR code, copier, WhatsApp, Messages).
  const [shareOpen, setShareOpen] = useState(false);
  // Demandes envoyées depuis les recommandations : le bouton passe à « Envoyé ».
  const [sentIds, setSentIds] = useState<Set<string>>(new Set());
  // Découverte : nouveaux inscrits, et le sport choisi dans les pastilles (recherche par mots du sport).
  const [newMembers, setNewMembers] = useState<any[]>([]);
  const [activeSport, setActiveSport] = useState<string | null>(null);
  // Mes contacts (module natif livré avec la 1.1.0 : l'entrée reste cachée sur les builds plus anciens).
  const [showContacts, setShowContacts] = useState(false);
  // Cercle proche : l'étoile à droite de chaque ami. Les proches passent en tête de liste.
  const { list: closeList, reload: reloadClose } = useCloseCircle();
  const closeIds = new Set((closeList || []).map(c => c.id));
  const toggleClose = async (id: string) => {
    Haptics.selectionAsync().catch(() => {});
    await setClose(id, !closeIds.has(id));
    reloadClose(true);
  };
  // Objectif en cours (jamais privé) pour personnaliser l'invitation.
  const [myTopObjective, setMyTopObjective] = useState<{ emoji: string; title: string } | null>(null);

  const inviteFriends = () => { Haptics.selectionAsync().catch(() => {}); setShareOpen(true); };

  // Ancien partage en texte (gardé pour l'ancien affichage, GLASS_FRIENDS = false).
  const inviteFriendsText = async () => {
    const hook = myTopObjective
      ? t('friends.shareHookObj', { title: myTopObjective.title })
      : t('friends.shareHook');
    const closer = myTopObjective
      ? t('friends.shareCloserObj')
      : t('friends.shareCloser');
    // Lien direct vers l'App Store, et le pseudo pour m'ajouter une fois l'app installée.
    const message =
      `${hook}\n\n` +
      `${t('friends.shareBody')}\n\n` +
      `${myUsername ? t('friends.shareJoinUser', { username: myUsername }) : t('friends.shareJoin')}\n` +
      `${APP_STORE_URL}\n\n` +
      `${closer}`;
    try {
      await Share.share({ message, title: t('friends.shareTitle') });
    } catch {}
  };

  // Helpers d'avatar (image si dispo, sinon initiale)
  const RowAvatar = ({ url, name, active }: { url?: string | null; name: string; active?: boolean }) =>
    url
      ? <CachedImage uri={url} style={[s.friendRowAvImg, active && s.friendRowAvActive]} />
      : <View style={[s.friendRowAv, active && s.friendRowAvActive]}><Text style={s.friendRowAvText}>{name.charAt(0).toUpperCase()}</Text></View>;
  const SuggestAvatar = ({ url, name }: { url?: string | null; name: string }) =>
    url
      ? <CachedImage uri={url} style={s.suggestAvImg} />
      : <View style={s.suggestAv}><Text style={s.suggestAvText}>{name.charAt(0).toUpperCase()}</Text></View>;

  useEffect(() => {
    const init = async () => {
      // Amis déjà vus : affichés tout de suite depuis la mémoire du téléphone, puis mis à jour en silence.
      const uid = await storedUserId();
      const snap = uid ? await cacheGet<{ friends: Friend[]; pending: PendingRequest[]; sent?: string[] }>(`friends.${uid}`, 5 * 24 * 3600 * 1000) : null;
      if (snap) {
        setFriends(snap.friends); setPending(snap.pending);
        if (snap.sent) setSentIds(new Set(snap.sent));
        onPendingCount?.(snap.pending.length);
        setLoading(false);
      }
      const user = await currentUser();
      if (user) {
        setCurrentUserId(user.id);
        supabase.from('users').select('username, full_name, avatar_url').eq('id', user.id).single()
          .then(async ({ data }) => {
            if (!data) return;
            setMyUsername(data.username); setMyName(data.full_name || '');
            if (data.avatar_url) setMyAvatar(await signOne(data.avatar_url).catch(() => null));
          });
        // Objectif le plus récent non privé → personnalise le message d'invitation.
        supabase.from('objectives').select('emoji, title, visibility').eq('user_id', user.id).order('created_at', { ascending: false }).limit(5)
          .then(({ data }) => {
            const shareable = (data || []).find((o: any) => o.visibility !== 'private');
            if (shareable) setMyTopObjective({ emoji: shareable.emoji, title: shareable.title });
          });
        // Utilisateurs que j'ai bloqués : exclus de la recherche et des suggestions. Chargés en même temps que les
        // amis (avant, la liste d'amis attendait cette requête).
        blockedReady.current = Promise.resolve(supabase.from('blocks').select('blocked_id').eq('blocker_id', user.id)).then(({ data: blocks }) => {
          const set = new Set<string>((blocks || []).map((b: any) => b.blocked_id));
          setBlockedIds(set);
          return set;
        }, () => new Set<string>());
        fetchFriends(user.id, !!snap);
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
      // Demandes que J'AI envoyées, toujours en attente : le bouton reste sur « Envoyé » d'une visite à l'autre
      // (avant le 25/10/2026, seule la mémoire de l'écran le savait, et « Ajouter » revenait au retour sur l'onglet).
      const sent: string[] = [];
      data.forEach((f: any) => {
        const isRequester = f.requester_id === uid;
        const other = isRequester ? f.receiver : f.requester;
        if (!other) return;
        if (f.status === 'accepted') accepted.push({ id: other.id, full_name: other.full_name, username: other.username, friendship_id: f.id, status: f.status, is_requester: isRequester, avatar_url: other.avatar_url });
        else if (f.status === 'pending' && isRequester) sent.push(other.id);
        else if (f.status === 'pending' && !isRequester) pendingReqs.push({ id: other.id, full_name: other.full_name, username: other.username, friendship_id: f.id, avatar_url: other.avatar_url });
      });
      // Bucket privé : les avatars des deux listes sont signés en une requête.
      const signed = await signAvatars([
        ...accepted.map(f => f.avatar_url),
        ...pendingReqs.map(p => p.avatar_url),
      ]);
      accepted.forEach(f => { if (f.avatar_url) f.avatar_url = signed[f.avatar_url] ?? null; });
      pendingReqs.forEach(p => { if (p.avatar_url) p.avatar_url = signed[p.avatar_url] ?? null; });

      setFriends(accepted); setPending(pendingReqs);
      setSentIds(prev => new Set([...prev, ...sent]));
      onPendingCount?.(pendingReqs.length);
      cacheSet(`friends.${uid}`, { friends: accepted, pending: pendingReqs, sent });
      // Ceux qui m'ont envoyé une demande sont déjà en haut (« Demandes reçues ») : pas aussi en suggestion.
      loadSuggestions(uid, [...accepted.map(f => f.id), ...pendingReqs.map(p => p.id)]);
      loadNewMembers();
    }
    setLoading(false);
  };

  // Amis recommandés, du plus sûr au plus large : tes contacts déjà sur Reiz (seulement si l'autorisation est déjà
  // donnée, jamais de demande ici), puis les amis de tes amis (fonction suggest_friends), puis le même objectif.
  // Chaque personne n'apparaît qu'une fois, avec sa meilleure raison. Le ✕ la cache (mémorisé sur le téléphone).
  const hiddenKey = (uid: string) => `reiz.suggest.hidden.${uid}`;
  const loadSuggestions = async (uid: string, friendIds: string[]) => {
    let hidden: string[] = [];
    try { hidden = JSON.parse((await AsyncStorage.getItem(hiddenKey(uid))) || '[]'); } catch {}
    const blocked = await blockedReady.current;
    const excluded = new Set([uid, ...friendIds, ...blocked, ...hidden]);
    const out = new Map<string, any>();
    const add = (u: any, reason: string, kind: 'contact' | 'mutual' | 'objective' | 'sport') => {
      if (!u?.id || excluded.has(u.id) || out.has(u.id)) return;
      out.set(u.id, { id: u.id, full_name: u.full_name, username: u.username, avatar_url: u.avatar_url ?? null, reason, kind });
    };

    if (contactsAvailable() && (await contactsGranted())) {
      const res = await loadDeviceContacts().catch(() => null);
      if (res?.status === 'ok') {
        const matched = await matchContacts(res.contacts).catch(() => null);
        (matched || []).forEach(m => add(m, t('friends.inContacts'), 'contact'));
      }
    }

    const { data: mutual } = await supabase.rpc('suggest_friends', { p_limit: 12 });
    (mutual || []).forEach((u: any) => add(u, tp('friends.mutual', u.mutual), 'mutual'));

    // Même sport que toi (celui de ton profil, choisi à l'accueil).
    const { data: me } = await supabase.from('users').select('sport').eq('id', uid).maybeSingle();
    if (me?.sport && me.sport !== 'autre') {
      const { data: same } = await supabase.rpc('discover_people', { p_terms: [me.sport], p_limit: 10 });
      ((same as any[]) || []).filter(u => u.reason?.startsWith('Sport')).forEach(u => add(u, t('friends.sameSport', { sport: sportName(u.reason.replace('Sport : ', '')) }), 'sport'));
    }

    const { data: myObjs } = await supabase.from('objectives').select('title').eq('user_id', uid);
    if (myObjs && myObjs.length > 0) {
      const myKeywords = myObjs.flatMap((o: any) => o.title.toLowerCase().split(/\s+/)).filter((w: string) => w.length > 3);
      // Uniquement les objectifs publics : on ne révèle jamais les objectifs privés ou réservés aux amis.
      const { data } = await supabase.from('objectives').select('user_id, title, users!inner(id, full_name, username, avatar_url)').neq('user_id', uid).eq('visibility', 'public').limit(40);
      const rows = ((data as any[]) || []).map(o => {
        const objWords = o.title.toLowerCase().split(/\s+/);
        return { o, match: myKeywords.some((k: string) => objWords.some((w: string) => w.includes(k) || k.includes(w))) };
      }).sort((a, b) => Number(b.match) - Number(a.match));
      rows.forEach(({ o }) => add(o.users, t('friends.reasonObjective', { title: o.title }), 'objective'));
    }

    // Les avatars des contacts sont déjà signés par matchContacts ; les autres sont encore des chemins.
    const top = [...out.values()].slice(0, 10);
    const toSign = top.filter(u => u.kind !== 'contact').map(u => u.avatar_url);
    const signed = await signAvatars(toSign);
    top.forEach(u => { if (u.kind !== 'contact' && u.avatar_url) u.avatar_url = signed[u.avatar_url] ?? null; });
    setSuggestions(top);
  };

  const hideSuggestion = async (id: string) => {
    Haptics.selectionAsync().catch(() => {});
    setSuggestions(list => list.filter(u => u.id !== id));
    if (!currentUserId) return;
    try {
      const prev: string[] = JSON.parse((await AsyncStorage.getItem(hiddenKey(currentUserId))) || '[]');
      await AsyncStorage.setItem(hiddenKey(currentUserId), JSON.stringify([...new Set([...prev, id])].slice(-200)));
    } catch {}
  };

  // Demande partie : « Envoyé » à l'écran, et dans la mémoire du téléphone pour la prochaine ouverture de l'onglet.
  const markSent = (id: string) => {
    setSentIds(prev => {
      const next = new Set(prev).add(id);
      if (currentUserId) {
        cacheGet<{ friends: Friend[]; pending: PendingRequest[] }>(`friends.${currentUserId}`, 5 * 24 * 3600 * 1000).then(snap => {
          if (snap) cacheSet(`friends.${currentUserId}`, { ...snap, sent: [...next] });
        });
      }
      return next;
    });
  };

  const addSuggested = async (id: string) => {
    if (!currentUserId || sentIds.has(id)) return;
    const { error } = await supabase.from('friendships').insert({ requester_id: currentUserId, receiver_id: id, status: 'pending' });
    if (error && error.code !== '23505') { Alert.alert(t('common.error'), frError(error)); return; }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    markSent(id);
  };

  // Recherche de nouvelles personnes : nom, @pseudo, tag de profil ou objectif public (fonction discover_people,
  // qui écarte tes amis, les demandes en cours, les blocages et les comptes qui ne veulent pas être proposés).
  // Tes amis qui correspondent sont listés à part, pour ouvrir leur profil.
  const runDiscover = async (terms: string[]) => {
    setSearching(true);
    const [{ data }, blocked] = await Promise.all([supabase.rpc('discover_people', { p_terms: terms, p_limit: 20 }), blockedReady.current]);
    const results = ((data as any[]) || []).filter(u => !blocked.has(u.id)).map(u => ({
      ...u,
      reason: localizeReason(u.reason) || (u.mutual > 0 ? tp('friends.mutual', u.mutual) : `@${u.username}`),
      kind: u.reason?.startsWith('Sport') ? 'sport' : u.reason?.startsWith('Tag') ? 'tag' : u.reason?.startsWith('Objectif') ? 'objective' : u.mutual > 0 ? 'mutual' : 'name',
    }));
    const signed = await signAvatars(results.map(u => u.avatar_url));
    results.forEach(u => { if (u.avatar_url) u.avatar_url = signed[u.avatar_url] ?? null; });
    setSearchResults(results);
    setSearching(false);
  };

  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    setActiveSport(null);
    const q = query.trim().replace(/^@/, '').replace(/[,()%]/g, '');
    if (q.length < 2) { setSearchResults([]); return; }
    runDiscover([q]);
  };

  const searchSport = (id: string, label: string, terms: string[]) => {
    Haptics.selectionAsync().catch(() => {});
    if (activeSport === id) { setActiveSport(null); setSearchQuery(''); setSearchResults([]); return; }
    setActiveSport(id);
    setSearchQuery(label);
    runDiscover(terms);
  };

  const loadNewMembers = async () => {
    const [{ data }, blocked] = await Promise.all([supabase.rpc('new_members', { p_limit: 10 }), blockedReady.current]);
    const list = ((data as any[]) || []).filter(u => !blocked.has(u.id));
    const signed = await signAvatars(list.map(u => u.avatar_url));
    list.forEach(u => { if (u.avatar_url) u.avatar_url = signed[u.avatar_url] ?? null; });
    setNewMembers(list);
  };

  const sendFriendRequest = async (receiverId: string) => {
    if (!currentUserId) return;
    const { error } = await supabase.from('friendships').insert({ requester_id: currentUserId, receiver_id: receiverId, status: 'pending' });
    if (error) { if (error.code === '23505') { markSent(receiverId); Alert.alert(t('friends.alreadySent'), t('friends.alreadySentText')); } else Alert.alert(t('common.error'), frError(error)); return; }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    markSent(receiverId);
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
    Alert.alert(t('common.delete'), t('friends.removeConfirm', { name: friendName }), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.delete'), style: 'destructive', onPress: async () => {
        await supabase.from('friendships').delete().eq('id', friendshipId);
        if (currentUserId) fetchFriends(currentUserId);
      }}
    ]);
  };

  const getFriendshipStatus = (userId: string) => friends.find(f => f.id === userId) ? 'ami' : null;

  // Essai de design « verre » (interrupteur GLASS_FRIENDS dans constants.ts). L'ancien affichage est juste en dessous.
  if (GLASS_FRIENDS) {
    return (
      <>
        <FriendsGlassView
          friends={friends}
          pending={pending}
          suggestions={suggestions}
          searchResults={searchResults}
          searchQuery={searchQuery}
          searching={searching}
          loading={loading}
          closeIds={closeIds}
          refreshing={refreshingFriends}
          onRefresh={async () => {
            if (!currentUserId) return;
            setRefreshingFriends(true);
            await fetchFriends(currentUserId, true);
            setRefreshingFriends(false);
          }}
          onSearch={handleSearch}
          onClearSearch={() => { setSearchQuery(''); setSearchResults([]); setActiveSport(null); }}
          matchingFriends={searchQuery.trim().length >= 2 && !activeSport ? friends.filter(f => `${f.full_name} ${f.username}`.toLowerCase().includes(searchQuery.trim().replace(/^@/, '').toLowerCase())).slice(0, 5) : []}
          newMembers={newMembers}
          activeSport={activeSport}
          onSport={searchSport}
          onViewProfile={onViewProfile}
          onToggleClose={toggleClose}
          onInvite={inviteFriends}
          inviteLink={APP_STORE_URL.replace('https://', '')}
          myAvatar={myAvatar}
          myName={myName}
          onHideSuggestion={hideSuggestion}
          onAddSuggested={addSuggested}
          sentIds={sentIds}
          onOpenContacts={contactsAvailable() ? () => setShowContacts(true) : undefined}
          onAccept={acceptRequest}
          onDecline={declineRequest}
          onRemove={removeFriend}
          onAddFriend={sendFriendRequest}
          isFriend={id => getFriendshipStatus(id) === 'ami'}
          bottomPad={navClearance(insets.bottom)}
        />
        <ContactsScreen visible={showContacts} onClose={() => setShowContacts(false)} />
        <ShareProfileSheet visible={shareOpen} onClose={() => setShareOpen(false)} name={myName} username={myUsername} avatar={myAvatar} />
      </>
    );
  }

  return (
    <ScrollView
      style={s.feed}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={[s.feedPad, { paddingBottom: navClearance(insets.bottom) }]}
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
      <TouchableOpacity style={s.myUpdate} onPress={inviteFriendsText} activeOpacity={0.85}>
        <View style={s.myUpdateInfo}>
          <Text style={s.myUpdateTitle}>{t('friends.inviteTitle')}</Text>
          <Text style={s.myUpdateSub}>{t('friends.inviteSub')}</Text>
        </View>
        <View style={s.postedBadge}><Text style={s.postedBadgeText}>{t('friends.shareArrow')}</Text></View>
      </TouchableOpacity>

      {/* Retrouver ses contacts sur Reiz et inviter les autres */}
      {contactsAvailable() && (
        <TouchableOpacity onPress={() => setShowContacts(true)} activeOpacity={0.85} style={{ marginTop: 10 }} accessibilityLabel={t('friends.findContactsA11y')}>
          <GlassSurface radius={22}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14 }}>
              <Ionicons name="people" size={22} color="#fff" />
              <View style={{ flex: 1 }}>
                <Text style={{ color: '#fff', fontSize: 15, fontFamily: F.bold }}>{t('friends.findContacts')}</Text>
                <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, fontFamily: F.regular, marginTop: 1 }}>{t('friends.findContactsSub')}</Text>
              </View>
              <Ionicons name={dirIcon('chevron-forward')} size={18} color="rgba(255,255,255,0.6)" />
            </View>
          </GlassSurface>
        </TouchableOpacity>
      )}
      <ContactsScreen visible={showContacts} onClose={() => setShowContacts(false)} />

      {/* Barre de recherche */}
      <View style={s.searchBarActive}>
        <Ionicons name="search" size={16} color="#666" />
        <TextInput style={s.searchInput} placeholder={t('friends.searchPlaceholder')} placeholderTextColor="#666" value={searchQuery} onChangeText={handleSearch} autoCapitalize="none" maxLength={40} />
        {searchQuery.length > 0 && (
          <TouchableOpacity
            onPress={() => { setSearchQuery(''); setSearchResults([]); }}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Ionicons name="close" size={18} color="#777" />
          </TouchableOpacity>
        )}
      </View>

      {/* Recherche en cours / sans résultat : sans ces deux états, taper un nom
          inconnu ne renvoyait strictement rien à l'écran. */}
      {searchQuery.trim().length >= 2 && searchResults.length === 0 && (
        <View style={{ paddingVertical: 18, alignItems: 'center', gap: 4 }}>
          {searching ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Text style={{ color: '#888', fontSize: 14, fontFamily: F.bold }}>{t('friends.noResult')}</Text>
              <Text style={{ color: '#666', fontSize: 12, textAlign: 'center' }}>{t('friends.noResultSub')}</Text>
            </>
          )}
        </View>
      )}

      {/* Résultats de recherche */}
      {searchResults.length > 0 && (
        <View style={{ marginBottom: 8 }}>
          <Text style={s.sectionTitle}>{t('friends.results')}</Text>
          {searchResults.map((u) => (
            <TouchableOpacity key={u.id} style={s.friendRow} onPress={() => onViewProfile(u.id)} activeOpacity={0.8}>
              <RowAvatar url={u.avatar_url} name={u.full_name} />
              <View style={s.friendRowInfo}>
                <Text style={s.friendRowName}>{u.full_name}</Text>
                <Text style={s.friendRowSub}>@{u.username}</Text>
              </View>
              {getFriendshipStatus(u.id) === 'ami' ? (
                <View style={s.friendBadge}><Ionicons name="checkmark" size={14} color="#888" /></View>
              ) : (
                <TouchableOpacity style={[s.addFriendBtn, sentIds.has(u.id) && { opacity: 0.5 }]} disabled={sentIds.has(u.id)} onPress={() => sendFriendRequest(u.id)}>
                  <Text style={s.addFriendBtnText}>{sentIds.has(u.id) ? t('friendsGlass.sent') : t('friends.add')}</Text>
                </TouchableOpacity>
              )}
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Demandes reçues */}
      {pending.length > 0 && (
        <View style={{ marginBottom: 8 }}>
          <Text style={s.sectionTitle}>{t('friends.requestsReceived', { n: pending.length })}</Text>
          {pending.map((p) => (
            <View key={p.friendship_id} style={s.friendRow}>
              <RowAvatar url={p.avatar_url} name={p.full_name} active />
              <View style={s.friendRowInfo}>
                <Text style={s.friendRowName}>{p.full_name}</Text>
                <Text style={s.friendRowSub}>@{p.username}</Text>
              </View>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {/* Cibles de 36px : le hitSlop les ramène au minimum tactile de 44. */}
                <TouchableOpacity style={s.acceptBtn} onPress={() => acceptRequest(p.friendship_id)} hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}>
                  <Ionicons name="checkmark" size={18} color="#000" />
                </TouchableOpacity>
                <TouchableOpacity style={s.declineBtn} onPress={() => declineRequest(p.friendship_id)} hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}>
                  <Ionicons name="close" size={16} color="#888" />
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Découverte par objectif commun */}
      {suggestions.length > 0 && (
        <View style={{ marginBottom: 8 }}>
          <Text style={s.sectionTitle}>{t('friends.sameObjective')}</Text>
          {/* La liste déborde jusqu'aux bords de l'écran (marginHorizontal négatif) :
              le padding interne la remet dans la gouttière. */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.suggestScroll} contentContainerStyle={{ gap: 12, paddingHorizontal: GUTTER }}>
            {suggestions.map((u) => (
              <TouchableOpacity key={u.id} style={s.suggestCard} onPress={() => onViewProfile(u.id)} activeOpacity={0.8}>
                <SuggestAvatar url={u.avatar_url} name={u.full_name} />
                <Text style={s.suggestName} numberOfLines={1}>{u.full_name}</Text>
                <Text style={s.suggestObj} numberOfLines={2}>{u.objectiveTitle}</Text>
                <TouchableOpacity style={[s.suggestAddBtn, sentIds.has(u.id) && { opacity: 0.5 }]} disabled={sentIds.has(u.id)} onPress={() => sendFriendRequest(u.id)}>
                  <Text style={s.suggestAddText}>{sentIds.has(u.id) ? t('friendsGlass.sent') : t('friends.add')}</Text>
                </TouchableOpacity>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Liste d'amis */}
      <Text style={s.sectionTitle}>{friends.length > 0 ? `${tp('friends.countFriends', friends.length)}${closeIds.size > 0 ? tp('friends.countClose', closeIds.size) : ''}` : t('friends.myFriends')}</Text>
      {friends.length > 0 && (
        <Text style={{ color: '#777', fontSize: 12, lineHeight: 17, marginBottom: 10, marginTop: -4 }}>
          {t('friends.starHintBefore')} <Text style={{ color: '#fff', fontFamily: F.bold }}>{t('friends.starHintBold')}</Text>{t('friends.starHintAfter')}
        </Text>
      )}
      {loading ? (
        <View style={{ paddingTop: 20, alignItems: 'center' }}><ActivityIndicator color="#fff" /></View>
      ) : friends.length === 0 ? (
        <View style={{ paddingTop: 30, alignItems: 'center', gap: 8 }}>
          <Text style={{ color: '#888', fontSize: 15, fontFamily: F.bold }}>{t('friends.noFriends')}</Text>
          <Text style={{ color: '#666', fontSize: 13 }}>{t('friends.noFriendsSub')}</Text>
          <TouchableOpacity style={s.emptyStateBtn} onPress={inviteFriends}>
            <Text style={s.emptyStateBtnText}>{t('friends.inviteArrow')}</Text>
          </TouchableOpacity>
        </View>
      ) : [...friends].sort((a, b) => Number(closeIds.has(b.id)) - Number(closeIds.has(a.id))).map((f) => (
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
          <TouchableOpacity
            onPress={() => toggleClose(f.id)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityLabel={closeIds.has(f.id) ? t('friends.closeRemove', { name: f.full_name }) : t('friends.closeAdd', { name: f.full_name })}
            style={{ width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: closeIds.has(f.id) ? '#fff' : '#1a1a1a' }}
          >
            <Ionicons name={closeIds.has(f.id) ? 'star' : 'star-outline'} size={17} color={closeIds.has(f.id) ? '#000' : '#888'} />
          </TouchableOpacity>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, FlatList, Image, Modal, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { supabase } from '../lib/supabase';
import { signAvatars } from '../lib/storage';
import { setClose } from '../lib/closeCircle';
import { s, F } from '../styles';
import { t, tp, dirIcon } from '../i18n';
import { CachedImage } from './CachedImage';

type Person = { id: string; full_name: string; username: string; avatar_url?: string | null };

// Deux usages, une seule liste :
//  - mode « friends » : les amis d'un profil ; un tap ouvre son profil ;
//  - mode « close »   : TON cercle proche seulement ; « Ajouter des proches » déplie tes autres amis, avec une
//    étoile pour les y mettre. Un proche retiré reste affiché (étoile vide) jusqu'à la fermeture, pour pouvoir
//    se raviser. `startAdding` ouvre directement sur l'ajout (carte « Ajouter des proches »).
export function PeopleListModal({ visible, userId, currentUserId, mode, onClose, onOpenProfile, startAdding }: {
  visible: boolean;
  userId: string;
  currentUserId: string | null;
  mode: 'friends' | 'close';
  onClose: () => void;
  onOpenProfile?: (id: string) => void;
  startAdding?: boolean;
}) {
  const [people, setPeople] = useState<Person[]>([]);
  const [closeIds, setCloseIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  // Mode « close » : qui est affiché dans la liste du cercle (les proches à l'ouverture + ceux qu'on ajoute).
  const [shown, setShown] = useState<Set<string>>(new Set());
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    if (!visible) return;
    (async () => {
      setLoading(true);
      // friends_of : fonction serveur, la base ne laisse pas lire les amitiés des autres.
      const { data } = await supabase.rpc('friends_of', { p_user: userId });
      // Dédoublonnage : une amitié enregistrée deux fois ne doit pas afficher la personne deux fois.
      const list = [...new Map(((data || []) as Person[]).map(p => [p.id, p])).values()];
      const signed = await signAvatars(list.map(p => p.avatar_url));
      list.forEach(p => { if (p.avatar_url) p.avatar_url = signed[p.avatar_url] ?? null; });
      setPeople(list);
      if ((mode === 'close' || userId === currentUserId) && currentUserId) {
        const { data: cf } = await supabase.from('close_friends').select('friend_id').eq('owner_id', currentUserId);
        const ids = new Set<string>((cf || []).map((c: any) => c.friend_id));
        setCloseIds(ids);
        setShown(new Set(ids));
        // Cercle vide : rien à montrer, on ouvre directement sur le choix parmi les amis.
        setAdding(!!startAdding || ids.size === 0);
      }
      setLoading(false);
    })();
  }, [visible, userId, mode]);

  const toggleClose = async (id: string) => {
    if (!currentUserId) return;
    const on = closeIds.has(id);
    Haptics.selectionAsync().catch(() => {});
    setCloseIds(prev => { const n = new Set(prev); on ? n.delete(id) : n.add(id); return n; });
    if (!on) setShown(prev => new Set(prev).add(id));
    const ok = await setClose(id, !on);
    if (!ok) setCloseIds(prev => { const n = new Set(prev); on ? n.add(id) : n.delete(id); return n; });
  };

  // TES amis (ton profil) : l'étoile du cercle proche et « Retirer » sont ici, plus dans l'onglet Amis.
  const own = mode === 'friends' && userId === currentUserId;
  const remove = (p: Person) => {
    Alert.alert(t('common.remove'), t('friends.removeConfirm', { name: p.full_name }), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.remove'), style: 'destructive', onPress: async () => {
          if (!currentUserId) return;
          const { error } = await supabase.from('friendships').delete()
            .or(`and(requester_id.eq.${currentUserId},receiver_id.eq.${p.id}),and(requester_id.eq.${p.id},receiver_id.eq.${currentUserId})`);
          if (error) { Alert.alert(t('common.error'), t('people.removeFailed')); return; }
          if (closeIds.has(p.id)) await setClose(p.id, false);
          setPeople(list => list.filter(x => x.id !== p.id));
        },
      },
    ]);
  };

  // Mode « close » : le cercle d'abord, puis (si on ajoute) les autres amis sous un intertitre.
  type Row = Person | { header: string };
  const circle = people.filter(p => shown.has(p.id));
  const others = people.filter(p => !shown.has(p.id) && p.id !== currentUserId);
  const rows: Row[] = mode !== 'close'
    ? people
    : adding && others.length > 0
      ? [...circle, { header: circle.length > 0 ? t('people.otherFriends') : t('people.chooseClose') }, ...others]
      : circle;
  const closeCount = [...closeIds].filter(id => people.some(p => p.id === id)).length;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={s.modalContainer}>
        <View style={s.modalHeader}>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text style={s.modalCancel}>{t('common.close')}</Text>
          </TouchableOpacity>
          <Text style={s.modalTitle}>{mode === 'close' ? (closeCount > 0 ? t('people.closeTitle', { n: closeCount }) : t('visLong.close')) : own ? t('people.myFriends', { n: people.length }) : tp('profile.friends', 2)}</Text>
          <View style={{ width: 46 }} />
        </View>
        {own && people.length > 0 && (
          <Text style={{ color: '#888', fontSize: 13, paddingHorizontal: 20, paddingTop: 14, lineHeight: 18 }}>
            {t('people.starHint')}
          </Text>
        )}
        {mode === 'close' && (
          <Text style={{ color: '#888', fontSize: 13, paddingHorizontal: 20, paddingTop: 14, lineHeight: 18 }}>
            {t('people.closeHint')}
          </Text>
        )}
        {loading ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color="#fff" /></View>
        ) : (
          <FlatList
            data={rows}
            keyExtractor={(p, i) => ('header' in p ? `h${i}` : p.id)}
            contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
            ListEmptyComponent={<Text style={{ color: '#777', textAlign: 'center', marginTop: 40 }}>{t('people.none')}</Text>}
            ListFooterComponent={mode === 'close' && !adding && others.length > 0 ? (
              <TouchableOpacity onPress={() => { Haptics.selectionAsync().catch(() => {}); setAdding(true); }} activeOpacity={0.85}
                style={{ marginTop: 16, backgroundColor: 'rgba(255,255,255,0.14)', borderRadius: 16, paddingVertical: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                <Ionicons name="add" size={18} color="#fff" />
                <Text style={{ color: '#fff', fontSize: 14, fontFamily: F.extrabold }}>{t('closeCard.add')}</Text>
              </TouchableOpacity>
            ) : null}
            renderItem={({ item }) => {
              if ('header' in item) {
                return <Text style={{ color: 'rgba(255,255,255,0.55)', fontSize: 10, fontFamily: F.bold, letterSpacing: 1.5, marginTop: circle.length > 0 ? 22 : 4, marginBottom: 4 }}>{item.header}</Text>;
              }
              const p = item;
              const isClose = closeIds.has(p.id);
              const isMe = p.id === currentUserId;
              return (
                <TouchableOpacity
                  activeOpacity={0.75}
                  disabled={mode === 'friends' && (isMe || !onOpenProfile)}
                  onPress={() => (mode === 'close' ? toggleClose(p.id) : onOpenProfile?.(p.id))}
                  onLongPress={own && !isMe ? () => remove(p) : undefined}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 }}
                >
                  {p.avatar_url
                    ? <CachedImage uri={p.avatar_url} style={s.avImg} />
                    : <View style={s.av}><Text style={s.avText}>{p.full_name.charAt(0).toUpperCase()}</Text></View>}
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: '#fff', fontSize: 15, fontFamily: F.bold }}>{p.full_name}{isMe ? t('people.me') : ''}</Text>
                    <Text style={{ color: '#888', fontSize: 12 }}>@{p.username}</Text>
                  </View>
                  {mode === 'close' ? (
                    <Ionicons name={isClose ? 'star' : 'star-outline'} size={22} color={isClose ? '#3ddc84' : '#555'} />
                  ) : own && !isMe ? (
                    <TouchableOpacity onPress={() => toggleClose(p.id)} hitSlop={10} accessibilityLabel={isClose ? t('friends.closeRemove', { name: p.full_name }) : t('friends.closeAdd', { name: p.full_name })}
                      style={{ width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: isClose ? '#fff' : 'rgba(255,255,255,0.12)' }}>
                      <Ionicons name={isClose ? 'star' : 'star-outline'} size={18} color={isClose ? '#000' : '#ccc'} />
                    </TouchableOpacity>
                  ) : !isMe ? (
                    <Ionicons name={dirIcon('chevron-forward')} size={18} color="#555" />
                  ) : null}
                </TouchableOpacity>
              );
            }}
          />
        )}
      </View>
    </Modal>
  );
}

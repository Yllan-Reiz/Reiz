import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, FlatList, Image, Modal, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { supabase } from '../lib/supabase';
import { signMany } from '../lib/storage';
import { s, F } from '../styles';

type Person = { id: string; full_name: string; username: string; avatar_url?: string | null };

// Deux usages, une seule liste :
//  - mode « friends » : les amis d'un profil ; un tap ouvre son profil ;
//  - mode « close »   : tes amis, avec une étoile pour les mettre dans ton cercle proche.
export function PeopleListModal({ visible, userId, currentUserId, mode, onClose, onOpenProfile }: {
  visible: boolean;
  userId: string;
  currentUserId: string | null;
  mode: 'friends' | 'close';
  onClose: () => void;
  onOpenProfile?: (id: string) => void;
}) {
  const [people, setPeople] = useState<Person[]>([]);
  const [closeIds, setCloseIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!visible) return;
    (async () => {
      setLoading(true);
      // friends_of : fonction serveur, la base ne laisse pas lire les amitiés des autres.
      const { data } = await supabase.rpc('friends_of', { p_user: userId });
      // Dédoublonnage : une amitié enregistrée deux fois ne doit pas afficher la personne deux fois.
      const list = [...new Map(((data || []) as Person[]).map(p => [p.id, p])).values()];
      const signed = await signMany(list.map(p => p.avatar_url));
      list.forEach(p => { if (p.avatar_url) p.avatar_url = signed[p.avatar_url] ?? null; });
      setPeople(list);
      if (mode === 'close' && currentUserId) {
        const { data: cf } = await supabase.from('close_friends').select('friend_id').eq('owner_id', currentUserId);
        setCloseIds(new Set((cf || []).map((c: any) => c.friend_id)));
      }
      setLoading(false);
    })();
  }, [visible, userId, mode]);

  const toggleClose = async (id: string) => {
    if (!currentUserId) return;
    const on = closeIds.has(id);
    Haptics.selectionAsync().catch(() => {});
    setCloseIds(prev => { const n = new Set(prev); on ? n.delete(id) : n.add(id); return n; });
    const { error } = on
      ? await supabase.from('close_friends').delete().eq('owner_id', currentUserId).eq('friend_id', id)
      : await supabase.from('close_friends').insert({ owner_id: currentUserId, friend_id: id });
    if (error && !/duplicate key/i.test(error.message || '')) {
      setCloseIds(prev => { const n = new Set(prev); on ? n.add(id) : n.delete(id); return n; });
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={s.modalContainer}>
        <View style={s.modalHeader}>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text style={s.modalCancel}>Fermer</Text>
          </TouchableOpacity>
          <Text style={s.modalTitle}>{mode === 'close' ? 'Cercle proche' : 'Amis'}</Text>
          <View style={{ width: 46 }} />
        </View>
        {mode === 'close' && (
          <Text style={{ color: '#888', fontSize: 13, paddingHorizontal: 20, paddingTop: 14, lineHeight: 18 }}>
            Les objectifs réglés sur « Cercle proche » ne sont visibles que par les amis marqués d'une étoile. Ils ne savent pas qui d'autre est dans la liste.
          </Text>
        )}
        {loading ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color="#fff" /></View>
        ) : (
          <FlatList
            data={people}
            keyExtractor={p => p.id}
            contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
            ListEmptyComponent={<Text style={{ color: '#777', textAlign: 'center', marginTop: 40 }}>Aucun ami pour l'instant.</Text>}
            renderItem={({ item: p }) => {
              const isClose = closeIds.has(p.id);
              const isMe = p.id === currentUserId;
              return (
                <TouchableOpacity
                  activeOpacity={0.75}
                  disabled={mode === 'friends' && (isMe || !onOpenProfile)}
                  onPress={() => (mode === 'close' ? toggleClose(p.id) : onOpenProfile?.(p.id))}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 }}
                >
                  {p.avatar_url
                    ? <Image source={{ uri: p.avatar_url }} style={s.avImg} />
                    : <View style={s.av}><Text style={s.avText}>{p.full_name.charAt(0).toUpperCase()}</Text></View>}
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: '#fff', fontSize: 15, fontFamily: F.bold }}>{p.full_name}{isMe ? ' (toi)' : ''}</Text>
                    <Text style={{ color: '#888', fontSize: 12 }}>@{p.username}</Text>
                  </View>
                  {mode === 'close' ? (
                    <Ionicons name={isClose ? 'star' : 'star-outline'} size={22} color={isClose ? '#3ddc84' : '#555'} />
                  ) : !isMe ? (
                    <Ionicons name="chevron-forward" size={18} color="#555" />
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

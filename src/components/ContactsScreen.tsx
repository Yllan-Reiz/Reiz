import { useCallback, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, FlatList, Image, Modal, ActivityIndicator, Linking, Share, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { supabase, currentUser } from '../lib/supabase';
import { frError } from '../lib/helpers';
import { sha256Hex } from '../lib/sha256';
import { DeviceContact, Matched, loadDeviceContacts, matchContacts, inviteBySms, inviteByEmail, inviteText } from '../lib/contacts';
import { s, F } from '../styles';

// « Mes contacts » : ceux qui sont déjà sur Reiz (à ajouter en un tap) et les autres (à inviter par message).
// Rien n'est envoyé sans ton tap : « Inviter » ouvre Messages avec le texte prêt, tu appuies toi-même sur Envoyer.

type Phase = 'loading' | 'denied' | 'ready' | 'unavailable';
type Rel = 'friend' | 'sent' | 'received';

type Row =
  | { kind: 'head'; key: string; title: string }
  | { kind: 'user'; key: string; user: Matched; contactName: string }
  | { kind: 'contact'; key: string; contact: DeviceContact };

const initial = (n: string) => n.charAt(0).toUpperCase();

export function ContactsScreen({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const [phase, setPhase] = useState<Phase>('loading');
  const [contacts, setContacts] = useState<DeviceContact[]>([]);
  const [matched, setMatched] = useState<Matched[] | null>([]);
  const [rels, setRels] = useState<Record<string, Rel>>({});
  const [query, setQuery] = useState('');
  const [myUsername, setMyUsername] = useState<string | null>(null);
  const [meId, setMeId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setPhase('loading');
    const me = await currentUser();
    setMeId(me?.id ?? null);
    const res = await loadDeviceContacts();
    if (res.status !== 'ok') { setPhase(res.status); return; }
    setContacts(res.contacts);
    const [found, rel, profile] = await Promise.all([
      matchContacts(res.contacts),
      me ? supabase.from('friendships').select('requester_id, receiver_id, status').or(`requester_id.eq.${me.id},receiver_id.eq.${me.id}`) : Promise.resolve({ data: [] as any[] }),
      me ? supabase.from('users').select('username').eq('id', me.id).single() : Promise.resolve({ data: null as any }),
    ]);
    setMatched(found);
    setMyUsername(profile.data?.username ?? null);
    const map: Record<string, Rel> = {};
    ((rel.data || []) as any[]).forEach(f => {
      const other = f.requester_id === me?.id ? f.receiver_id : f.requester_id;
      map[other] = f.status === 'accepted' ? 'friend' : f.requester_id === me?.id ? 'sent' : 'received';
    });
    setRels(map);
    setPhase('ready');
  }, []);

  useEffect(() => { if (visible) { setQuery(''); load(); } }, [visible, load]);

  const add = async (u: Matched) => {
    if (!meId) return;
    Haptics.selectionAsync().catch(() => {});
    setRels(prev => ({ ...prev, [u.id]: 'sent' }));
    const { error } = await supabase.from('friendships').insert({ requester_id: meId, receiver_id: u.id, status: 'pending' });
    if (error && !/duplicate key/i.test(error.message || '')) {
      setRels(prev => { const n = { ...prev }; delete n[u.id]; return n; });
      Alert.alert('Erreur', frError(error));
    }
  };

  const shareLink = () => { Share.share({ message: inviteText(myUsername) }).catch(() => {}); };

  // Les contacts retrouvés sur Reiz ne sont plus proposés à l'invitation.
  const matchedHashes = new Set((matched || []).map(m => m.email_hash));
  const q = query.trim().toLowerCase();
  const rows: Row[] = [];
  const onReiz = (matched || []).filter(u => rels[u.id] !== 'friend');
  if (onReiz.length > 0) {
    rows.push({ kind: 'head', key: 'h-reiz', title: `DÉJÀ SUR REIZ (${onReiz.length})` });
    onReiz.forEach(u => rows.push({ kind: 'user', key: `u-${u.id}`, user: u, contactName: u.full_name }));
  }
  const toInvite = contacts.filter(c => !q || c.name.toLowerCase().includes(q));
  const invitable = toInvite.filter(c => !c.emails.some(e => matchedHashes.has(sha256Hex(e))));
  if (invitable.length > 0) {
    rows.push({ kind: 'head', key: 'h-inv', title: `INVITER (${invitable.length})` });
    invitable.forEach(c => rows.push({ kind: 'contact', key: `c-${c.id}`, contact: c }));
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={s.modalContainer}>
        <View style={s.modalHeader}>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}><Text style={s.modalCancel}>Fermer</Text></TouchableOpacity>
          <Text style={s.modalTitle}>Mes contacts</Text>
          <View style={{ width: 46 }} />
        </View>

        {phase === 'loading' && <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color="#fff" /></View>}

        {(phase === 'denied' || phase === 'unavailable') && (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}>
            <Ionicons name="people-outline" size={44} color="#888" />
            <Text style={{ color: '#fff', fontSize: 20, fontFamily: F.black, marginTop: 14, textAlign: 'center' }}>
              {phase === 'denied' ? "Reiz n'a pas accès à tes contacts" : 'Pas disponible sur cette version'}
            </Text>
            <Text style={{ color: '#888', fontSize: 14, lineHeight: 21, marginTop: 8, textAlign: 'center' }}>
              {phase === 'denied'
                ? "Autorise l'accès dans les réglages de ton iPhone pour retrouver tes amis déjà sur Reiz et inviter les autres. Tes contacts restent sur ton téléphone."
                : 'Mets Reiz à jour pour retrouver tes contacts.'}
            </Text>
            {phase === 'denied' && (
              <TouchableOpacity onPress={() => Linking.openSettings().catch(() => {})} style={{ backgroundColor: '#fff', borderRadius: 16, paddingHorizontal: 24, paddingVertical: 14, marginTop: 22 }}>
                <Text style={{ color: '#000', fontSize: 14, fontFamily: F.extrabold }}>Ouvrir les réglages</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {phase === 'ready' && (
          <FlatList
            data={rows}
            keyExtractor={r => r.key}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ padding: 16, paddingBottom: 60 }}
            ListHeaderComponent={
              <View style={{ marginBottom: 10 }}>
                <Text style={{ color: '#777', fontSize: 12, lineHeight: 17, marginBottom: 12 }}>
                  Tes contacts restent sur ton téléphone : Reiz compare seulement des empreintes de leurs e-mails, sans rien enregistrer.
                </Text>
                <TextInput
                  value={query}
                  onChangeText={setQuery}
                  placeholder="Chercher dans mes contacts"
                  placeholderTextColor="#666"
                  autoCorrect={false}
                  style={{ backgroundColor: '#141414', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, color: '#fff', fontSize: 15, fontFamily: F.regular, borderWidth: 1, borderColor: '#222' }}
                />
                <TouchableOpacity onPress={shareLink} activeOpacity={0.85} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#fff', borderRadius: 16, paddingVertical: 14, justifyContent: 'center', marginTop: 12 }}>
                  <Ionicons name="share-outline" size={18} color="#000" />
                  <Text style={{ color: '#000', fontSize: 14, fontFamily: F.extrabold }}>Inviter avec mon lien</Text>
                </TouchableOpacity>
                {matched === null && (
                  <Text style={{ color: '#ff9f43', fontSize: 12, marginTop: 10 }}>La recherche d'amis déjà sur Reiz n'est pas encore disponible. Tu peux déjà inviter tes contacts.</Text>
                )}
              </View>
            }
            ListEmptyComponent={<Text style={{ color: '#777', textAlign: 'center', marginTop: 40 }}>{q ? 'Aucun contact trouvé.' : 'Aucun contact avec un numéro ou un e-mail.'}</Text>}
            renderItem={({ item }) => {
              if (item.kind === 'head') return <Text style={[s.sectionTitle, { marginTop: 16, marginBottom: 8 }]}>{item.title}</Text>;
              if (item.kind === 'user') {
                const u = item.user;
                const rel = rels[u.id];
                return (
                  <View style={s.friendRow}>
                    {u.avatar_url
                      ? <Image source={{ uri: u.avatar_url }} style={s.friendRowAvImg} />
                      : <View style={s.friendRowAv}><Text style={s.friendRowAvText}>{initial(u.full_name)}</Text></View>}
                    <View style={s.friendRowInfo}>
                      <Text style={s.friendRowName}>{u.full_name}</Text>
                      <Text style={s.friendRowSub}>@{u.username}</Text>
                    </View>
                    {rel === 'sent' ? (
                      <Text style={{ color: '#888', fontSize: 13, fontFamily: F.semibold }}>Demande envoyée</Text>
                    ) : (
                      <TouchableOpacity style={s.addFriendBtn} onPress={() => add(u)}>
                        <Text style={s.addFriendBtnText}>{rel === 'received' ? 'Accepter' : 'Ajouter'}</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                );
              }
              const c = item.contact;
              return (
                <View style={s.friendRow}>
                  <View style={s.friendRowAv}><Text style={s.friendRowAvText}>{initial(c.name)}</Text></View>
                  <View style={s.friendRowInfo}>
                    <Text style={s.friendRowName} numberOfLines={1}>{c.name}</Text>
                    <Text style={s.friendRowSub} numberOfLines={1}>{c.phones[0] || c.emails[0]}</Text>
                  </View>
                  <TouchableOpacity
                    style={s.addFriendBtn}
                    onPress={() => { Haptics.selectionAsync().catch(() => {}); (c.phones[0] ? inviteBySms(c.phones[0], myUsername) : inviteByEmail(c.emails[0], myUsername)).catch(() => Alert.alert('Erreur', "Impossible d'ouvrir l'invitation.")); }}
                  >
                    <Text style={s.addFriendBtnText}>Inviter</Text>
                  </TouchableOpacity>
                </View>
              );
            }}
          />
        )}
      </View>
    </Modal>
  );
}

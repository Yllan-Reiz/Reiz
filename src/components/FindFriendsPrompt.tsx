import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { currentUser } from '../lib/supabase';
import { contactsAvailable } from '../lib/contacts';
import { ContactsScreen } from './ContactsScreen';
import { GlassSurface } from './GlassSurface';
import { F } from '../styles';

// À l'inscription : « Retrouve tes amis ». S'ouvre UNE SEULE FOIS, pour un compte tout neuf (moins de 2 jours),
// quelques secondes après l'arrivée dans l'app. Le système demande l'autorisation seulement si tu touches
// « Trouver mes amis » ; « Plus tard » ne demande rien (la fonction reste dans l'onglet Amis).
const KEY = 'reiz.contacts.prompted';

export function FindFriendsPrompt() {
  const insets = useSafeAreaInsets();
  const [show, setShow] = useState(false);
  const [list, setList] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!contactsAvailable()) return;
      const user = await currentUser();
      if (!user?.created_at || Date.now() - new Date(user.created_at).getTime() > 2 * 24 * 3600 * 1000) return;
      if (await AsyncStorage.getItem(KEY)) return;
      setTimeout(() => { if (alive) { setShow(true); AsyncStorage.setItem(KEY, '1').catch(() => {}); } }, 2000);
    })().catch(() => {});
    return () => { alive = false; };
  }, []);

  return (
    <>
      <Modal visible={show} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShow(false)}>
        <View style={{ flex: 1, backgroundColor: '#0a0a0a', padding: 24, paddingBottom: insets.bottom + 20, justifyContent: 'center' }}>
          <View style={{ alignItems: 'center' }}>
            <GlassSurface radius={48} style={{ width: 96, height: 96, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="people" size={42} color="#fff" />
            </GlassSurface>
            <Text style={{ color: '#fff', fontSize: 32, fontFamily: F.black, letterSpacing: -1, marginTop: 24, textAlign: 'center' }}>Retrouve tes amis</Text>
            <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 16, lineHeight: 24, fontFamily: F.regular, marginTop: 12, textAlign: 'center' }}>
              Reiz est fait pour s'entraîner avec les gens qu'on connaît. Vois lesquels de tes contacts sont déjà là, et invite les autres en un tap.
            </Text>
            <Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: 13, lineHeight: 19, fontFamily: F.regular, marginTop: 14, textAlign: 'center' }}>
              Tes contacts restent sur ton téléphone : Reiz ne les enregistre jamais.
            </Text>
          </View>
          <TouchableOpacity onPress={() => { setShow(false); setTimeout(() => setList(true), 400); }} activeOpacity={0.85} style={{ backgroundColor: '#fff', borderRadius: 18, paddingVertical: 16, alignItems: 'center', marginTop: 36 }}>
            <Text style={{ color: '#000', fontSize: 16, fontFamily: F.extrabold }}>Trouver mes amis</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setShow(false)} style={{ paddingVertical: 16, alignItems: 'center' }}>
            <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 15, fontFamily: F.semibold }}>Plus tard</Text>
          </TouchableOpacity>
        </View>
      </Modal>
      <ContactsScreen visible={list} onClose={() => setList(false)} />
    </>
  );
}

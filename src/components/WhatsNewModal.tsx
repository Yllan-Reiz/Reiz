import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, Modal, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { NewsVideo } from './NewsVideo';
import { currentUser } from '../lib/supabase';
import { CHANGELOG, changelogUnseen, markChangelogSeen } from '../lib/changelog';
import { F, s as st } from '../styles';

// La page des nouveautés : elle s'ouvre UNE SEULE FOIS, au lancement de l'app après une mise à jour,
// puis plus jamais pour cette version (lib/changelog.ts garde la version vue sur le téléphone).
// Un compte tout neuf ne la voit pas : rien n'est nouveau pour lui.
export function WhatsNewModal() {
  const insets = useSafeAreaInsets();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const user = await currentUser();
      if (!user) return;
      const createdAt = user.created_at ? new Date(user.created_at).getTime() : 0;
      if (Date.now() - createdAt < 2 * 24 * 3600 * 1000) { await markChangelogSeen(); return; }
      if (await changelogUnseen()) setTimeout(() => { if (alive) setVisible(true); }, 900);
    })();
    return () => { alive = false; };
  }, []);

  const close = () => {
    Haptics.selectionAsync().catch(() => {});
    setVisible(false);
    markChangelogSeen();
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={close}>
      <View style={{ flex: 1, backgroundColor: '#0a0a0a' }}>
        <ScrollView contentContainerStyle={{ padding: 24, paddingTop: 32, paddingBottom: 140 }} showsVerticalScrollIndicator={false}>
          <Text style={{ color: 'rgba(255,255,255,0.55)', fontSize: 11, fontFamily: F.bold, letterSpacing: 1.5 }}>NOUVEAUTÉS</Text>
          <Text style={{ color: '#fff', fontSize: 34, fontFamily: F.black, letterSpacing: -1.1, marginTop: 8 }}>{CHANGELOG.title}</Text>
          <Text style={{ color: 'rgba(255,255,255,0.65)', fontSize: 15, lineHeight: 22, fontFamily: F.regular, marginTop: 8 }}>{CHANGELOG.subtitle}</Text>

          {!!CHANGELOG.video && <View style={{ marginTop: 22 }}><NewsVideo uri={CHANGELOG.video} ratio={CHANGELOG.videoRatio} /></View>}

          <View style={{ marginTop: 28, gap: 22 }}>
            {CHANGELOG.items.map(it => (
              <View key={it.title} style={{ flexDirection: 'row', gap: 14 }}>
                <View style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: '#161616', borderWidth: 1, borderColor: '#242424', alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontSize: 22 }}>{it.emoji}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: '#fff', fontSize: 17, fontFamily: F.bold, letterSpacing: -0.2 }}>{it.title}</Text>
                  <Text style={{ color: 'rgba(255,255,255,0.65)', fontSize: 14, lineHeight: 21, fontFamily: F.regular, marginTop: 3 }}>{it.text}</Text>
                </View>
              </View>
            ))}
          </View>
        </ScrollView>

        {/* Le bouton reste en bas sur un fond plein (le texte ne passe plus dessous), précédé d'un court fondu. */}
        <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0 }} pointerEvents="box-none">
          <LinearGradient colors={['rgba(10,10,10,0)', '#0a0a0a']} style={{ height: 28 }} pointerEvents="none" />
          <View style={{ paddingHorizontal: 24, paddingTop: 4, paddingBottom: insets.bottom + 16, backgroundColor: '#0a0a0a' }}>
            <TouchableOpacity onPress={close} activeOpacity={0.85} style={st.btn}>
              <Text style={st.btnText}>C'est parti</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, Modal, Pressable, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { registerChoiceHost, type Choice, type ChoiceRequest } from '../lib/choose';
import { F } from '../styles';
import { t } from '../i18n';

// La feuille de choix d'Android (voir lib/choose.ts) : tous les boutons, un « Annuler » toujours présent, et elle se
// ferme en touchant à côté ou avec le bouton retour. Montée une fois dans App.tsx.
export function ChoiceSheetHost() {
  const insets = useSafeAreaInsets();
  const [req, setReq] = useState<ChoiceRequest | null>(null);
  useEffect(() => registerChoiceHost(setReq), []);

  const cancel = req?.buttons.find(b => b.style === 'cancel');
  const others = req?.buttons.filter(b => b.style !== 'cancel') ?? [];
  // La feuille se ferme d'abord : le choix peut ouvrir l'appareil photo, la galerie ou une autre fenêtre.
  const pick = (b?: Choice) => { setReq(null); if (b?.onPress) setTimeout(b.onPress, 120); };

  return (
    <Modal visible={!!req} transparent animationType="fade" statusBarTranslucent onRequestClose={() => pick(cancel)}>
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(10,10,10,0.7)', justifyContent: 'flex-end' }} onPress={() => pick(cancel)} accessibilityLabel={t('common.cancel')}>
        <Pressable onPress={() => {}} style={{ backgroundColor: '#161616', borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingTop: 20, paddingHorizontal: 16, paddingBottom: Math.max(insets.bottom, 16) + 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' }}>
          {!!req?.title && <Text style={{ color: '#fff', fontSize: 18, fontFamily: F.extrabold, textAlign: 'center', paddingHorizontal: 12 }}>{req.title}</Text>}
          {!!req?.message && <Text style={{ color: 'rgba(255,255,255,0.65)', fontSize: 14, lineHeight: 20, fontFamily: F.regular, textAlign: 'center', marginTop: 6, paddingHorizontal: 12 }}>{req.message}</Text>}
          <ScrollView style={{ marginTop: 14, maxHeight: 380 }} showsVerticalScrollIndicator={false}>
            {others.map((b, i) => (
              <TouchableOpacity key={`${i}-${b.text}`} onPress={() => pick(b)} activeOpacity={0.8} accessibilityRole="button"
                style={{ minHeight: 54, borderRadius: 18, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16, marginBottom: 8, backgroundColor: 'rgba(255,255,255,0.08)' }}>
                <Text style={{ color: b.style === 'destructive' ? '#ff453a' : '#fff', fontSize: 16, fontFamily: F.bold, textAlign: 'center' }}>{b.text}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <TouchableOpacity onPress={() => pick(cancel)} activeOpacity={0.8} accessibilityRole="button" style={{ minHeight: 54, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 16, fontFamily: F.semibold }}>{cancel?.text ?? t('common.cancel')}</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

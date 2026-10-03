import { View, Text, TouchableOpacity, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { GlassSurface } from './GlassSurface';
import { loadPlaces, announcePresence, ANNOUNCE_MESSAGES } from '../lib/presence';
import { F } from '../styles';

// Bouton du fil : « Je suis à la salle ». Prévient le cercle proche en un tap, sans localisation.
export function PresenceButton() {
  const send = async (label: string) => Alert.alert(...ANNOUNCE_MESSAGES[await announcePresence(label, 'manual')]);

  const go = async () => {
    const places = await loadPlaces();
    if (places.length === 0) {
      Alert.alert('Prévenir ton cercle proche ?', 'Ils recevront une alerte : tu es à la salle, ils peuvent venir te rejoindre.', [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Je suis à la salle', onPress: () => send('la salle') },
      ]);
      return;
    }
    Alert.alert('Où es-tu ?', 'Ton cercle proche sera prévenu.', [
      ...places.map(p => ({ text: p.label, onPress: () => send(p.label) })),
      { text: 'Un autre endroit', onPress: () => send('la salle') },
      { text: 'Annuler', style: 'cancel' as const },
    ]);
  };

  return (
    <TouchableOpacity onPress={go} activeOpacity={0.85} style={{ marginBottom: 14 }} accessibilityLabel="Je suis à la salle, prévenir mon cercle proche">
      <GlassSurface radius={22}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 13 }}>
          <Text style={{ fontSize: 20 }}>📍</Text>
          <View style={{ flex: 1 }}>
            <Text style={{ color: '#fff', fontSize: 15, fontFamily: F.bold }}>Je suis à la salle</Text>
            <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, fontFamily: F.regular, marginTop: 1 }}>Prévenir mon cercle proche</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.6)" />
        </View>
      </GlassSurface>
    </TouchableOpacity>
  );
}

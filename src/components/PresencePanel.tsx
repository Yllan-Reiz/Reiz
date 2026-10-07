import { useEffect, useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, TextInput, Switch, Alert, Linking, ActivityIndicator, AppState, Keyboard } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { GlassSurface } from './GlassSurface';
import {
  Place, PermState, loadPlaces, isAutoEnabled, permissionState, setAutoEnabled, addPlaceHere, removePlace,
  announcePresence, ANNOUNCE_MESSAGES, AUTO_CONSENT, MAX_PLACES, COOLDOWN_HOURS, AUTO_SUPPORTED,
} from '../lib/presence';
import { F } from '../styles';

// Réglages > « Prévenir mon cercle proche ». Rien ne démarre sans un « Continuer » explicite
// de l'utilisateur : l'écran d'explication passe AVANT la demande d'autorisation du système.
export function PresencePanel() {
  const [places, setPlaces] = useState<Place[]>([]);
  const [auto, setAuto] = useState(false);
  const [perm, setPerm] = useState<PermState | null>(null);
  const [label, setLabel] = useState('');
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    if (!AUTO_SUPPORTED) return; // Android : pas de lieux ni de détection, seulement le bouton manuel
    setPlaces(await loadPlaces());
    setAuto(await isAutoEnabled());
    setPerm(await permissionState());
  }, []);
  useEffect(() => {
    reload();
    // Retour depuis les réglages iPhone : on relit l'autorisation.
    const sub = AppState.addEventListener('change', st => { if (st === 'active') reload(); });
    return () => sub.remove();
  }, [reload]);

  const openSettings = () => Linking.openSettings().catch(() => {});

  const toggleAuto = (next: boolean) => {
    if (!next) { setAutoEnabled(false).then(reload); return; }
    // Consentement : on explique d'abord, le système demande ensuite.
    Alert.alert(
      ...AUTO_CONSENT,
      [
        { text: 'Pas maintenant', style: 'cancel' },
        {
          text: 'Continuer',
          onPress: async () => {
            const r = await setAutoEnabled(true);
            await reload();
            if (r === 'denied') {
              Alert.alert('Autorisation refusée', "Pour activer la détection, choisis « Toujours » dans les réglages de localisation de Reiz.", [
                { text: 'Annuler', style: 'cancel' },
                { text: 'Ouvrir les réglages', onPress: openSettings },
              ]);
            }
          },
        },
      ],
    );
  };

  const addHere = async () => {
    setBusy(true);
    try {
      await addPlaceHere(label);
      setLabel('');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      // Un lieu enregistré mais une détection coupée ne prévient personne : on propose de l'activer.
      if (!auto) toggleAuto(true);
    } catch (e: any) {
      if (e?.message === 'denied') {
        Alert.alert('Localisation refusée', "Autorise la localisation de Reiz dans les réglages pour enregistrer ce lieu.", [
          { text: 'Annuler', style: 'cancel' }, { text: 'Ouvrir les réglages', onPress: openSettings },
        ]);
      } else if (e?.message === 'max') {
        Alert.alert('Lieux', `${MAX_PLACES} lieux maximum. Supprime-en un d'abord.`);
      } else {
        Alert.alert('Erreur', "Impossible de lire ta position. Réessaie dehors ou près d'une fenêtre.");
      }
    }
    setBusy(false);
    reload();
  };

  const delPlace = (p: Place) =>
    Alert.alert(`Supprimer « ${p.label} » ?`, 'Reiz ne te détectera plus à cet endroit.', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Supprimer', style: 'destructive', onPress: async () => { await removePlace(p.id); reload(); } },
    ]);

  const notifyNow = async () => {
    const r = await announcePresence('la salle', 'manual');
    Alert.alert(...ANNOUNCE_MESSAGES[r]);
  };

  const needsAlways = auto && perm && perm.bg !== 'granted';

  return (
    <View style={{ padding: 16, paddingBottom: 40 }}>
      <GlassSurface radius={24}>
        <View style={{ padding: 18 }}>
          <Text style={{ color: '#fff', fontSize: 19, fontFamily: F.black, letterSpacing: -0.4 }}>Prévenir mon cercle proche</Text>
          <Text style={{ color: 'rgba(255,255,255,0.75)', fontSize: 14, lineHeight: 21, fontFamily: F.regular, marginTop: 8 }}>
            Quand tu arrives à ta salle ou à ton terrain, ton cercle proche reçoit « tu es à la salle » et peut venir t'y rejoindre.
          </Text>
          {(AUTO_SUPPORTED ? [
            'Facultatif : tu choisis les lieux.',
            'Tes coordonnées restent sur ton téléphone. Elles ne sont jamais envoyées.',
            `Seul ton cercle proche est prévenu, une fois toutes les ${COOLDOWN_HOURS} heures au maximum.`,
            'Tu peux tout désactiver à tout moment.',
          ] : [
            'Un simple bouton : aucune localisation n\'est utilisée.',
            `Seul ton cercle proche est prévenu, une fois toutes les ${COOLDOWN_HOURS} heures au maximum.`,
          ]).map(t => (
            <View key={t} style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
              <Ionicons name="checkmark-circle" size={18} color="#fff" style={{ marginTop: 1 }} />
              <Text style={{ flex: 1, color: '#ddd', fontSize: 13, lineHeight: 19, fontFamily: F.regular }}>{t}</Text>
            </View>
          ))}
        </View>
      </GlassSurface>

      {AUTO_SUPPORTED && (<>
      <View style={{ marginTop: 20, backgroundColor: '#111', borderRadius: 18, borderWidth: 1, borderColor: '#1c1c1c', overflow: 'hidden' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 }}>
          <Ionicons name="location-outline" size={20} color="#bbb" />
          <View style={{ flex: 1 }}>
            <Text style={{ color: '#fff', fontSize: 15, fontFamily: F.semibold }}>Détection automatique</Text>
            <Text style={{ color: '#777', fontSize: 12, fontFamily: F.regular, marginTop: 2 }}>{auto ? 'Activée' : 'Désactivée'}</Text>
          </View>
          <Switch value={auto} onValueChange={toggleAuto} trackColor={{ true: '#fff', false: '#333' }} thumbColor={auto ? '#000' : '#999'} ios_backgroundColor="#333" />
        </View>
        {needsAlways && (
          <TouchableOpacity onPress={openSettings} style={{ paddingHorizontal: 16, paddingBottom: 16 }}>
            <Text style={{ color: '#ff9f43', fontSize: 13, lineHeight: 19, fontFamily: F.semibold }}>
              L'autorisation « Toujours » est nécessaire pour détecter ton arrivée quand l'appli est fermée. Touche ici pour la régler.
            </Text>
          </TouchableOpacity>
        )}
      </View>

      <Text style={{ fontSize: 11, color: '#777', fontFamily: F.bold, letterSpacing: 1.5, marginTop: 24, marginBottom: 8, marginLeft: 4 }}>MES LIEUX D'ENTRAÎNEMENT</Text>
      <View style={{ backgroundColor: '#111', borderRadius: 18, borderWidth: 1, borderColor: '#1c1c1c', overflow: 'hidden' }}>
        {places.length === 0 && (
          <Text style={{ color: '#777', fontSize: 13, lineHeight: 19, padding: 16, fontFamily: F.regular }}>
            Aucun lieu pour l'instant. Rends-toi à ta salle, donne-lui un nom puis touche « Ajouter l'endroit où je suis ».
          </Text>
        )}
        {places.map((p, i) => (
          <View key={p.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderTopWidth: i ? 1 : 0, borderTopColor: '#1c1c1c' }}>
            <Ionicons name="location" size={18} color="#fff" />
            <View style={{ flex: 1 }}>
              <Text style={{ color: '#fff', fontSize: 15, fontFamily: F.semibold }}>{p.label}</Text>
              <Text style={{ color: '#777', fontSize: 12, fontFamily: F.regular }}>Détecté dans un rayon de {p.radius} m</Text>
            </View>
            <TouchableOpacity onPress={() => delPlace(p)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityLabel={`Supprimer ${p.label}`}>
              <Ionicons name="trash-outline" size={18} color="#ff453a" />
            </TouchableOpacity>
          </View>
        ))}
        <View style={{ padding: 16, borderTopWidth: places.length ? 1 : 0, borderTopColor: '#1c1c1c', gap: 10 }}>
          <TextInput
            value={label}
            onChangeText={setLabel}
            placeholder="Nom du lieu (ex : Basic-Fit, Stade)"
            placeholderTextColor="#666"
            maxLength={40}
            returnKeyType="done"
            onSubmitEditing={() => Keyboard.dismiss()}
            style={{ backgroundColor: '#1a1a1a', borderWidth: 1.5, borderColor: '#2a2a2a', borderRadius: 14, padding: 13, fontSize: 14, color: '#fff', fontFamily: F.regular }}
          />
          <TouchableOpacity onPress={busy ? undefined : addHere} activeOpacity={0.85} style={{ backgroundColor: '#fff', borderRadius: 16, paddingVertical: 14, alignItems: 'center' }}>
            {busy ? <ActivityIndicator color="#000" /> : <Text style={{ color: '#000', fontSize: 14, fontFamily: F.extrabold }}>Ajouter l'endroit où je suis</Text>}
          </TouchableOpacity>
        </View>
      </View>
      </>)}

      <TouchableOpacity onPress={notifyNow} activeOpacity={0.85} style={{ marginTop: 20 }}>
        <GlassSurface radius={18}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 }}>
            <Text style={{ fontSize: 20 }}>💪</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ color: '#fff', fontSize: 15, fontFamily: F.bold }}>Je suis à la salle, prévenir maintenant</Text>
              <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, fontFamily: F.regular, marginTop: 2 }}>Sans localisation : un simple bouton</Text>
            </View>
          </View>
        </GlassSurface>
      </TouchableOpacity>
    </View>
  );
}

import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, Modal, ScrollView, Alert, ActivityIndicator } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { GlassSurface, GlassCard } from './GlassSurface';
import { supabase } from '../lib/supabase';
import { frError } from '../lib/helpers';
import { Objective } from '../lib/types';
import { ALL_DAYS, hasSchedule, GUTTER } from '../constants';
import { TrainingDaysPicker } from './TrainingDays';
import { F } from '../styles';

// Modifier un objectif déjà créé : qui le voit, les jours où tu t'entraînes, ou le supprimer.
// Même feuille depuis l'onglet des objectifs et depuis le profil.
const VISIBILITY = [
  { key: 'friends', label: 'Mon cercle' },
  { key: 'close', label: '★ Proches' },
  { key: 'private', label: 'Privé' },
  { key: 'public', label: 'Public' },
];
const VIS_HINT: Record<string, string> = {
  friends: 'Tous tes amis le voient.',
  close: "Seuls les amis de ton cercle proche (marqués d'une étoile) le voient.",
  private: 'Toi seul le vois.',
  public: 'Tout le monde peut le voir.',
};

const sortedOrNull = (d?: number[] | null) => (hasSchedule(d) ? [...d!].sort((a, b) => a - b) : null);

export function ObjectiveEditSheet({ objective, onClose, onChanged, onDelete }: {
  objective: Objective | null;
  onClose: () => void;
  /** Ce qui vient d'être enregistré, pour mettre à jour l'écran sans tout recharger. */
  onChanged: (patch: Partial<Objective>) => void;
  onDelete: (o: Objective) => void;
}) {
  const [visibility, setVisibility] = useState('friends');
  const [days, setDays] = useState<number[]>(ALL_DAYS);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!objective) return;
    setVisibility(objective.visibility || 'friends');
    setDays(hasSchedule(objective.training_days) ? objective.training_days! : ALL_DAYS);
    setSaving(false);
  }, [objective]);

  const save = async () => {
    if (!objective || saving) return;
    if (days.length === 0) { Alert.alert("Jours d'entraînement", "Choisis au moins un jour où tu t'entraînes."); return; }
    // On n'envoie que ce qui change : modifier la visibilité ne dépend pas de la colonne des jours.
    const newDays = days.length === 7 ? null : [...days].sort((a, b) => a - b);
    const patch: Partial<Objective> = {};
    if (visibility !== objective.visibility) patch.visibility = visibility;
    if (JSON.stringify(newDays) !== JSON.stringify(sortedOrNull(objective.training_days))) patch.training_days = newDays;
    if (Object.keys(patch).length === 0) { onClose(); return; }
    setSaving(true);
    const { error } = await supabase.from('objectives').update(patch).eq('id', objective.id);
    setSaving(false);
    if (error) {
      Alert.alert('Erreur', /training_days/i.test(error.message || '') ? "Les jours d'entraînement ne sont pas encore disponibles. Réessaie un peu plus tard." : frError(error));
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    onChanged(patch);
    onClose();
  };

  const remove = () => {
    if (!objective) return;
    const o = objective;
    onClose();
    // Laisse la feuille se refermer avant d'afficher la confirmation.
    setTimeout(() => onDelete(o), 350);
  };

  // Même DA que les onglets : fond noir, sections en verre, choix actif en blanc.
  return (
    <Modal visible={!!objective} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: '#0a0a0a' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: GUTTER, paddingTop: 16, paddingBottom: 8 }}>
          <TouchableOpacity onPress={onClose} accessibilityLabel="Annuler" hitSlop={8}>
            <GlassSurface radius={20} variant="clear" style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="close" size={20} color="#fff" />
            </GlassSurface>
          </TouchableOpacity>
          <TouchableOpacity onPress={saving ? undefined : save} activeOpacity={0.85} style={{ height: 40, borderRadius: 20, paddingHorizontal: 18, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', minWidth: 110 }}>
            {saving ? <ActivityIndicator color="#000" /> : <Text style={{ color: '#000', fontSize: 14, fontFamily: F.extrabold }}>Enregistrer</Text>}
          </TouchableOpacity>
        </View>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: GUTTER, paddingTop: 12, paddingBottom: 60 }}>
          <Text style={{ color: 'rgba(255,255,255,0.55)', fontSize: 11, fontFamily: F.bold, letterSpacing: 1.5 }}>MODIFIER L'OBJECTIF</Text>
          {!!objective && (
            <Text style={{ color: '#fff', fontSize: 30, lineHeight: 34, fontFamily: F.black, letterSpacing: -0.9, marginTop: 6 }} numberOfLines={2}>{objective.title}</Text>
          )}

          <GlassCard radius={28} style={{ marginTop: 22 }}>
            <View style={{ padding: 18 }}>
              <Text style={label}>QUI VOIT ?</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
                {VISIBILITY.map(v => {
                  const on = visibility === v.key;
                  return (
                    <TouchableOpacity key={v.key} onPress={() => { Haptics.selectionAsync().catch(() => {}); setVisibility(v.key); }} activeOpacity={0.85} accessibilityState={{ selected: on }}
                      style={{ height: 38, borderRadius: 19, paddingHorizontal: 16, justifyContent: 'center', backgroundColor: on ? '#fff' : 'rgba(255,255,255,0.12)', borderWidth: 1, borderColor: on ? '#fff' : 'rgba(255,255,255,0.14)' }}>
                      <Text style={{ color: on ? '#000' : '#fff', fontSize: 14, fontFamily: F.bold }}>{v.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, lineHeight: 18, fontFamily: F.regular, marginTop: 12 }}>{VIS_HINT[visibility]}</Text>
            </View>
          </GlassCard>

          <GlassCard radius={28} style={{ marginTop: 14 }}>
            <View style={{ padding: 18 }}>
              <Text style={[label, { marginBottom: 12 }]}>JOURS D'ENTRAÎNEMENT</Text>
              <TrainingDaysPicker value={days} onChange={setDays} />
            </View>
          </GlassCard>

          <TouchableOpacity onPress={remove} activeOpacity={0.85} style={{ marginTop: 26 }} accessibilityRole="button">
            <GlassSurface radius={20} tintColor="rgba(255,69,58,0.12)" style={{ height: 52, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, borderWidth: 1, borderColor: 'rgba(255,69,58,0.35)' }}>
              <Ionicons name="trash-outline" size={18} color="#ff453a" />
              <Text style={{ color: '#ff453a', fontSize: 15, fontFamily: F.bold }}>Supprimer l'objectif</Text>
            </GlassSurface>
          </TouchableOpacity>
        </ScrollView>
      </View>
    </Modal>
  );
}

const label = { color: 'rgba(255,255,255,0.55)', fontSize: 11, fontFamily: F.bold, letterSpacing: 1.5 } as const;

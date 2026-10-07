import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, Modal, ScrollView, Alert, ActivityIndicator } from 'react-native';
import * as Haptics from 'expo-haptics';
import { supabase } from '../lib/supabase';
import { frError } from '../lib/helpers';
import { Objective } from '../lib/types';
import { ALL_DAYS, hasSchedule } from '../constants';
import { TrainingDaysPicker } from './TrainingDays';
import { s, F } from '../styles';

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

  return (
    <Modal visible={!!objective} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={s.modalContainer}>
        <View style={s.modalHeader}>
          <TouchableOpacity onPress={onClose}><Text style={s.modalCancel}>Annuler</Text></TouchableOpacity>
          <Text style={s.modalTitle}>Modifier</Text>
          <TouchableOpacity onPress={saving ? undefined : save}>
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.modalSave}>Enregistrer</Text>}
          </TouchableOpacity>
        </View>
        <ScrollView style={s.modalBody} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 60 }}>
          {!!objective && (
            <Text style={{ color: '#fff', fontSize: 20, fontFamily: F.black, letterSpacing: -0.4, marginBottom: 6 }} numberOfLines={2}>{objective.emoji} {objective.title}</Text>
          )}

          <View style={s.inputBlock}>
            <Text style={s.inputLabel}>QUI VOIT ?</Text>
            <View style={s.visToggle}>
              {VISIBILITY.map(v => (
                <TouchableOpacity key={v.key} style={[s.visOpt, visibility === v.key && s.visOptActive]} onPress={() => { Haptics.selectionAsync().catch(() => {}); setVisibility(v.key); }}>
                  <Text style={[s.visOptText, visibility === v.key && s.visOptTextActive]}>{v.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={s.fieldHint}>{VIS_HINT[visibility]}</Text>
          </View>

          <View style={s.inputBlock}>
            <Text style={s.inputLabel}>JOURS D'ENTRAÎNEMENT</Text>
            <TrainingDaysPicker value={days} onChange={setDays} />
          </View>

          <TouchableOpacity onPress={remove} activeOpacity={0.8} style={{ marginTop: 34, paddingVertical: 15, alignItems: 'center', borderRadius: 16, borderWidth: 1, borderColor: '#3a1a1a', backgroundColor: '#1a0f0f' }}>
            <Text style={{ color: '#ff453a', fontSize: 15, fontFamily: F.bold }}>Supprimer l'objectif</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    </Modal>
  );
}

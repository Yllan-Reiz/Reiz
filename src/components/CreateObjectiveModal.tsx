import { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput, ActivityIndicator, Modal, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import * as Haptics from 'expo-haptics';
import { supabase, currentUser } from '../lib/supabase';
import { frError, parseGoal } from '../lib/helpers';
import { EMOJI_LIST, QUICK_UNITS, ALL_DAYS } from '../constants';
import { s } from '../styles';
import { TrainingDaysPicker } from './TrainingDays';

export function CreateObjectiveModal({ visible, onClose, onCreated }: { visible: boolean; onClose: () => void; onCreated: () => void }) {
  const [title, setTitle] = useState('');
  const [emoji, setEmoji] = useState('🎯');
  const [unit, setUnit] = useState('séances');
  const [targetValue, setTargetValue] = useState('');
  const [visibility, setVisibility] = useState('friends');
  // Jours où tu t'entraînes (par défaut tous) : les rappels et ton cercle ne parlent que de ceux-là.
  const [days, setDays] = useState<number[]>(ALL_DAYS);
  const [saving, setSaving] = useState(false);
  // Tant que « Combien ? » n'a pas été touché, il se remplit tout seul d'après le nom.
  const [touched, setTouched] = useState(false);

  const onTitle = (text: string) => {
    setTitle(text);
    if (touched) return;
    const g = parseGoal(text);
    if (g) { setTargetValue(String(g.target).replace('.', ',')); setUnit(g.unit); }
    else setTargetValue('');
  };

  const reset = () => { setTitle(''); setEmoji('🎯'); setUnit('séances'); setTargetValue(''); setVisibility('friends'); setTouched(false); setDays(ALL_DAYS); };

  // Un objectif se compte toujours dans son unité (kg, séances, km...), jamais en %.
  const hasTarget = targetValue.trim() !== '';
  const finalUnit = unit;
  const finalTarget = Number(targetValue.replace(',', '.'));

  const handleCreate = async () => {
    if (!title.trim()) { Alert.alert('Erreur', 'Donne un nom à ton objectif !'); return; }
    if (!hasTarget) { Alert.alert('Il manque le chiffre', 'Indique combien tu vises : 170 kg, 4 séances, 10 km...'); return; }
    const target = finalTarget;
    if (isNaN(target) || target <= 0) { Alert.alert('Erreur', 'Le nombre doit être supérieur à 0.'); return; }
    if (days.length === 0) { Alert.alert('Jours d\'entraînement', 'Choisis au moins un jour où tu t\'entraînes.'); return; }
    setSaving(true);
    const user = await currentUser();
    if (!user) { setSaving(false); Alert.alert('Erreur', 'Tu dois être connecté.'); return; }
    const row = {
      user_id: user.id, title: title.trim(), emoji,
      target_value: target, current_value: 0,
      unit: finalUnit, visibility,
      duration_days: null, // un objectif n'a pas de date de fin
    };
    // Tous les jours = rien à enregistrer. Si la base ne connaît pas encore la colonne, on crée l'objectif sans.
    const trainingDays = days.length === 7 ? null : days;
    let { error } = await supabase.from('objectives').insert(trainingDays ? { ...row, training_days: trainingDays } : row);
    if (error && trainingDays && /training_days/i.test(error.message || '')) {
      ({ error } = await supabase.from('objectives').insert(row));
    }
    setSaving(false);
    if (error) { Alert.alert('Erreur', frError(error)); return; }
    Alert.alert('Objectif créé', `"${title}" est ajouté à tes objectifs.`);
    reset(); onCreated();
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      {/* Même correctif que les commentaires : dans une feuille (pageSheet),
          KeyboardAvoidingView calcule mal et le clavier cachait « Combien ? ».
          Sur iOS, la ScrollView gère le clavier elle-même. */}
      <KeyboardAvoidingView style={s.modalContainer} behavior="height" enabled={Platform.OS === 'android'}>
        <View style={s.modalHeader}>
          <TouchableOpacity onPress={() => { reset(); onClose(); }}><Text style={s.modalCancel}>Annuler</Text></TouchableOpacity>
          <Text style={s.modalTitle}>Nouvel objectif</Text>
          <TouchableOpacity onPress={saving ? undefined : handleCreate}>
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.modalSave}>Créer</Text>}
          </TouchableOpacity>
        </View>
        <ScrollView
          style={s.modalBody}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          automaticallyAdjustKeyboardInsets
        >
          <View style={s.inputBlock}>
            <Text style={s.inputLabel}>NOM DE L'OBJECTIF</Text>
            <TextInput style={s.inputField} placeholder="100 kg au bench, ou tu bluffes ?" placeholderTextColor="#666" value={title} onChangeText={onTitle} autoCapitalize="sentences" maxLength={80} />
          </View>

          <Text style={[s.inputLabel, s.inputLabelSpaced]}>EMOJI</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.emojiRow} contentContainerStyle={{ gap: 8, paddingHorizontal: 20 }}>
            {EMOJI_LIST.map(e => (
              <TouchableOpacity
                key={e}
                style={[s.emojiItem, emoji === e && s.emojiItemActive]}
                onPress={() => { Haptics.selectionAsync().catch(() => {}); setEmoji(e); }}
              >
                <Text style={s.emojiItemText}>{e}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <View style={s.inputBlock}>
            <Text style={s.inputLabel}>COMBIEN ?</Text>
            <View style={s.targetRow}>
              <TextInput
                style={[s.inputField, s.targetInput]}
                placeholder="4"
                placeholderTextColor="#666"
                value={targetValue}
                onChangeText={v => { setTouched(true); setTargetValue(v); }}
                keyboardType="decimal-pad"
                maxLength={6}
              />
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                {QUICK_UNITS.map(u => (
                  <TouchableOpacity
                    key={u}
                    style={[s.durationPill, hasTarget && unit === u && s.durationPillActive]}
                    onPress={() => { Haptics.selectionAsync().catch(() => {}); setTouched(true); setUnit(u); }}
                  >
                    <Text style={[s.durationPillText, hasTarget && unit === u && s.durationPillTextActive]}>{u}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
            <Text style={s.fieldHint}>
              {hasTarget
                ? `Tu posteras ta progression en ${unit}, jusqu'à ${targetValue}.`
                : 'Le chiffre que tu vises et son unité : 170 kg, 4 séances, 10 km.'}
            </Text>
          </View>

          <View style={s.inputBlock}>
            <Text style={s.inputLabel}>JOURS D'ENTRAÎNEMENT</Text>
            <TrainingDaysPicker value={days} onChange={setDays} />
          </View>

          <View style={s.inputBlock}>
            <Text style={s.inputLabel}>QUI VOIT ?</Text>
            <View style={s.visToggle}>
              {[{ key: 'friends', label: 'Mon cercle' }, { key: 'close', label: '★ Proches' }, { key: 'private', label: 'Privé' }, { key: 'public', label: 'Public' }].map(v => (
                <TouchableOpacity key={v.key} style={[s.visOpt, visibility === v.key && s.visOptActive]} onPress={() => { Haptics.selectionAsync().catch(() => {}); setVisibility(v.key); }}>
                  <Text style={[s.visOptText, visibility === v.key && s.visOptTextActive]}>{v.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={s.fieldHint}>
              {visibility === 'close' ? 'Seuls les amis de ton cercle proche (marqués d\'une étoile) le voient.' : visibility === 'private' ? 'Toi seul le vois.' : visibility === 'public' ? 'Tout le monde peut le voir.' : 'Tous tes amis le voient.'}
            </Text>
          </View>

          <View style={{ height: 60 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

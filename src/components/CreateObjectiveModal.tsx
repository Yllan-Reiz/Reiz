import { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput, ActivityIndicator, Modal, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import * as Haptics from 'expo-haptics';
import { supabase } from '../lib/supabase';
import { frError, parseGoal } from '../lib/helpers';
import { DURATION_OPTIONS, EMOJI_LIST, QUICK_UNITS } from '../constants';
import { s } from '../styles';
import { WheelPicker } from './WheelPicker';

export function CreateObjectiveModal({ visible, onClose, onCreated }: { visible: boolean; onClose: () => void; onCreated: () => void }) {
  const [title, setTitle] = useState('');
  const [emoji, setEmoji] = useState('🎯');
  const [unit, setUnit] = useState('séances');
  const [targetValue, setTargetValue] = useState('');
  const [visibility, setVisibility] = useState('friends');
  const [duration, setDuration] = useState<number | null>(null); // sans date de fin par défaut
  const [showOptions, setShowOptions] = useState(false);
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

  const reset = () => { setTitle(''); setEmoji('🎯'); setUnit('séances'); setTargetValue(''); setVisibility('friends'); setDuration(null); setShowOptions(false); setTouched(false); };

  // Un objectif se compte toujours dans son unité (kg, séances, km...), jamais en %.
  const hasTarget = targetValue.trim() !== '';
  const finalUnit = unit;
  const finalTarget = Number(targetValue.replace(',', '.'));

  const handleCreate = async () => {
    if (!title.trim()) { Alert.alert('Erreur', 'Donne un nom à ton objectif !'); return; }
    if (!hasTarget) { Alert.alert('Il manque le chiffre', 'Indique combien tu vises : 170 kg, 4 séances, 10 km...'); return; }
    const target = finalTarget;
    if (isNaN(target) || target <= 0) { Alert.alert('Erreur', 'Le nombre doit être supérieur à 0.'); return; }
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); Alert.alert('Erreur', 'Tu dois être connecté.'); return; }
    const { error } = await supabase.from('objectives').insert({
      user_id: user.id, title: title.trim(), emoji,
      target_value: target, current_value: 0,
      unit: finalUnit, visibility,
      duration_days: duration,
    });
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

          <TouchableOpacity
            style={s.optionsToggle}
            onPress={() => { Haptics.selectionAsync().catch(() => {}); setShowOptions(v => !v); }}
          >
            <Text style={s.optionsToggleText}>
              {showOptions ? 'Masquer les options' : 'Options (autre unité, durée, visibilité)'}
            </Text>
            <Text style={s.optionsToggleChevron}>{showOptions ? '▲' : '▼'}</Text>
          </TouchableOpacity>

          {showOptions && (
            <>
              <Text style={[s.inputLabel, s.inputLabelSpaced]}>AUTRE UNITÉ</Text>
              <WheelPicker selected={unit} onSelect={setUnit} />
              <Text style={[s.inputLabel, s.inputLabelSpaced]}>DURÉE</Text>
              <View style={s.durationRow}>
                {DURATION_OPTIONS.map(opt => {
                  const active = duration === opt.value;
                  return (
                    <TouchableOpacity
                      key={opt.label}
                      style={[s.durationPill, active && s.durationPillActive]}
                      onPress={() => { Haptics.selectionAsync().catch(() => {}); setDuration(opt.value); }}
                    >
                      <Text style={[s.durationPillText, active && s.durationPillTextActive]}>{opt.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={[s.inputLabel, s.inputLabelSpaced]}>VISIBILITÉ</Text>
              <View style={s.visToggle}>
                {[{ key: 'friends', label: 'Mon cercle' }, { key: 'close', label: 'Cercle proche' }, { key: 'private', label: 'Privé' }, { key: 'public', label: 'Public' }].map(v => (
                  <TouchableOpacity key={v.key} style={[s.visOpt, visibility === v.key && s.visOptActive]} onPress={() => setVisibility(v.key)}>
                    <Text style={[s.visOptText, visibility === v.key && s.visOptTextActive]}>{v.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}
          <View style={{ height: 60 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

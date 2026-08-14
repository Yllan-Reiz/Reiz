import { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput, ActivityIndicator, Modal, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import * as Haptics from 'expo-haptics';
import { supabase } from '../lib/supabase';
import { frError } from '../lib/helpers';
import { DURATION_OPTIONS, EMOJI_LIST } from '../constants';
import { s } from '../styles';
import { WheelPicker } from './WheelPicker';

export function CreateObjectiveModal({ visible, onClose, onCreated }: { visible: boolean; onClose: () => void; onCreated: () => void }) {
  const [title, setTitle] = useState('');
  const [emoji, setEmoji] = useState('🎯');
  const [unit, setUnit] = useState('%');
  const [targetValue, setTargetValue] = useState('');
  const [visibility, setVisibility] = useState('public');
  const [duration, setDuration] = useState<number | null>(21); // par défaut 21j
  const [saving, setSaving] = useState(false);

  const reset = () => { setTitle(''); setEmoji('🎯'); setUnit('%'); setTargetValue(''); setVisibility('public'); setDuration(21); };

  const handleCreate = async () => {
    if (!title.trim()) { Alert.alert('Erreur', 'Donne un nom à ton objectif !'); return; }
    const target = Number(targetValue);
    if (!targetValue || isNaN(target) || target <= 0) { Alert.alert('Erreur', 'Entre une valeur cible supérieure à 0.'); return; }
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); Alert.alert('Erreur', 'Tu dois être connecté.'); return; }
    const { error } = await supabase.from('objectives').insert({
      user_id: user.id, title: title.trim(), emoji,
      target_value: target, current_value: 0,
      unit: unit, visibility,
      duration_days: duration,
    });
    setSaving(false);
    if (error) { Alert.alert('Erreur', frError(error)); return; }
    Alert.alert('Objectif créé', `"${title}" est ajouté à tes objectifs.`);
    reset(); onCreated();
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView style={s.modalContainer} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
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
        >
          <View style={s.inputBlock}>
            <Text style={s.inputLabel}>NOM DE L'OBJECTIF</Text>
            <TextInput style={s.inputField} placeholder="Ex: Courir 10 km, Lire 12 livres..." placeholderTextColor="#666" value={title} onChangeText={setTitle} autoCapitalize="sentences" maxLength={80} />
          </View>

          <Text style={s.inputLabel}>EMOJI</Text>
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
            <Text style={s.inputLabel}>VALEUR CIBLE</Text>
            <TextInput style={s.inputField} placeholder="Ex: 10, 100, 12..." placeholderTextColor="#666" value={targetValue} onChangeText={setTargetValue} keyboardType="numeric" maxLength={9} />
          </View>

          <Text style={s.inputLabel}>UNITÉ</Text>
          <WheelPicker selected={unit} onSelect={setUnit} />
          <Text style={s.inputLabel}>DURÉE D'ENGAGEMENT</Text>
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

          <Text style={s.inputLabel}>VISIBILITÉ</Text>
          <View style={s.visToggle}>
            {[{ key: 'public', label: 'Public' }, { key: 'friends', label: 'Amis' }, { key: 'private', label: 'Privé' }].map(v => (
              <TouchableOpacity key={v.key} style={[s.visOpt, visibility === v.key && s.visOptActive]} onPress={() => setVisibility(v.key)}>
                <Text style={[s.visOptText, visibility === v.key && s.visOptTextActive]}>{v.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={{ height: 60 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

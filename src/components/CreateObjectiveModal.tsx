import { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput, ActivityIndicator, Modal, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { supabase, currentUser } from '../lib/supabase';
import { frError, parseGoal } from '../lib/helpers';
import { QUICK_UNITS, ALL_DAYS, GUTTER } from '../constants';
import { F } from '../styles';
import { GlassSurface, GlassCard } from './GlassSurface';
import { TrainingDaysPicker } from './TrainingDays';

// Créer un objectif. Même DA que « Modifier l'objectif » : fond noir, sections en verre, choix actif en blanc.
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

// Plus de choix d'emoji à l'écran : il se déduit du nom (et de l'unité), 🎯 par défaut.
const EMOJI_RULES: [RegExp, string][] = [
  [/hyrox|sled|wall ?ball/i, '🛷'],
  [/box|jjb|jiu|mma|judo|lutte|grappl|muay|kick|karat|krav|combat/i, '🥊'],
  [/v[ée]lo|cycl|bike|gravel|spinning/i, '🚴'],
  [/nag|natation|piscine|swim|longueur/i, '🏊'],
  [/courir|course|run|marathon|semi|trail|footing|sprint|\bkm\b/i, '🏃'],
  [/traction|dips|muscle.?up|street|calisth|pompe|planche/i, '🤸'],
  [/escalad|grimp|bloc/i, '🧗'],
  [/foot(?!ing)|soccer/i, '⚽'],
  [/basket/i, '🏀'],
  [/tennis|padel/i, '🎾'],
  [/dorm|sommeil/i, '😴'],
  [/\beau\b|boire|hydrat/i, '💧'],
  [/bench|squat|terre|deadlift|d[ée]velopp|muscu|salle|halt[èe]re|\bkg\b|force|ferri/i, '🏋️'],
];
const guessEmoji = (title: string, unit: string) => EMOJI_RULES.find(([r]) => r.test(`${title} ${unit}`))?.[1] ?? '🎯';

export function CreateObjectiveModal({ visible, onClose, onCreated }: { visible: boolean; onClose: () => void; onCreated: () => void }) {
  const [title, setTitle] = useState('');
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

  const reset = () => { setTitle(''); setUnit('séances'); setTargetValue(''); setVisibility('friends'); setTouched(false); setDays(ALL_DAYS); };

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
      user_id: user.id, title: title.trim(), emoji: guessEmoji(title, finalUnit),
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

  const pick = (fn: () => void) => { Haptics.selectionAsync().catch(() => {}); fn(); };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      {/* Même correctif que les commentaires : dans une feuille (pageSheet),
          KeyboardAvoidingView calcule mal et le clavier cachait « Combien ? ».
          Sur iOS, la ScrollView gère le clavier elle-même. */}
      <KeyboardAvoidingView style={{ flex: 1, backgroundColor: '#0a0a0a' }} behavior="height" enabled={Platform.OS === 'android'}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: GUTTER, paddingTop: 16, paddingBottom: 8 }}>
          <TouchableOpacity onPress={() => { reset(); onClose(); }} accessibilityLabel="Annuler" hitSlop={8}>
            <GlassSurface radius={20} variant="clear" style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="close" size={20} color="#fff" />
            </GlassSurface>
          </TouchableOpacity>
          <TouchableOpacity onPress={saving ? undefined : handleCreate} activeOpacity={0.85} accessibilityRole="button" style={{ height: 40, borderRadius: 20, paddingHorizontal: 18, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', minWidth: 96 }}>
            {saving ? <ActivityIndicator color="#000" /> : <Text style={{ color: '#000', fontSize: 14, fontFamily: F.extrabold }} maxFontSizeMultiplier={1.3}>Créer</Text>}
          </TouchableOpacity>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          automaticallyAdjustKeyboardInsets
          contentContainerStyle={{ paddingHorizontal: GUTTER, paddingTop: 12, paddingBottom: 60 }}
        >
          <Text style={label}>NOUVEL OBJECTIF</Text>
          <Text style={{ color: '#fff', fontSize: 30, lineHeight: 34, fontFamily: F.black, letterSpacing: -0.9, marginTop: 6 }} maxFontSizeMultiplier={1.2}>Fixe ton objectif</Text>

          <GlassCard radius={28} style={{ marginTop: 22 }}>
            <View style={{ padding: 18 }}>
              <Text style={label}>NOM DE L'OBJECTIF</Text>
              <TextInput
                style={field}
                placeholder="100 kg au bench, ou tu bluffes ?"
                placeholderTextColor="rgba(255,255,255,0.4)"
                value={title}
                onChangeText={onTitle}
                autoCapitalize="sentences"
                maxLength={80}
              />
            </View>
          </GlassCard>

          {/* Le chiffre visé et son unité */}
          <GlassCard radius={28} style={{ marginTop: 14 }}>
            <View style={{ padding: 18 }}>
              <Text style={label}>COMBIEN ?</Text>
              <TextInput
                style={[field, { fontSize: 22, fontFamily: F.black }]}
                placeholder="4"
                placeholderTextColor="rgba(255,255,255,0.4)"
                value={targetValue}
                onChangeText={v => { setTouched(true); setTargetValue(v); }}
                keyboardType="decimal-pad"
                maxLength={6}
              />
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
                {QUICK_UNITS.map(u => {
                  const on = hasTarget && unit === u;
                  return (
                    <TouchableOpacity key={u} onPress={() => pick(() => { setTouched(true); setUnit(u); })} activeOpacity={0.85} accessibilityState={{ selected: on }} style={chip(on)}>
                      <Text style={chipText(on)} maxFontSizeMultiplier={1.3}>{u}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <Text style={hint}>
                {hasTarget
                  ? `Tu posteras ta progression en ${unit}, jusqu'à ${targetValue}.`
                  : 'Le chiffre que tu vises et son unité : 170 kg, 4 séances, 10 km.'}
              </Text>
            </View>
          </GlassCard>

          <GlassCard radius={28} style={{ marginTop: 14 }}>
            <View style={{ padding: 18 }}>
              <Text style={[label, { marginBottom: 12 }]}>JOURS D'ENTRAÎNEMENT</Text>
              <TrainingDaysPicker value={days} onChange={setDays} />
            </View>
          </GlassCard>

          <GlassCard radius={28} style={{ marginTop: 14 }}>
            <View style={{ padding: 18 }}>
              <Text style={label}>QUI VOIT ?</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
                {VISIBILITY.map(v => {
                  const on = visibility === v.key;
                  return (
                    <TouchableOpacity key={v.key} onPress={() => pick(() => setVisibility(v.key))} activeOpacity={0.85} accessibilityState={{ selected: on }} style={chip(on)}>
                      <Text style={chipText(on)} maxFontSizeMultiplier={1.3}>{v.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <Text style={hint}>{VIS_HINT[visibility]}</Text>
            </View>
          </GlassCard>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const label = { color: 'rgba(255,255,255,0.55)', fontSize: 11, fontFamily: F.bold, letterSpacing: 1.5 } as const;
const hint = { color: 'rgba(255,255,255,0.6)', fontSize: 13, lineHeight: 18, fontFamily: F.regular, marginTop: 12 } as const;
const field = { marginTop: 12, minHeight: 50, borderRadius: 16, paddingHorizontal: 16, paddingVertical: 12, backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', color: '#fff', fontSize: 16, fontFamily: F.semibold } as const;
const chip = (on: boolean) => ({ height: 38, borderRadius: 19, paddingHorizontal: 16, justifyContent: 'center' as const, backgroundColor: on ? '#fff' : 'rgba(255,255,255,0.12)', borderWidth: 1, borderColor: on ? '#fff' : 'rgba(255,255,255,0.14)' });
const chipText = (on: boolean) => ({ color: on ? '#000' : '#fff', fontSize: 14, fontFamily: F.bold });

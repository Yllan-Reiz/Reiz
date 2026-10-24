import { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput, ActivityIndicator, Modal, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { supabase, currentUser } from '../lib/supabase';
import { frError, parseGoal, num } from '../lib/helpers';
import { QUICK_UNITS, ALL_DAYS, GUTTER } from '../constants';
import { F } from '../styles';
import { GlassSurface, GlassCard } from './GlassSurface';
import { TrainingDaysPicker } from './TrainingDays';
import { t, unitLabel } from '../i18n';

// Créer un objectif. Même DA que « Modifier l'objectif » : fond noir, sections en verre, choix actif en blanc.
const VISIBILITY = [
  { key: 'friends', label: t('objective.visFriends') },
  { key: 'close', label: t('objective.visClose') },
  { key: 'private', label: t('vis.private') },
  { key: 'public', label: t('vis.public') },
];
const VIS_HINT: Record<string, string> = {
  friends: t('objective.hintFriends'),
  close: t('objective.hintClose'),
  private: t('objective.hintPrivate'),
  public: t('objective.hintPublic'),
};

// Plus de choix d'emoji à l'écran : il se déduit du nom (et de l'unité), 🎯 par défaut.
// Mots en français, anglais, espagnol et hébreu.
const EMOJI_RULES: [RegExp, string][] = [
  [/hyrox|sled|wall ?ball/i, '🛷'],
  [/box|jjb|jiu|mma|judo|lutte|lucha|grappl|muay|kick|karat|krav|combat|אגרוף/i, '🥊'],
  [/v[ée]lo|cycl|ciclis|bici|bike|gravel|spinning|אופניים/i, '🚴'],
  [/nag|natation|nata|nadar|piscin|swim|longueur|שחי/i, '🏊'],
  [/courir|course|correr|carrera|run|marathon|marat[oó]n|semi|trail|footing|sprint|\bkm\b|ריצ/i, '🏃'],
  [/traction|dominad|dips|muscle.?up|pull.?up|push.?up|flexion|street|calisth|pompe|planche|מתח/i, '🤸'],
  [/escalad|grimp|climb|bloc/i, '🧗'],
  [/foot(?!ing)|f[uú]tbol|soccer|כדורגל/i, '⚽'],
  [/basket|b[aá]squet|כדורסל/i, '🏀'],
  [/tennis|tenis|padel|טניס/i, '🎾'],
  [/dorm|sommeil|sleep|sue[ñn]o|שינה/i, '😴'],
  [/\beau\b|boire|water|agua|hydrat|hidrat|מים/i, '💧'],
  [/bench|squat|sentadilla|terre|deadlift|d[ée]velopp|muscu|salle|gym|halt[èe]re|pesas|\bkg\b|\blbs?\b|force|fuerza|strength|ferri|כושר/i, '🏋️'],
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
    if (g) { setTargetValue(num(g.target)); setUnit(g.unit); }
    else setTargetValue('');
  };

  const reset = () => { setTitle(''); setUnit('séances'); setTargetValue(''); setVisibility('friends'); setTouched(false); setDays(ALL_DAYS); };

  // Un objectif se compte toujours dans son unité (kg, séances, km...), jamais en %.
  const hasTarget = targetValue.trim() !== '';
  const finalUnit = unit;
  const finalTarget = Number(targetValue.replace(',', '.'));

  const handleCreate = async () => {
    if (!title.trim()) { Alert.alert(t('common.error'), t('objective.needName')); return; }
    if (!hasTarget) { Alert.alert(t('objective.needTargetTitle'), t('objective.needTargetText')); return; }
    const target = finalTarget;
    if (isNaN(target) || target <= 0) { Alert.alert(t('common.error'), t('objective.positive')); return; }
    if (days.length === 0) { Alert.alert(t('welcome.daysTitle'), t('welcome.daysText')); return; }
    setSaving(true);
    const user = await currentUser();
    if (!user) { setSaving(false); Alert.alert(t('common.error'), t('post.mustBeSignedIn')); return; }
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
    if (error) { Alert.alert(t('common.error'), frError(error)); return; }
    Alert.alert(t('objective.createdTitle'), t('objective.createdText', { title }));
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
          <TouchableOpacity onPress={() => { reset(); onClose(); }} accessibilityLabel={t('common.cancel')} hitSlop={8}>
            <GlassSurface radius={20} variant="clear" style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="close" size={20} color="#fff" />
            </GlassSurface>
          </TouchableOpacity>
          <TouchableOpacity onPress={saving ? undefined : handleCreate} activeOpacity={0.85} accessibilityRole="button" style={{ height: 40, borderRadius: 20, paddingHorizontal: 18, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', minWidth: 96 }}>
            {saving ? <ActivityIndicator color="#000" /> : <Text style={{ color: '#000', fontSize: 14, fontFamily: F.extrabold }} maxFontSizeMultiplier={1.3}>{t('objective.create')}</Text>}
          </TouchableOpacity>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          automaticallyAdjustKeyboardInsets
          contentContainerStyle={{ paddingHorizontal: GUTTER, paddingTop: 12, paddingBottom: 60 }}
        >
          <Text style={label}>{t('objective.newLabel')}</Text>
          <Text style={{ color: '#fff', fontSize: 30, lineHeight: 34, fontFamily: F.black, letterSpacing: -0.9, marginTop: 6 }} maxFontSizeMultiplier={1.2}>{t('objective.newTitle')}</Text>

          <GlassCard radius={28} style={{ marginTop: 22 }}>
            <View style={{ padding: 18 }}>
              <Text style={label}>{t('welcome.objNameLabel')}</Text>
              <TextInput
                style={field}
                placeholder={t('objective.namePlaceholder')}
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
              <Text style={label}>{t('objective.howMuch')}</Text>
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
                  // Unité touchée avant le chiffre : elle s'allume tout de suite (avant, rien ne bougeait).
                  const on = (hasTarget || touched) && unit === u;
                  return (
                    <TouchableOpacity key={u} onPress={() => pick(() => { setTouched(true); setUnit(u); })} activeOpacity={0.85} accessibilityState={{ selected: on }} style={chip(on)}>
                      <Text style={chipText(on)} maxFontSizeMultiplier={1.3}>{unitLabel(u)}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <Text style={hint}>
                {hasTarget
                  ? t('objective.unitHint', { unit: unitLabel(unit), target: targetValue })
                  : t('objective.unitHintEmpty')}
              </Text>
            </View>
          </GlassCard>

          <GlassCard radius={28} style={{ marginTop: 14 }}>
            <View style={{ padding: 18 }}>
              <Text style={[label, { marginBottom: 12 }]}>{t('welcome.daysLabel')}</Text>
              <TrainingDaysPicker value={days} onChange={setDays} />
            </View>
          </GlassCard>

          <GlassCard radius={28} style={{ marginTop: 14 }}>
            <View style={{ padding: 18 }}>
              <Text style={label}>{t('objective.whoSees')}</Text>
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

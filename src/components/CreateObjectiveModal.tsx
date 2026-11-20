import { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, Modal, KeyboardAvoidingView, Platform, Alert, Keyboard } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { frError } from '../lib/helpers';
import { ALL_DAYS, GUTTER } from '../constants';
import { F } from '../styles';
import { GlassSurface, GlassCard } from './GlassSurface';
import { TrainingDaysPicker } from './TrainingDays';
import { t, dirIcon } from '../i18n';
import { WEEK_CHOICES, weeksLabel, addWeeks, localDay, deadlineLabel } from '../lib/goal';
import { createGoal, goalTitle, goalSummary, DEFAULT_WEEKS } from '../lib/createGoal';
import { SentenceGoal, type SentenceResult } from './SentenceGoal';
import { knowsGoalColumns } from '../lib/objectives';
import { TalkGoal } from './TalkGoal';
import { FEATURES } from '../lib/features';

// Créer un objectif. Même DA que « Modifier l'objectif » : fond noir, sections en verre, choix actif en blanc.
export const VISIBILITY = [
  { key: 'friends', label: t('objective.visFriends') },
  { key: 'close', label: t('objective.visClose') },
  { key: 'private', label: t('vis.private') },
  { key: 'public', label: t('vis.public') },
];
export const VIS_HINT: Record<string, string> = {
  friends: t('objective.hintFriends'),
  close: t('objective.hintClose'),
  private: t('objective.hintPrivate'),
  public: t('objective.hintPublic'),
};

// 1.4 : un objectif se crée en une phrase (SentenceGoal). Le reste (échéance, jours de rappel, qui le voit) a de bons
// réglages d'office et se range derrière « Plus d'options » : plus de formulaire à remplir pour commencer.
export function CreateObjectiveModal({ visible, onClose, onCreated }: { visible: boolean; onClose: () => void; onCreated: () => void }) {
  const [result, setResult] = useState<SentenceResult>({ goal: null, via: 'sentence', edited: false });
  const [visibility, setVisibility] = useState('friends');
  // Jours de rappel (par défaut tous) : une séance un autre jour compte pareil.
  const [days, setDays] = useState<number[]>(ALL_DAYS);
  // Échéance en semaines, `undefined` tant qu'on n'y a pas touché : 4 semaines pour un rythme, sans date pour un record.
  const [weeksPick, setWeeksPick] = useState<number | null | undefined>(undefined);
  const [more, setMore] = useState(false);
  // Nouvelle feuille (15/11/2026) en deux temps : la phrase, puis ce qu'elle ne dit pas (durée, jours de rappel, qui le
  // voit). Avant, ces réglages étaient mis d'office et cachés derrière « Plus d'options » : on les découvrait après coup.
  const [step, setStep] = useState<'say' | 'details'>('say');
  const talk = FEATURES.talkGoal;
  const details = talk && step === 'details';
  const showOpts = talk ? details : more;
  const [saving, setSaving] = useState(false);
  // Une feuille neuve à chaque ouverture (le champ de la phrase garde son propre état).
  const [formKey, setFormKey] = useState(0);

  const goal = result.goal;
  const rhythm = goal?.kind !== 'record';
  // Un objectif tout prêt vient avec sa durée (Hyrox : 8 semaines) ; sinon 4 semaines.
  const baseWeeks = goal?.weeks ?? DEFAULT_WEEKS;
  const weeks = weeksPick === undefined ? (rhythm ? baseWeeks : null) : (rhythm && weeksPick === null ? baseWeeks : weeksPick);
  const deadline = weeks ? addWeeks(localDay(), weeks) : null;
  const onResult = useCallback((r: SentenceResult) => setResult(r), []);
  // « Pilates le mardi et le jeudi » : les jours dits dans la phrase sont déjà cochés à l'étape suivante.
  const saidDays = goal?.days?.join(',') ?? '';
  useEffect(() => { setDays(saidDays ? saidDays.split(',').map(Number) : ALL_DAYS); }, [saidDays]);

  const reset = () => { setVisibility('friends'); setDays(ALL_DAYS); setWeeksPick(undefined); setMore(false); setStep('say'); setFormKey(k => k + 1); };

  const createLock = useRef(false);
  const handleCreate = async () => {
    if (createLock.current) return;
    if (!goal) { Alert.alert(t('objective.newTitle'), t('sentence.need')); return; }
    if (days.length === 0) { Alert.alert(t('welcome.daysTitle'), t('welcome.daysText')); return; }
    setSaving(true);
    createLock.current = true;
    const { title, error } = await createGoal(goal, { weeks, days, visibility, from: 'modal', via: result.via, edited: result.edited }).finally(() => { createLock.current = false; });
    setSaving(false);
    if (error) { Alert.alert(t('common.error'), /per_week|starts_at|deadline/i.test(error.message || '') ? t('goal.dbNeeded') : frError(error)); return; }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    Alert.alert(t('objective.createdTitle'), t('objective.createdText', { title }));
    reset(); onCreated();
  };

  const pick = (fn: () => void) => { Haptics.selectionAsync().catch(() => {}); fn(); };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      {/* Même correctif que les commentaires : dans une feuille (pageSheet),
          KeyboardAvoidingView calcule mal et le clavier cachait le bas de l'écran.
          Sur iOS, la ScrollView gère le clavier elle-même. */}
      <KeyboardAvoidingView style={{ flex: 1, backgroundColor: '#0a0a0a' }} behavior="height" enabled={Platform.OS === 'android'}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: GUTTER, paddingTop: 16, paddingBottom: 8 }}>
          <TouchableOpacity onPress={() => { if (details) { setStep('say'); return; } reset(); onClose(); }} accessibilityLabel={details ? t('common.back') : t('common.cancel')} hitSlop={8}>
            <GlassSurface radius={20} variant="clear" style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name={details ? dirIcon('chevron-back') : 'close'} size={20} color="#fff" />
            </GlassSurface>
          </TouchableOpacity>
          {FEATURES.talkGoal ? <Text style={label}>{t('objective.newLabel')}</Text> : (
          <TouchableOpacity onPress={saving ? undefined : handleCreate} activeOpacity={0.85} accessibilityRole="button" accessibilityState={{ disabled: !goal }}
            style={{ height: 40, borderRadius: 20, paddingHorizontal: 18, backgroundColor: goal ? '#fff' : 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center', minWidth: 84 }}>
            {saving ? <ActivityIndicator color="#000" /> : <Text style={{ color: '#000', fontSize: 14, fontFamily: F.extrabold }} maxFontSizeMultiplier={1.3}>{t('objective.create')}</Text>}
          </TouchableOpacity>
          )}
          {FEATURES.talkGoal && <View style={{ width: 40 }} />}
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          automaticallyAdjustKeyboardInsets
          contentContainerStyle={{ paddingHorizontal: GUTTER, paddingTop: 12, paddingBottom: 60 }}
        >
          {FEATURES.talkGoal ? (
            // La phrase reste montée pendant la seconde étape : revenir en arrière la retrouve telle quelle.
            <View style={{ marginTop: 8, display: details ? 'none' : 'flex' }}>
              <TalkGoal key={formKey} onChange={onResult} autoFocus={visible} />
            </View>
          ) : (
            <>
              <Text style={label}>{t('objective.newLabel')}</Text>
              <Text style={{ color: '#fff', fontSize: 30, lineHeight: 34, fontFamily: F.black, letterSpacing: -0.9, marginTop: 6, marginBottom: 20 }} maxFontSizeMultiplier={1.2}>{t('sentence.title')}</Text>

              <SentenceGoal key={formKey} onChange={onResult} autoFocus={visible} />
            </>
          )}

          {/* Sous l'objectif compris : ce qui est réglé d'office, en une ligne. */}
          {!talk && !!goal && (
            <Text style={hint}>
              {/* « 13 déc. » finit déjà par un point : pas de second point derrière. */}
              {(deadline ? t('goal.until', { date: deadlineLabel(deadline) }) : t('goal.noDeadline')).replace(/\.$/, '')}
              {'. '}{VIS_HINT[visibility]}
            </Text>
          )}

          {/* Nouvelle feuille : un seul bouton, sous ce qui a été compris. Il n'apparaît qu'une fois l'objectif compris. */}
          {talk && !!goal && !details && (
            <TouchableOpacity onPress={() => { Haptics.selectionAsync().catch(() => {}); Keyboard.dismiss(); setStep('details'); }} activeOpacity={0.85} accessibilityRole="button"
              style={{ height: 56, borderRadius: 18, marginTop: 36, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ color: '#000', fontSize: 16, fontFamily: F.extrabold }} maxFontSizeMultiplier={1.3}>{t('common.continue')}</Text>
            </TouchableOpacity>
          )}

          {/* Seconde étape : l'objectif compris en titre, puis les trois questions que la phrase ne tranche pas. */}
          {details && !!goal && (
            <View style={{ marginTop: 8, marginBottom: 10 }}>
              <Text style={{ color: '#fff', fontSize: 30, lineHeight: 35, fontFamily: F.black, letterSpacing: -0.9 }} numberOfLines={3} maxFontSizeMultiplier={1.2}>{goalTitle(goal)}</Text>
              <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 17, fontFamily: F.semibold, marginTop: 6 }}>{goalSummary(goal)}</Text>
            </View>
          )}

          {!talk && <TouchableOpacity onPress={() => pick(() => setMore(m => !m))} activeOpacity={0.8} accessibilityRole="button" accessibilityState={{ expanded: more }}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', minHeight: 44, marginTop: 10 }}>
            <Text style={{ color: 'rgba(255,255,255,0.75)', fontSize: 14, fontFamily: F.bold }}>{more ? t('sentence.optionsHide') : t('sentence.options')}</Text>
            <Ionicons name={more ? 'chevron-up' : 'chevron-down'} size={16} color="rgba(255,255,255,0.75)" />
          </TouchableOpacity>}

          {showOpts && knowsGoalColumns() && (
            <GlassCard radius={28} style={{ marginTop: talk ? 16 : 6 }}>
              <View style={{ padding: 18 }}>
                <Text style={label}>{talk ? t('sentence.howLong') : t('goal.deadline')}</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
                  {WEEK_CHOICES.map(w => {
                    const on = weeks === w;
                    return (
                      <TouchableOpacity key={w} onPress={() => pick(() => setWeeksPick(w))} activeOpacity={0.85} accessibilityState={{ selected: on }} style={chip(on)}>
                        <Text style={chipText(on)} maxFontSizeMultiplier={1.3}>{weeksLabel(w)}</Text>
                      </TouchableOpacity>
                    );
                  })}
                  {!rhythm && (
                    <TouchableOpacity onPress={() => pick(() => setWeeksPick(null))} activeOpacity={0.85} accessibilityState={{ selected: weeks === null }} style={chip(weeks === null)}>
                      <Text style={chipText(weeks === null)} maxFontSizeMultiplier={1.3}>{t('goal.noDeadline')}</Text>
                    </TouchableOpacity>
                  )}
                </View>
                <Text style={hint}>
                  {deadline ? `${t('goal.until', { date: deadlineLabel(deadline) })}\n` : ''}
                  {rhythm ? t('goal.deadlineHint') : t('goal.deadlineRecordHint')}
                </Text>
              </View>
            </GlassCard>
          )}

          {showOpts && (
            <GlassCard radius={28} style={{ marginTop: 14 }}>
              <View style={{ padding: 18 }}>
                <Text style={[label, { marginBottom: 12 }]}>{talk ? t('sentence.whichDays') : t('welcome.daysLabel')}</Text>
                <TrainingDaysPicker value={days} onChange={setDays} />
              </View>
            </GlassCard>
          )}

          {showOpts && (
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
          )}

          {details && (
            <TouchableOpacity onPress={saving ? undefined : handleCreate} activeOpacity={0.85} accessibilityRole="button"
              style={{ height: 56, borderRadius: 18, marginTop: 24, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' }}>
              {saving ? <ActivityIndicator color="#000" /> : <Text style={{ color: '#000', fontSize: 16, fontFamily: F.extrabold }} maxFontSizeMultiplier={1.3}>{t('sentence.createThis')}</Text>}
            </TouchableOpacity>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const label = { color: 'rgba(255,255,255,0.55)', fontSize: 11, fontFamily: F.bold, letterSpacing: 1.5 } as const;
const hint = { color: 'rgba(255,255,255,0.6)', fontSize: 13, lineHeight: 18, fontFamily: F.regular, marginTop: 12 } as const;
export const chip = (on: boolean) => ({ height: 38, borderRadius: 19, paddingHorizontal: 16, justifyContent: 'center' as const, backgroundColor: on ? '#fff' : 'rgba(255,255,255,0.12)', borderWidth: 1, borderColor: on ? '#fff' : 'rgba(255,255,255,0.14)' });
export const chipText = (on: boolean) => ({ color: on ? '#000' : '#fff', fontSize: 14, fontFamily: F.bold });

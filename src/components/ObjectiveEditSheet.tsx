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
import { t } from '../i18n';
import { isRhythm, WEEK_CHOICES, weeksLabel, addWeeks, localDay, deadlineLabel, rhythmTarget } from '../lib/goal';
import { knowsGoalColumns } from '../lib/objectives';

// Modifier un objectif déjà créé : qui le voit, les jours où tu t'entraînes, ou le supprimer.
// Même feuille depuis l'onglet des objectifs et depuis le profil.
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
  // Nouvelle échéance, en semaines à partir d'aujourd'hui (phase 31). undefined = on garde l'actuelle.
  const [weeks, setWeeks] = useState<number | null | undefined>(undefined);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!objective) return;
    setVisibility(objective.visibility || 'friends');
    setDays(hasSchedule(objective.training_days) ? objective.training_days! : ALL_DAYS);
    setWeeks(undefined);
    setSaving(false);
  }, [objective]);

  const save = async () => {
    if (!objective || saving) return;
    if (days.length === 0) { Alert.alert(t('welcome.daysTitle'), t('welcome.daysText')); return; }
    // On n'envoie que ce qui change : modifier la visibilité ne dépend pas de la colonne des jours.
    const newDays = days.length === 7 ? null : [...days].sort((a, b) => a - b);
    const patch: Partial<Objective> = {};
    if (visibility !== objective.visibility) patch.visibility = visibility;
    if (JSON.stringify(newDays) !== JSON.stringify(sortedOrNull(objective.training_days))) patch.training_days = newDays;
    if (weeks !== undefined) {
      const deadline = weeks ? addWeeks(localDay(), weeks) : null;
      if (deadline !== (objective.deadline ?? null)) {
        patch.deadline = deadline;
        // Rythme : la cible suit la période (4 par semaine sur 12 semaines = 48), les séances faites restent.
        if (isRhythm(objective) && deadline) patch.target_value = rhythmTarget(objective.per_week!, objective.starts_at || localDay(), deadline);
        // Une échéance repoussée rouvre un objectif clos par le bilan.
        if (isRhythm(objective) && deadline && objective.is_completed) { patch.is_completed = false; patch.completed_at = null; }
      }
    }
    if (Object.keys(patch).length === 0) { onClose(); return; }
    setSaving(true);
    const { error } = await supabase.from('objectives').update(patch).eq('id', objective.id);
    setSaving(false);
    if (error) {
      Alert.alert(t('common.error'), /training_days/i.test(error.message || '') ? t('objective.daysUnavailable') : frError(error));
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
          <TouchableOpacity onPress={onClose} accessibilityLabel={t('common.cancel')} hitSlop={8}>
            <GlassSurface radius={20} variant="clear" style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="close" size={20} color="#fff" />
            </GlassSurface>
          </TouchableOpacity>
          <TouchableOpacity onPress={saving ? undefined : save} activeOpacity={0.85} style={{ height: 40, borderRadius: 20, paddingHorizontal: 18, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', minWidth: 110 }}>
            {saving ? <ActivityIndicator color="#000" /> : <Text style={{ color: '#000', fontSize: 14, fontFamily: F.extrabold }}>{t('common.save')}</Text>}
          </TouchableOpacity>
        </View>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: GUTTER, paddingTop: 12, paddingBottom: 60 }}>
          <Text style={{ color: 'rgba(255,255,255,0.55)', fontSize: 11, fontFamily: F.bold, letterSpacing: 1.5 }}>{t('objective.editLabel')}</Text>
          {!!objective && (
            <Text style={{ color: '#fff', fontSize: 30, lineHeight: 34, fontFamily: F.black, letterSpacing: -0.9, marginTop: 6 }} numberOfLines={2}>{objective.title}</Text>
          )}

          <GlassCard radius={28} style={{ marginTop: 22 }}>
            <View style={{ padding: 18 }}>
              <Text style={label}>{t('objective.whoSees')}</Text>
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
              <Text style={[label, { marginBottom: 12 }]}>{t('welcome.daysLabel')}</Text>
              <TrainingDaysPicker value={days} onChange={setDays} />
            </View>
          </GlassCard>

          {!!objective && knowsGoalColumns() && (
            <GlassCard radius={28} style={{ marginTop: 14 }}>
              <View style={{ padding: 18 }}>
                <Text style={label}>{t('goal.deadline')}</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
                  {WEEK_CHOICES.map(w => {
                    const on = weeks === w;
                    return (
                      <TouchableOpacity key={w} onPress={() => { Haptics.selectionAsync().catch(() => {}); setWeeks(w); }} activeOpacity={0.85} accessibilityState={{ selected: on }}
                        style={{ height: 38, borderRadius: 19, paddingHorizontal: 16, justifyContent: 'center', backgroundColor: on ? '#fff' : 'rgba(255,255,255,0.12)', borderWidth: 1, borderColor: on ? '#fff' : 'rgba(255,255,255,0.14)' }}>
                        <Text style={{ color: on ? '#000' : '#fff', fontSize: 14, fontFamily: F.bold }}>{weeksLabel(w)}</Text>
                      </TouchableOpacity>
                    );
                  })}
                  {!isRhythm(objective) && (
                    <TouchableOpacity onPress={() => { Haptics.selectionAsync().catch(() => {}); setWeeks(null); }} activeOpacity={0.85} accessibilityState={{ selected: weeks === null }}
                      style={{ height: 38, borderRadius: 19, paddingHorizontal: 16, justifyContent: 'center', backgroundColor: weeks === null ? '#fff' : 'rgba(255,255,255,0.12)', borderWidth: 1, borderColor: weeks === null ? '#fff' : 'rgba(255,255,255,0.14)' }}>
                      <Text style={{ color: weeks === null ? '#000' : '#fff', fontSize: 14, fontFamily: F.bold }}>{t('goal.noDeadline')}</Text>
                    </TouchableOpacity>
                  )}
                </View>
                <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, lineHeight: 18, fontFamily: F.regular, marginTop: 12 }}>
                  {weeks === undefined
                    ? (objective.deadline ? t('goal.until', { date: deadlineLabel(objective.deadline) }) : t('goal.noDeadline'))
                    : weeks ? t('goal.until', { date: deadlineLabel(addWeeks(localDay(), weeks)) }) : t('goal.noDeadline')}
                  {isRhythm(objective) ? `. ${t('goal.perWeekHint')}` : ''}
                </Text>
              </View>
            </GlassCard>
          )}

          <TouchableOpacity onPress={remove} activeOpacity={0.85} style={{ marginTop: 26 }} accessibilityRole="button">
            <GlassSurface radius={20} tintColor="rgba(255,69,58,0.12)" style={{ height: 52, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, borderWidth: 1, borderColor: 'rgba(255,69,58,0.35)' }}>
              <Ionicons name="trash-outline" size={18} color="#ff453a" />
              <Text style={{ color: '#ff453a', fontSize: 15, fontFamily: F.bold }}>{t('main.deleteObjTitle')}</Text>
            </GlassSurface>
          </TouchableOpacity>
        </ScrollView>
      </View>
    </Modal>
  );
}

const label = { color: 'rgba(255,255,255,0.55)', fontSize: 11, fontFamily: F.bold, letterSpacing: 1.5 } as const;

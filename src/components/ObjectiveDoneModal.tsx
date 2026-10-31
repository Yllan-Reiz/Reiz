import { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, Modal, Animated, Easing, ActivityIndicator, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { supabase } from '../lib/supabase';
import { frError, num } from '../lib/helpers';
import { track } from '../lib/track';
import { GlassSurface } from './GlassSurface';
import { F } from '../styles';
import { t, unitLabel } from '../i18n';

// L'objectif atteint (1.2, 30/10/2026) : le post qui fait franchir la cible ouvre cet écran au lieu du simple
// « Publié ». Avant, rien ne se passait : 4 des 5 premiers gagnants ont pourtant créé un objectif juste après,
// et 3 ont continué à poster sur l'objectif atteint, barre bloquée à 100 %.
//   Monter la barre  même objectif, cible plus haute (l'historique reste ; la base le remet « en cours »)
//   Nouvel objectif  ferme et ouvre la création d'objectif
//   Mon parcours     toutes les étapes en image ou en vidéo, à partager ou enregistrer (JourneyModal)
// Le cercle est prévenu par send-push (« 🏆 Léa a atteint son objectif »), pas par l'app.
// `preview` (Réglages, builds de développement) : rien n'est enregistré ni mesuré.

export type DoneObjective = { id: string; emoji?: string | null; title: string; unit: string; target_value: number;
  /** Rythme arrivé à échéance (phase 31) : le bilan remplace « Monter la barre » par « Prolonger ». */
  summary?: { done: number; total: number } };

const EASE = Easing.bezier(0.23, 1, 0.32, 1);

// Prochaine cible proposée : un record se relève un peu (+5 % en kg), un compte de séances se double.
function nextTarget(o: DoneObjective) {
  if (o.unit === 'kg') return Math.ceil((o.target_value * 1.05) / 2.5) * 2.5;
  return o.target_value <= 10 ? o.target_value * 2 : Math.round(o.target_value * 1.5);
}
const stepOf = (o: DoneObjective) => (o.unit === 'kg' ? 2.5 : o.unit === 'min' ? 5 : Math.max(1, Math.round(o.target_value / 10)));

export function ObjectiveDoneModal({ objective, preview, onJourney, onNewObjective, onExtend, onClose }: {
  objective: DoneObjective | null;
  preview?: boolean;
  onJourney: () => void;
  onNewObjective: () => void;
  /** Bilan d'un rythme : repousse l'échéance de 4 semaines. */
  onExtend?: () => Promise<void> | void;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [raising, setRaising] = useState(false);
  const [target, setTarget] = useState(0);
  const [saving, setSaving] = useState(false);
  const pop = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!objective) return;
    setRaising(false); setSaving(false); setTarget(nextTarget(objective));
    pop.setValue(0);
    Animated.timing(pop, { toValue: 1, duration: 520, easing: EASE, useNativeDriver: true }).start();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    if (!preview) track('objective_done', { unit: objective.unit }, 'post');
  }, [objective, pop, preview]);

  if (!objective) return null;
  const summary = objective.summary;
  const pct = summary ? Math.round((summary.done / Math.max(1, summary.total)) * 100) : 0;
  // Un objectif en % n'a pas de cible chiffrée à relever : seulement « Nouvel objectif ».
  const canRaise = !summary && objective.unit !== '%' && objective.target_value > 0;
  const label = `${objective.emoji || ''} ${objective.title}`.trim();
  const step = stepOf(objective);

  const saveRaise = async () => {
    if (saving || target <= objective.target_value) return;
    if (preview) { onClose(); return; }
    setSaving(true);
    const { error } = await supabase.from('objectives').update({ target_value: target }).eq('id', objective.id);
    setSaving(false);
    if (error) { Alert.alert(t('common.error'), frError(error)); return; }
    track('objective_raise', { from: objective.target_value, to: target, unit: objective.unit }, 'post');
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    onClose();
  };

  return (
    <Modal visible animationType="fade" presentationStyle="fullScreen" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: '#0a0a0a', paddingTop: insets.top + 12, paddingBottom: insets.bottom + 14, paddingHorizontal: 24 }}>
        <View style={{ alignItems: 'flex-end' }}>
          <TouchableOpacity onPress={onClose} hitSlop={12} accessibilityLabel={t('common.close')}>
            <Ionicons name="close" size={26} color="rgba(255,255,255,0.6)" />
          </TouchableOpacity>
        </View>

        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Animated.Text style={{ fontSize: 96, opacity: pop, transform: [{ scale: pop.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) }] }}>{summary && pct < 60 ? '🏁' : '🏆'}</Animated.Text>
          <Animated.View style={{ alignItems: 'center', opacity: pop, transform: [{ translateY: pop.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }] }}>
            <Text style={{ color: 'rgba(255,255,255,0.55)', fontSize: 11, fontFamily: F.bold, letterSpacing: 1.5, marginTop: 18 }}>{summary ? t('goal.summaryTitle') : t('done.eyebrow')}</Text>
            <Text style={{ color: '#fff', fontSize: 34, lineHeight: 38, fontFamily: F.black, letterSpacing: -1.1, textAlign: 'center', marginTop: 8 }}>{label}</Text>
            <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 16, lineHeight: 24, fontFamily: F.regular, textAlign: 'center', marginTop: 10 }}>
              {summary ? t('goal.summary', { done: num(summary.done), total: num(summary.total), pct }) : canRaise ? t('done.reached', { n: num(objective.target_value), unit: unitLabel(objective.unit) }) : t('done.reachedPct')}
            </Text>
          </Animated.View>

          {raising && (
            <GlassSurface radius={20} style={{ alignSelf: 'stretch', marginTop: 28 }}>
              <View style={{ padding: 16 }}>
                <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, fontFamily: F.bold, letterSpacing: 1.5, textAlign: 'center' }}>{t('done.newTarget')}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 }}>
                  <Stepper icon="remove" label={t('common.less')} disabled={target - step <= objective.target_value} onPress={() => { Haptics.selectionAsync().catch(() => {}); setTarget(v => Math.max(objective.target_value + step, Math.round((v - step) * 10) / 10)); }} />
                  <Text style={{ color: '#fff', fontSize: 22, fontFamily: F.extrabold }}>{num(target)} {unitLabel(objective.unit)}</Text>
                  <Stepper icon="add" label={t('common.more')} onPress={() => { Haptics.selectionAsync().catch(() => {}); setTarget(v => Math.round((v + step) * 10) / 10); }} />
                </View>
              </View>
            </GlassSurface>
          )}
        </View>

        {raising ? (
          <>
            <Primary label={t('done.saveRaise')} icon="trending-up" onPress={saveRaise} busy={saving} />
            <Quiet label={t('common.cancel')} onPress={() => setRaising(false)} />
          </>
        ) : (
          <>
            {summary && onExtend
              ? <Primary label={t('goal.extend')} icon="calendar-outline" busy={saving} onPress={async () => { if (saving) return; setSaving(true); try { await onExtend(); } finally { setSaving(false); } }} />
              : canRaise
              ? <Primary label={t('done.raise')} icon="trending-up" onPress={() => { Haptics.selectionAsync().catch(() => {}); setRaising(true); }} />
              : <Primary label={t('done.newObjective')} icon="flag" onPress={() => { if (!preview) track('objective_next', {}, 'post'); onNewObjective(); }} />}
            {(canRaise || (summary && onExtend)) && <Secondary label={t('done.newObjective')} icon="flag-outline" onPress={() => { if (!preview) track('objective_next', {}, 'post'); onNewObjective(); }} />}
            <Secondary label={t('journey.myJourney')} icon="images-outline" onPress={onJourney} />
            <Quiet label={t('common.later')} onPress={onClose} />
          </>
        )}
      </View>
    </Modal>
  );
}

function Primary({ label, icon, onPress, busy }: { label: string; icon: any; onPress: () => void; busy?: boolean }) {
  return (
    <TouchableOpacity onPress={onPress} disabled={busy} activeOpacity={0.85} accessibilityRole="button" accessibilityLabel={label}
      style={{ backgroundColor: '#fff', borderRadius: 16, minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
      {busy ? <ActivityIndicator color="#000" /> : (
        <>
          <Ionicons name={icon} size={20} color="#000" />
          <Text style={{ color: '#000', fontSize: 17, fontFamily: F.extrabold }}>{label}</Text>
        </>
      )}
    </TouchableOpacity>
  );
}

function Secondary({ label, icon, onPress }: { label: string; icon: any; onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8} accessibilityRole="button" accessibilityLabel={label}
      style={{ borderRadius: 16, minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: 'rgba(255,255,255,0.1)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', marginTop: 10 }}>
      <Ionicons name={icon} size={19} color="#fff" />
      <Text style={{ color: '#fff', fontSize: 16, fontFamily: F.bold }}>{label}</Text>
    </TouchableOpacity>
  );
}

function Quiet({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8} accessibilityRole="button" accessibilityLabel={label} style={{ paddingVertical: 14, alignItems: 'center' }}>
      <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 15, fontFamily: F.semibold }}>{label}</Text>
    </TouchableOpacity>
  );
}

function Stepper({ icon, label, onPress, disabled }: { icon: any; label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <TouchableOpacity onPress={onPress} disabled={disabled} activeOpacity={0.7} accessibilityRole="button" accessibilityLabel={label}
      style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center', opacity: disabled ? 0.35 : 1 }}>
      <Ionicons name={icon} size={22} color="#fff" />
    </TouchableOpacity>
  );
}

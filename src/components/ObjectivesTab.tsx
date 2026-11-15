import { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Pressable, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { GlassCard as Glass } from './GlassSurface';
import { StatBubble, SectionHeader, WeekTracker, VIS_ICON, fmtNum, isCompleted } from './ProfileSections';
import { Objective } from '../lib/types';
import { ALL_DAYS, GUTTER, hasSchedule, daysLabel } from '../constants';
import { F } from '../styles';
import { t, unitLabel } from '../i18n';
import { isRhythm, rhythmLine, deadlineLabel, deadlinePassed } from '../lib/goal';
import { currentWeekKeys } from '../constants';
import { FEATURES } from '../lib/features';

// L'onglet des objectifs dans le design du profil : bulle de verre à 3 zones, titres en gras, cartes de verre
// avec la valeur en grand, la semaine en pastilles L M M J V S D, un bouton « Mise à jour » blanc.
// Le fond (ta photo floutée) est posé par Main derrière tout l'écran, c'est lui qui fait ressortir le verre.
// Retour à l'ancien design : GLASS_OBJECTIVES = false dans Main.tsx (l'ancien code y est resté intact).

const pctOf = (o: Objective) => (o.target_value > 0 ? Math.min(Math.round((o.current_value / o.target_value) * 100), 100) : 0);

function Chip({ icon, label }: { icon: any; label: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 13, height: 26, paddingHorizontal: 10 }}>
      <Ionicons name={icon} size={12} color="rgba(255,255,255,0.8)" />
      <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 12, fontFamily: F.semibold }} numberOfLines={1}>{label}</Text>
    </View>
  );
}

/** Le « … » : un rond de verre, comme les boutons du profil. */
function MoreButton({ onPress, label }: { onPress: () => void; label: string }) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8} accessibilityRole="button" accessibilityLabel={label} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
      {/* 15/11/2026 : « ... » ne disait rien (plusieurs amis ont demandé comment modifier un objectif). Le mot est écrit. */}
      <Glass radius={16} variant="clear" style={{ height: 46, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 }}>
        <Ionicons name="create-outline" size={17} color="#fff" />
        <Text style={{ color: '#fff', fontSize: 14, fontFamily: F.bold }} maxFontSizeMultiplier={1.3}>{t('main.editShort')}</Text>
      </Glass>
    </TouchableOpacity>
  );
}

// Ligne compacte (15/11/2026) : avec plusieurs objectifs, il fallait faire défiler cinq grandes cartes pour trouver le
// sien. Une ligne dit l'essentiel (nom, avancement, semaine en cours) et garde le bouton de mise à jour ; la toucher
// l'ouvre en grande carte, une seule à la fois.
function ObjectiveRow({ o, done, activity, onOpen, onUpdate }: {
  o: Objective; done: boolean; activity: Set<string>; onOpen: () => void; onUpdate: () => void;
}) {
  const pct = pctOf(o);
  const doneThisWeek = currentWeekKeys().filter(d => activity.has(d)).length;
  const line = done ? t('objective.reachedBadge')
    : isRhythm(o) ? rhythmLine(o, doneThisWeek)
    : o.unit === '%' ? `${pct}%` : `${fmtNum(o.current_value)} / ${fmtNum(o.target_value)} ${unitLabel(o.unit)}`;
  return (
    <Pressable onPress={onOpen} accessibilityRole="button" accessibilityLabel={`${o.title}. ${line}`} accessibilityState={{ expanded: false }} style={{ marginBottom: 10 }}>
      <Glass radius={24}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, paddingLeft: 18, paddingRight: 14 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: '#fff', fontSize: 18, lineHeight: 23, fontFamily: F.extrabold, letterSpacing: -0.3 }} numberOfLines={1}>{o.title}</Text>
            <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, fontFamily: F.semibold, marginTop: 3 }} numberOfLines={1}>{line}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10 }}>
              <View style={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.16)', overflow: 'hidden' }}>
                <View style={{ width: `${pct}%`, height: '100%', backgroundColor: '#fff', borderRadius: 3 }} />
              </View>
              <Text style={{ color: '#fff', fontSize: 13, fontFamily: F.bold, width: 40, textAlign: 'right' }}>{pct}%</Text>
            </View>
          </View>
          {done ? (
            <Ionicons name="chevron-down" size={18} color="rgba(255,255,255,0.5)" />
          ) : (
            <TouchableOpacity onPress={onUpdate} activeOpacity={0.85} accessibilityRole="button" accessibilityLabel={`${t('main.addUpdate')}, ${o.title}`} hitSlop={6}
              style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="add" size={24} color="#000" />
            </TouchableOpacity>
          )}
        </View>
      </Glass>
    </Pressable>
  );
}

function ObjectiveGlassCard({ o, done, activity, onUpdate, onEdit, onDelete, onCollapse }: {
  o: Objective; done: boolean; activity: Set<string>;
  onUpdate: () => void; onEdit: () => void; onDelete: () => void;
  /** Liste compacte : referme la carte en ligne. */
  onCollapse?: () => void;
}) {
  const pct = pctOf(o);
  const inPct = o.unit === '%';
  const vis = VIS_ICON[o.visibility] || VIS_ICON.friends;
  const scheduled = hasSchedule(o.training_days);
  // Phase 31 : semaine en cours d'un rythme, échéance en pastille.
  const doneThisWeek = currentWeekKeys().filter(d => activity.has(d)).length;
  const rhythmText = isRhythm(o) ? rhythmLine(o, doneThisWeek) : null;
  return (
    <Pressable onLongPress={onDelete} delayLongPress={450} style={{ marginBottom: 14 }}>
      <Glass radius={32}>
        <View style={{ padding: 20 }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text style={{ color: '#fff', fontSize: 38, fontFamily: F.black, letterSpacing: -1.2 }} numberOfLines={1}>
                {inPct ? `${pct}%` : fmtNum(o.current_value)}
                {!inPct && <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 17, fontFamily: F.semibold, letterSpacing: 0 }}>{` / ${fmtNum(o.target_value)} ${unitLabel(o.unit)}`}</Text>}
              </Text>
            </View>
            {!!onCollapse && (
              <TouchableOpacity onPress={onCollapse} hitSlop={12} accessibilityRole="button" accessibilityLabel={t('common.close')} accessibilityState={{ expanded: true }}
                style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="chevron-up" size={18} color="#fff" />
              </TouchableOpacity>
            )}
          </View>

          <Text style={{ color: '#fff', fontSize: 25, fontFamily: F.black, letterSpacing: -0.6, lineHeight: 29, marginTop: 8 }} numberOfLines={2}>{o.title}</Text>

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
            <Chip icon={vis.icon} label={vis.label} />
            {scheduled && <Chip icon={isRhythm(o) ? 'notifications-outline' : 'calendar-outline'} label={daysLabel(o.training_days)} />}
            {!!o.deadline && <Chip icon="flag-outline" label={deadlinePassed(o) && !done ? t('goal.ended') : deadlineLabel(o.deadline)} />}
          </View>
          {!!rhythmText && <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, fontFamily: F.semibold, marginTop: 12 }}>{rhythmText}</Text>}

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 16 }}>
            <View style={{ flex: 1, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.16)', overflow: 'hidden' }}>
              <View style={{ width: `${pct}%`, height: '100%', backgroundColor: '#fff', borderRadius: 4 }} />
            </View>
            <Text style={{ color: '#fff', fontSize: 14, fontFamily: F.bold, width: 44, textAlign: 'right' }}>{pct}%</Text>
          </View>

          {/* Rythme : les jours sont libres, les jours choisis ne servent qu'aux rappels (cloche ci-dessus). */}
          {!done && (isRhythm(o)
            ? <WeekTracker days={ALL_DAYS} done={activity} perWeek={o.per_week} />
            : <WeekTracker days={scheduled ? o.training_days! : ALL_DAYS} done={activity} everyDay={!scheduled} />)}

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 18 }}>
            {done ? (
              <View style={{ flex: 1, height: 46, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: '#fff', fontSize: 14, fontFamily: F.extrabold }}>{t('objective.reachedBadge')}</Text>
              </View>
            ) : (
              <TouchableOpacity onPress={onUpdate} activeOpacity={0.85} style={{ flex: 1, height: 46, borderRadius: 16, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: '#000', fontSize: 14, fontFamily: F.extrabold }}>{t('main.addUpdate')}</Text>
              </TouchableOpacity>
            )}
            <MoreButton onPress={onEdit} label={t('main.editObj', { title: o.title })} />
          </View>
        </View>
      </Glass>
    </Pressable>
  );
}

export function ObjectivesTab({ objectives, activity, streak, refreshing, onRefresh, onAdd, onUpdate, onEdit, onDelete, bottomPad }: {
  objectives: Objective[];
  /** Jours (toDateString) où chaque objectif a reçu une publication. */
  activity: Record<string, Set<string>>;
  streak: number;
  refreshing: boolean;
  onRefresh: () => void;
  onAdd: () => void;
  onUpdate: () => void;
  onEdit: (o: Objective) => void;
  onDelete: (o: Objective) => void;
  bottomPad: number;
}) {
  const ongoing = objectives.filter(o => !isCompleted(o));
  const achieved = objectives.filter(isCompleted);
  const avg = objectives.length ? Math.round(objectives.reduce((acc, o) => acc + pctOf(o), 0) / objectives.length) : 0;
  const none = new Set<string>();
  // Dès 3 objectifs : des lignes, une seule grande carte ouverte à la fois (aucune au départ).
  const compact = FEATURES.compactObjectives && objectives.length >= 3;
  const [openId, setOpenId] = useState<string | null>(null);
  const card = (o: Objective, done: boolean) => (compact && openId !== o.id
    ? <ObjectiveRow key={o.id} o={o} done={done} activity={activity[o.id] || none} onOpen={() => setOpenId(o.id)} onUpdate={onUpdate} />
    : <ObjectiveGlassCard key={o.id} o={o} done={done} activity={activity[o.id] || none} onUpdate={onUpdate} onEdit={() => onEdit(o)} onDelete={() => onDelete(o)} onCollapse={compact ? () => setOpenId(null) : undefined} />);

  return (
    <ScrollView
      style={{ flex: 1 }}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingBottom: bottomPad + 24 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#fff" colors={['#fff']} progressBackgroundColor="#1a1a1a" />}
    >
      <View style={{ paddingHorizontal: GUTTER, paddingTop: 8 }}>
        <Text style={{ color: 'rgba(255,255,255,0.55)', fontSize: 10, fontFamily: F.bold, letterSpacing: 1.5 }}>{t('objective.myObjectives')}</Text>
        <Text style={{ color: '#fff', fontSize: 36, fontFamily: F.black, letterSpacing: -1.2, marginTop: 4 }}>
          {t('objective.ongoingCount', { n: ongoing.length })}
        </Text>
      </View>

      <StatBubble tinted items={[
        { value: String(objectives.length), label: t('main.statActive') },
        { value: t('days.streakWeeks', { n: streak }), label: t('main.statStreak') },
        { value: `${avg}%`, label: t('main.statAvg') },
      ]} />

      <TouchableOpacity onPress={onAdd} activeOpacity={0.85} style={{ marginHorizontal: GUTTER, marginTop: 14, height: 50, borderRadius: 16, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: '#000', fontSize: 15, fontFamily: F.extrabold }}>{t('main.addObjective')}</Text>
      </TouchableOpacity>

      {ongoing.length > 0 && (
        <View style={{ paddingHorizontal: GUTTER, marginTop: 26 }}>
          <SectionHeader title={t('profile.ongoing')} count={ongoing.length} />
          {ongoing.map(o => card(o, false))}
        </View>
      )}

      {achieved.length > 0 && (
        <View style={{ paddingHorizontal: GUTTER, marginTop: 10 }}>
          <SectionHeader title={t('profileSec.achieved')} count={achieved.length} />
          {achieved.map(o => card(o, true))}
        </View>
      )}

      <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, textAlign: 'center', marginTop: 4, paddingHorizontal: 24 }}>
        {compact ? t('main.objHintCompact') : t('main.objHint')}
      </Text>
    </ScrollView>
  );
}

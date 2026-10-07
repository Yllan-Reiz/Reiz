import { View, Text, TouchableOpacity, ScrollView, Pressable, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { GlassCard as Glass } from './GlassSurface';
import { StatBubble, SectionHeader, WeekTracker, VIS_ICON, fmtNum, isCompleted } from './ProfileSections';
import { Objective } from '../lib/types';
import { ALL_DAYS, GUTTER, hasSchedule, daysLabel } from '../constants';
import { F } from '../styles';

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
    <TouchableOpacity onPress={onPress} accessibilityLabel={label} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
      <Glass radius={23} variant="clear" style={{ width: 46, height: 46, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name="ellipsis-horizontal" size={20} color="#fff" />
      </Glass>
    </TouchableOpacity>
  );
}

function ObjectiveGlassCard({ o, done, activity, onUpdate, onEdit, onDelete }: {
  o: Objective; done: boolean; activity: Set<string>;
  onUpdate: () => void; onEdit: () => void; onDelete: () => void;
}) {
  const pct = pctOf(o);
  const inPct = o.unit === '%';
  const vis = VIS_ICON[o.visibility] || VIS_ICON.friends;
  const scheduled = hasSchedule(o.training_days);
  return (
    <Pressable onLongPress={onDelete} delayLongPress={450} style={{ marginBottom: 14 }}>
      <Glass radius={32}>
        <View style={{ padding: 20 }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text style={{ color: '#fff', fontSize: 38, fontFamily: F.black, letterSpacing: -1.2 }} numberOfLines={1}>
                {inPct ? `${pct}%` : fmtNum(o.current_value)}
                {!inPct && <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 17, fontFamily: F.semibold, letterSpacing: 0 }}>{` / ${fmtNum(o.target_value)} ${o.unit}`}</Text>}
              </Text>
            </View>
            <Glass radius={28} variant="clear" style={{ width: 56, height: 56, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: 26 }}>{o.emoji}</Text>
            </Glass>
          </View>

          <Text style={{ color: '#fff', fontSize: 25, fontFamily: F.black, letterSpacing: -0.6, lineHeight: 29, marginTop: 8 }} numberOfLines={2}>{o.title}</Text>

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
            <Chip icon={vis.icon} label={vis.label} />
            {scheduled && <Chip icon="calendar-outline" label={daysLabel(o.training_days)} />}
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 16 }}>
            <View style={{ flex: 1, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.16)', overflow: 'hidden' }}>
              <View style={{ width: `${pct}%`, height: '100%', backgroundColor: '#fff', borderRadius: 4 }} />
            </View>
            <Text style={{ color: '#fff', fontSize: 14, fontFamily: F.bold, width: 44, textAlign: 'right' }}>{pct}%</Text>
          </View>

          {!done && <WeekTracker days={scheduled ? o.training_days! : ALL_DAYS} done={activity} everyDay={!scheduled} />}

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 18 }}>
            {done ? (
              <View style={{ flex: 1, height: 46, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: '#fff', fontSize: 14, fontFamily: F.extrabold }}>🏆 Objectif atteint</Text>
              </View>
            ) : (
              <TouchableOpacity onPress={onUpdate} activeOpacity={0.85} style={{ flex: 1, height: 46, borderRadius: 16, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: '#000', fontSize: 14, fontFamily: F.extrabold }}>+ Mise à jour</Text>
              </TouchableOpacity>
            )}
            <MoreButton onPress={onEdit} label={`Modifier ${o.title}`} />
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

  return (
    <ScrollView
      style={{ flex: 1 }}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingBottom: bottomPad + 24 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#fff" colors={['#fff']} progressBackgroundColor="#1a1a1a" />}
    >
      <View style={{ paddingHorizontal: GUTTER, paddingTop: 8 }}>
        <Text style={{ color: 'rgba(255,255,255,0.55)', fontSize: 10, fontFamily: F.bold, letterSpacing: 1.5 }}>MES OBJECTIFS</Text>
        <Text style={{ color: '#fff', fontSize: 36, fontFamily: F.black, letterSpacing: -1.2, marginTop: 4 }}>
          {ongoing.length} en cours
        </Text>
      </View>

      <StatBubble tinted items={[
        { value: String(objectives.length), label: 'Actifs' },
        { value: `${streak}j`, label: 'Streak' },
        { value: `${avg}%`, label: 'Moy.' },
      ]} />

      <TouchableOpacity onPress={onAdd} activeOpacity={0.85} style={{ marginHorizontal: GUTTER, marginTop: 14, height: 54, borderRadius: 20, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: '#000', fontSize: 15, fontFamily: F.extrabold }}>+ Ajouter un objectif</Text>
      </TouchableOpacity>

      {ongoing.length > 0 && (
        <View style={{ paddingHorizontal: GUTTER, marginTop: 26 }}>
          <SectionHeader title="En cours" count={ongoing.length} />
          {ongoing.map(o => (
            <ObjectiveGlassCard key={o.id} o={o} done={false} activity={activity[o.id] || none} onUpdate={onUpdate} onEdit={() => onEdit(o)} onDelete={() => onDelete(o)} />
          ))}
        </View>
      )}

      {achieved.length > 0 && (
        <View style={{ paddingHorizontal: GUTTER, marginTop: 10 }}>
          <SectionHeader title="Réussis" count={achieved.length} />
          {achieved.map(o => (
            <ObjectiveGlassCard key={o.id} o={o} done activity={activity[o.id] || none} onUpdate={onUpdate} onEdit={() => onEdit(o)} onDelete={() => onDelete(o)} />
          ))}
        </View>
      )}

      <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, textAlign: 'center', marginTop: 4, paddingHorizontal: 24 }}>
        Touche « … » pour modifier un objectif. Appui long pour le supprimer.
      </Text>
    </ScrollView>
  );
}

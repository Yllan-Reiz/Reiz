import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { GlassSurface } from './GlassSurface';
import { shareInvite, type InviteChannel } from '../lib/invites';
import type { WeekState } from '../lib/weekly';
import type { Objective } from '../lib/types';
import { F } from '../styles';
import { t, tp } from '../i18n';

// Le fil de quelqu'un qui n'a encore aucun ami (1.4). Il n'est jamais vide : en haut, sa propre semaine
// (« 1 sur 3 », ce qu'il reste à faire, sa série), et juste dessous l'appel à inviter une personne, avec le
// partage en un geste. La carte disparaît au premier ami : le cercle prend la place.

export function SoloCard({ userId, week, objective, hasObjective, onPost, onCreate }: {
  userId: string | null;
  week: WeekState | null;
  /** L'objectif en cours mis en avant (le premier rythme, sinon le premier objectif ouvert). */
  objective: Objective | null;
  /** null tant que les objectifs ne sont pas chargés : la carte attend pour ne pas clignoter. */
  hasObjective: boolean | null;
  onPost: () => void;
  onCreate: () => void;
}) {
  if (!userId || hasObjective === null) return null;

  const share = (channel: InviteChannel) => {
    Haptics.selectionAsync().catch(() => {});
    shareInvite(userId, channel, 'feed_empty').catch(() => {});
  };
  const quota = week?.quota ?? objective?.per_week ?? 1;
  const done = Math.min(week?.done ?? 0, 7);
  // Une pastille par séance attendue (et une de plus par séance en bonus).
  const dots = Math.max(quota, done);

  return (
    <GlassSurface radius={28} style={{ marginBottom: 14 }}>
      <View style={{ padding: 18, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 28, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' }}>
        <Text style={label}>{t('soloCard.label')}</Text>

        {!hasObjective ? (
          <>
            <Text style={big}>{t('soloCard.noGoalTitle')}</Text>
            <Text style={body}>{t('soloCard.noGoalText')}</Text>
            <TouchableOpacity onPress={onCreate} activeOpacity={0.85} accessibilityRole="button" style={[btn, { backgroundColor: '#fff', marginTop: 14 }]}>
              <Text style={{ color: '#000', fontSize: 15, fontFamily: F.extrabold }}>{t('soloCard.noGoalCta')}</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 8 }}>
              <Text style={{ color: '#fff', fontSize: 34, lineHeight: 38, fontFamily: F.black, letterSpacing: -1 }} accessibilityLabel={t('goal.thisWeek', { done, per: quota })}>
                {done}<Text style={{ color: 'rgba(255,255,255,0.55)', fontSize: 19, fontFamily: F.semibold, letterSpacing: 0 }}>{` / ${quota}`}</Text>
              </Text>
              {!!week && week.weeks > 0 && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 6 }}>
                  <Ionicons name="flame" size={14} color="#fff" />
                  <Text style={{ color: '#fff', fontSize: 13, fontFamily: F.bold }}>{t('days.streakWeeks', { n: week.weeks })}</Text>
                </View>
              )}
            </View>
            {!!objective && <Text style={{ color: '#fff', fontSize: 16, fontFamily: F.bold, marginTop: 2 }} numberOfLines={1}>{objective.title}</Text>}
            <View style={{ flexDirection: 'row', gap: 6, marginTop: 12 }}>
              {Array.from({ length: dots }).map((_, i) => (
                <View key={i} style={{ flex: 1, maxWidth: 56, height: 8, borderRadius: 4, backgroundColor: i < done ? '#fff' : 'rgba(255,255,255,0.18)' }} />
              ))}
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 12 }}>
              <Text style={{ flex: 1, color: 'rgba(255,255,255,0.7)', fontSize: 14, lineHeight: 19, fontFamily: F.semibold }}>
                {week && week.left === 0 ? t('profileSec.weekDone') : tp('profileSec.weekLeft', week?.left ?? quota)}
              </Text>
              <TouchableOpacity onPress={onPost} activeOpacity={0.85} accessibilityRole="button"
                style={{ minHeight: 40, borderRadius: 20, paddingHorizontal: 16, justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.14)' }}>
                <Text style={{ color: '#fff', fontSize: 14, fontFamily: F.extrabold }}>{t('soloCard.post')}</Text>
              </TouchableOpacity>
            </View>
          </>
        )}

        <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.1)', marginVertical: 18 }} />

        <Text style={{ color: '#fff', fontSize: 18, fontFamily: F.extrabold, letterSpacing: -0.3 }}>{t('soloCard.inviteTitle')}</Text>
        <Text style={body}>{t('soloCard.inviteText')}</Text>
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
          <TouchableOpacity onPress={() => share('share')} activeOpacity={0.85} accessibilityRole="button" style={[btn, { flex: 1, backgroundColor: '#fff', flexDirection: 'row', gap: 8 }]}>
            <Ionicons name="share-outline" size={18} color="#000" />
            <Text style={{ color: '#000', fontSize: 15, fontFamily: F.extrabold }} numberOfLines={1}>{t('soloCard.inviteCta')}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => share('whatsapp')} activeOpacity={0.85} accessibilityRole="button" accessibilityLabel={t('quick.whatsapp')} style={[round, { backgroundColor: '#25D366' }]}>
            <Ionicons name="logo-whatsapp" size={22} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => share('sms')} activeOpacity={0.85} accessibilityRole="button" accessibilityLabel={t('quick.sms')} style={[round, { backgroundColor: '#34C759' }]}>
            <Ionicons name="chatbubble" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>
    </GlassSurface>
  );
}

const label = { color: 'rgba(255,255,255,0.55)', fontSize: 10, fontFamily: F.bold, letterSpacing: 1.5 } as const;
const big = { color: '#fff', fontSize: 20, fontFamily: F.black, letterSpacing: -0.5, marginTop: 8 } as const;
const body = { color: 'rgba(255,255,255,0.7)', fontSize: 14, lineHeight: 20, fontFamily: F.regular, marginTop: 4 } as const;
const btn = { minHeight: 46, borderRadius: 16, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14 } as const;
const round = { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' } as const;

import { useEffect, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { supabase } from '../lib/supabase';
import { GlassSurface } from './GlassSurface';
import { FLAME_RED } from './FlameBadge';
import { mondayOf, quotaFor, WEEKLY_COLUMNS, type WeeklyGoal } from '../lib/weekly';
import type { Update } from '../lib/types';
import { DAY_LETTERS, GUTTER } from '../constants';
import { F } from '../styles';
import { t, tp, formatDate, dirIcon } from '../i18n';

// Le calendrier du profil (17/11/2026) : un mois en grille, une pastille blanche sur chaque jour avec une séance,
// une flamme au bout des semaines validées (la même règle que la série et la flamme du profil : lib/weekly.ts).
// Toucher un jour ouvre la séance de ce jour-là. Les flèches remontent mois par mois, jusqu'à la plus ancienne
// séance chargée. Sert à ton profil et à celui d'un ami (on n'y voit que ce que tu as le droit de voir).

const addDays = (d: Date, n: number) => { const r = new Date(d); r.setDate(r.getDate() + n); return r; };
const CELL = 34;

export function MonthCalendar({ userId, posts, onOpen }: { userId: string | null; posts: Update[]; onOpen: (p: Update) => void }) {
  // 0 = le mois en cours, 1 = le mois d'avant...
  const [back, setBack] = useState(0);
  const [goals, setGoals] = useState<WeeklyGoal[] | null>(null);

  useEffect(() => {
    if (!userId) return;
    let alive = true;
    supabase.from('objectives').select(WEEKLY_COLUMNS).eq('user_id', userId).then(({ data, error }) => {
      if (alive && !error) setGoals((data || []) as unknown as WeeklyGoal[]);
    }, () => {});
    return () => { alive = false; };
  }, [userId]);

  // La séance la plus récente de chaque jour (les posts arrivent du plus récent au plus ancien).
  const byDay = useMemo(() => {
    const m = new Map<string, Update>();
    for (const p of posts) { const k = new Date(p.created_at).toDateString(); if (!m.has(k)) m.set(k, p); }
    return m;
  }, [posts]);

  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth() - back, 1);
  const last = new Date(first.getFullYear(), first.getMonth() + 1, 0);
  const oldest = posts.length ? new Date(posts[posts.length - 1].created_at) : now;
  const canGoBack = first > new Date(oldest.getFullYear(), oldest.getMonth(), 1);
  const today = now.toDateString();

  const weeks: Date[] = [];
  for (let w = mondayOf(first); w <= last; w = addDays(w, 7)) weeks.push(w);

  let sessions = 0;
  for (let d = new Date(first); d <= last; d = addDays(d, 1)) if (byDay.has(d.toDateString())) sessions++;

  const move = (n: number) => { Haptics.selectionAsync().catch(() => {}); setBack(b => Math.max(0, b + n)); };
  const monthLabel = formatDate(first, { month: 'long', year: 'numeric' });

  return (
    <View style={{ paddingHorizontal: GUTTER, marginBottom: 14 }}>
      <GlassSurface radius={26}>
        <View style={{ padding: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: '#fff', fontSize: 19, fontFamily: F.black, letterSpacing: -0.4, textTransform: 'capitalize' }} maxFontSizeMultiplier={1.2}>{monthLabel}</Text>
              <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, fontFamily: F.semibold, marginTop: 2 }} maxFontSizeMultiplier={1.2}>
                {sessions > 0 ? tp('calendar.sessions', sessions) : t('calendar.none')}
              </Text>
            </View>
            <Arrow icon="chevron-back" label={t('calendar.prev')} off={!canGoBack} onPress={() => move(1)} />
            <Arrow icon="chevron-forward" label={t('calendar.next')} off={back === 0} onPress={() => move(-1)} />
          </View>

          <View style={{ flexDirection: 'row', marginTop: 14 }}>
            {DAY_LETTERS.map((l, i) => (
              <Text key={i} style={{ flex: 1, textAlign: 'center', color: 'rgba(255,255,255,0.45)', fontSize: 11, fontFamily: F.bold }}>{l}</Text>
            ))}
            <View style={{ width: 24 }} />
          </View>

          {weeks.map(w => {
            // Semaine validée : le nombre de jours avec une séance atteint le quota de la semaine.
            let done = 0;
            for (let i = 0; i < 7; i++) if (byDay.has(addDays(w, i).toDateString())) done++;
            const valid = !!goals && w <= now && done >= quotaFor(goals, w);
            return (
              <View key={w.toDateString()} style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6 }}>
                {Array.from({ length: 7 }).map((_, i) => {
                  const d = addDays(w, i);
                  if (d < first || d > last) return <View key={i} style={{ flex: 1, height: CELL }} />;
                  const key = d.toDateString();
                  const post = byDay.get(key);
                  const isToday = key === today;
                  const future = d > now;
                  const circle = (
                    <View style={{ width: CELL, height: CELL, borderRadius: CELL / 2, alignItems: 'center', justifyContent: 'center', backgroundColor: post ? '#fff' : 'transparent', borderWidth: isToday && !post ? 1.5 : 0, borderColor: '#fff' }}>
                      <Text style={{ color: post ? '#000' : future ? 'rgba(255,255,255,0.25)' : isToday ? '#fff' : 'rgba(255,255,255,0.6)', fontSize: 14, fontFamily: post ? F.extrabold : F.semibold }} maxFontSizeMultiplier={1.1}>{d.getDate()}</Text>
                    </View>
                  );
                  return (
                    <View key={i} style={{ flex: 1, alignItems: 'center' }}>
                      {post
                        ? (
                          <TouchableOpacity onPress={() => { Haptics.selectionAsync().catch(() => {}); onOpen(post); }} activeOpacity={0.75} hitSlop={4}
                            accessibilityRole="button" accessibilityLabel={t('calendar.dayA11y', { date: formatDate(d, { day: 'numeric', month: 'long' }) })}>
                            {circle}
                          </TouchableOpacity>
                        )
                        : circle}
                    </View>
                  );
                })}
                <View style={{ width: 24, alignItems: 'center' }} accessibilityLabel={valid ? t('profileSec.weekDone') : undefined}>
                  {valid && <Ionicons name="flame" size={16} color={FLAME_RED} />}
                </View>
              </View>
            );
          })}
        </View>
      </GlassSurface>
    </View>
  );
}

function Arrow({ icon, label, off, onPress }: { icon: 'chevron-back' | 'chevron-forward'; label: string; off: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} disabled={off} activeOpacity={0.8} hitSlop={6} accessibilityRole="button" accessibilityLabel={label}
      style={{ width: 36, height: 36, borderRadius: 18, marginLeft: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.12)', opacity: off ? 0.3 : 1 }}>
      <Ionicons name={dirIcon(icon)} size={18} color="#fff" />
    </TouchableOpacity>
  );
}

import { useCallback, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { signAvatars } from '../lib/storage';
import { loadJourney } from '../lib/journey';
import { num } from '../lib/helpers';
import { track } from '../lib/track';
import { GlassSurface } from './GlassSurface';
import { JourneyModal } from './JourneyModal';
import { F } from '../styles';
import { t, dirIcon } from '../i18n';

// Un rythme fini, dans le fil (15/11/2026). Un record atteint se voit déjà : c'est le post gagnant, avec sa pastille
// « Objectif atteint ». Un rythme, lui, se termine à son échéance, sans post : rien n'apparaissait chez les amis.
// Ici, une carte par rythme terminé depuis moins de 3 jours dans ton cercle (et les tiens) : qui, quel objectif,
// combien de séances, les dernières images, et le parcours complet d'un geste (JourneyModal).
//   seulement les rythmes tenus à 60 % ou plus : on ne met pas en avant la période ratée d'un ami
//   la visibilité reste celle de la base (un objectif privé ou réservé aux proches n'arrive pas ici)

const WINDOW_HOURS = 72;
const MIN_PCT = 60;
const MAX_WINS = 3;
const THUMBS = 4;

type Win = { id: string; userId: string; title: string; done: number; total: number; name: string; avatar: string | null; thumbs: string[] };

export function CircleWinsCard({ userId, reloadKey, onOpenProfile }: { userId: string; reloadKey?: number; onOpenProfile?: (id: string) => void }) {
  const [wins, setWins] = useState<Win[]>([]);
  const [open, setOpen] = useState<Win | null>(null);

  const load = useCallback(async () => {
    if (!userId) return;
    const { data: fr } = await supabase.from('friendships').select('requester_id, receiver_id')
      .or(`requester_id.eq.${userId},receiver_id.eq.${userId}`).eq('status', 'accepted');
    const ids = [userId, ...((fr || []) as { requester_id: string; receiver_id: string }[]).map(f => (f.requester_id === userId ? f.receiver_id : f.requester_id))];
    const since = new Date(Date.now() - WINDOW_HOURS * 3600 * 1000).toISOString();
    const { data, error } = await supabase.from('objectives')
      .select('id, user_id, title, current_value, target_value, visibility, completed_at')
      .in('user_id', ids).eq('is_completed', true).not('per_week', 'is', null).gte('completed_at', since)
      .order('completed_at', { ascending: false }).limit(12);
    if (error || !data) return;
    const rows = (data as any[])
      .filter(o => (o.user_id === userId || o.visibility !== 'private') && Number(o.target_value) > 0
        && (Number(o.current_value) / Number(o.target_value)) * 100 >= MIN_PCT)
      .slice(0, MAX_WINS);
    if (rows.length === 0) { setWins([]); return; }

    const { data: people } = await supabase.from('users').select('id, full_name, avatar_url').in('id', [...new Set(rows.map(o => o.user_id))]);
    const who = new Map(((people || []) as any[]).map(p => [p.id, p]));
    const signed = await signAvatars([...who.values()].map(p => p.avatar_url)).catch(() => ({} as Record<string, string>));
    const base: Win[] = rows.map(o => {
      const p = who.get(o.user_id);
      return {
        id: o.id, userId: o.user_id, title: (o.title || '').trim(), done: Number(o.current_value) || 0, total: Number(o.target_value),
        name: (p?.full_name || '').split(' ')[0] || t('activity.someone'), avatar: p?.avatar_url ? signed[p.avatar_url] ?? null : null, thumbs: [],
      };
    });
    setWins(base);
    // Les images arrivent ensuite, sans retarder la carte (vignettes des vidéos comprises).
    base.forEach(w => {
      loadJourney(w.id).then(j => {
        const thumbs = (j?.steps || []).map(s => s.thumb).filter(Boolean).slice(-THUMBS) as string[];
        if (thumbs.length) setWins(prev => prev.map(x => (x.id === w.id ? { ...x, thumbs } : x)));
      }, () => {});
    });
  }, [userId]);

  useEffect(() => { load(); }, [load, reloadKey]);

  if (wins.length === 0) return null;
  return (
    <>
      {wins.map(w => {
        const mine = w.userId === userId;
        const pct = Math.round((w.done / Math.max(1, w.total)) * 100);
        return (
          <GlassSurface key={w.id} radius={28} style={{ marginBottom: 14 }}>
            <TouchableOpacity activeOpacity={0.85} accessibilityRole="button" accessibilityLabel={`${mine ? t('wins.mine') : t('wins.title', { name: w.name })}. ${t('journey.seeJourney')}`}
              onPress={() => { track('win_card_open', { own: mine }, 'feed'); setOpen(w); }}
              style={{ padding: 18, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 28, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="trophy" size={13} color="rgba(255,255,255,0.7)" />
                <Text style={{ color: 'rgba(255,255,255,0.55)', fontSize: 10, fontFamily: F.bold, letterSpacing: 1.5 }}>{t('wins.label')}</Text>
              </View>

              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 12 }}>
                <TouchableOpacity disabled={mine || !onOpenProfile} onPress={() => onOpenProfile?.(w.userId)} hitSlop={6} accessibilityLabel={w.name}>
                  {w.avatar
                    ? <Image source={{ uri: w.avatar }} style={{ width: 44, height: 44, borderRadius: 22 }} />
                    : <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' }}>
                        <Text style={{ color: '#fff', fontSize: 17, fontFamily: F.bold }}>{w.name.charAt(0).toUpperCase()}</Text>
                      </View>}
                </TouchableOpacity>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: '#fff', fontSize: 20, lineHeight: 24, fontFamily: F.black, letterSpacing: -0.5 }} numberOfLines={2} maxFontSizeMultiplier={1.3}>
                    {mine ? t('wins.mine') : t('wins.title', { name: w.name })}
                  </Text>
                  <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 14, lineHeight: 19, fontFamily: F.semibold, marginTop: 2 }} numberOfLines={2}>
                    {w.title}
                  </Text>
                </View>
              </View>

              {w.thumbs.length > 0 && (
                <View style={{ flexDirection: 'row', gap: 6, marginTop: 14 }}>
                  {/* Une seule image : en grand, sur toute la largeur. Deux : carrées. Trois ou quatre : en portrait. */}
                  {w.thumbs.map((uri, i) => (
                    <Image key={`${uri}.${i}`} source={{ uri }} style={{ flex: 1, aspectRatio: w.thumbs.length === 1 ? 16 / 10 : w.thumbs.length === 2 ? 1 : 3 / 4, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.08)' }} />
                  ))}
                </View>
              )}

              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 14 }}>
                <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, fontFamily: F.regular, flex: 1 }} numberOfLines={1}>
                  {t('goal.summary', { done: num(w.done), total: num(w.total), pct })}
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Text style={{ color: '#fff', fontSize: 13.5, fontFamily: F.bold }}>{t('journey.seeJourney')}</Text>
                  <Ionicons name={dirIcon('chevron-forward')} size={14} color="#fff" />
                </View>
              </View>
            </TouchableOpacity>
          </GlassSurface>
        );
      })}
      <JourneyModal objectiveId={open?.id ?? null} own={open?.userId === userId} ownerName={open && open.userId !== userId ? open.name : undefined} from="feed_win" onClose={() => setOpen(null)} />
    </>
  );
}

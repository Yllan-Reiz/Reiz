import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, Image, Alert } from 'react-native';
import { supabase } from '../lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { GlassCard } from './GlassSurface';
import { loadCircleRhythm, CircleRhythm, FriendRhythm } from '../lib/rhythm';
import { DAY_LETTERS } from '../constants';
import { F } from '../styles';

// « Ton cercle cette semaine » : la régularité de tes amis d'un coup d'œil. Combien ont posté, qui est à relancer,
// et en touchant la carte, le détail jour par jour (L M M J V S D) de chacun.

const label = { color: 'rgba(255,255,255,0.55)', fontSize: 10, fontFamily: F.bold, letterSpacing: 1.5 } as const;

function Face({ f, size }: { f: FriendRhythm; size: number }) {
  return f.avatar_url
    ? <Image source={{ uri: f.avatar_url }} style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: '#222' }} />
    : <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: '#fff', fontSize: size * 0.4, fontFamily: F.bold }}>{f.full_name.charAt(0).toUpperCase()}</Text></View>;
}

// « Relancer » : une notification « X te relance 💪 » à l'ami (fonction nudge_friend, une fois par jour au plus).
async function sendNudge(f: FriendRhythm): Promise<boolean> {
  const { data, error } = await supabase.rpc('nudge_friend', { p_friend: f.id });
  const first = f.full_name.split(' ')[0];
  if (error) { Alert.alert('Relance', "Impossible d'envoyer la relance pour le moment."); return false; }
  if (data === 'already') { Alert.alert('Déjà relancé', `Tu as déjà relancé ${first} aujourd'hui.`); return true; }
  if (data !== 'sent') { Alert.alert('Relance', `${first} ne peut pas être relancé.`); return false; }
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  return true;
}

const lastLabel = (f: FriendRhythm) => (f.daysAgo === null ? 'inactif' : f.daysAgo === 0 ? "aujourd'hui" : f.daysAgo === 1 ? 'hier' : `il y a ${f.daysAgo} j`);

function Week({ f }: { f: FriendRhythm }) {
  const todayIdx = (new Date().getDay() + 6) % 7;
  return (
    <View style={{ flexDirection: 'row', gap: 5 }}>
      {DAY_LETTERS.map((l, i) => {
        const hit = f.posted[i];
        const missed = !hit && f.scheduled[i] && i < todayIdx;
        const today = i === todayIdx && !hit;
        return (
          <View key={i} style={{ width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: hit ? '#fff' : 'transparent', borderWidth: missed || today ? 1.5 : 0, borderColor: today ? '#fff' : 'rgba(255,255,255,0.35)' }}>
            <Text style={{ color: hit ? '#000' : f.scheduled[i] ? '#fff' : 'rgba(255,255,255,0.25)', fontSize: 9, fontFamily: F.extrabold }}>{l}</Text>
          </View>
        );
      })}
    </View>
  );
}

export function CircleRhythmCard({ onOpenProfile, reloadKey }: { onOpenProfile: (id: string) => void; reloadKey?: unknown }) {
  const [data, setData] = useState<CircleRhythm | null>(null);
  const [open, setOpen] = useState(false);
  const [nudged, setNudged] = useState<Set<string>>(new Set());
  const doNudge = async (f: FriendRhythm) => { if (await sendNudge(f)) setNudged(prev => new Set(prev).add(f.id)); };
  useEffect(() => { loadCircleRhythm(reloadKey !== undefined && reloadKey !== 0).then(setData).catch(() => setData(null)); }, [reloadKey]);

  if (!data || data.total === 0) return null;
  const pct = Math.round((data.active / data.total) * 100);
  const nudge = data.toNudge.slice(0, 3);

  return (
    <GlassCard radius={28} style={{ marginBottom: 12 }}>
      <TouchableOpacity activeOpacity={0.85} onPress={() => { Haptics.selectionAsync().catch(() => {}); setOpen(o => !o); }} style={{ padding: 16 }} accessibilityLabel="Régularité de ton cercle, afficher le détail">
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Ionicons name="pulse" size={13} color="rgba(255,255,255,0.55)" />
            <Text style={label}>TON CERCLE CETTE SEMAINE</Text>
          </View>
          <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color="rgba(255,255,255,0.5)" />
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8, marginTop: 8 }}>
          <Text style={{ color: '#fff', fontSize: 28, fontFamily: F.black, letterSpacing: -0.8 }}>{data.active}<Text style={{ color: 'rgba(255,255,255,0.55)', fontSize: 17, fontFamily: F.semibold, letterSpacing: 0 }}>{` / ${data.total}`}</Text></Text>
          <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 14, fontFamily: F.regular }}>ont posté cette semaine</Text>
        </View>
        <View style={{ height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.16)', marginTop: 8, overflow: 'hidden' }}>
          <View style={{ width: `${pct}%`, height: '100%', backgroundColor: '#fff', borderRadius: 4 }} />
        </View>

        {nudge.length > 0 ? (
          <View style={{ marginTop: 12 }}>
            <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, fontFamily: F.semibold }}>À relancer</Text>
            {nudge.map(f => {
              const done = nudged.has(f.id);
              return (
                <View key={f.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 }}>
                  <TouchableOpacity onPress={() => onOpenProfile(f.id)} activeOpacity={0.8} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <Face f={f} size={30} />
                    <Text style={{ color: '#fff', fontSize: 14, fontFamily: F.semibold }} numberOfLines={1}>{f.full_name.split(' ')[0]}</Text>
                    <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, fontFamily: F.regular }}>{f.daysAgo === null ? 'inactif' : `${f.daysAgo} j sans séance`}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => doNudge(f)}
                    disabled={done}
                    activeOpacity={0.85}
                    accessibilityLabel={done ? `${f.full_name} relancé` : `Relancer ${f.full_name}`}
                    style={{ height: 32, borderRadius: 16, paddingHorizontal: 14, backgroundColor: done ? 'transparent' : '#fff', borderWidth: done ? 1 : 0, borderColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' }}
                  >
                    <Text style={{ color: done ? 'rgba(255,255,255,0.6)' : '#000', fontSize: 13, fontFamily: F.extrabold }}>{done ? 'Relancé' : 'Relancer'}</Text>
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        ) : data.active > 0 ? (
          <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, fontFamily: F.semibold, marginTop: 14 }}>Tout le monde est en rythme 🔥</Text>
        ) : null}
      </TouchableOpacity>

      {open && (
        <View style={{ paddingHorizontal: 18, paddingBottom: 14, gap: 4 }}>
          <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.12)', marginBottom: 8 }} />
          {data.friends.map(f => (
            <TouchableOpacity key={f.id} onPress={() => onOpenProfile(f.id)} activeOpacity={0.8} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 }}>
              <Face f={f} size={36} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: '#fff', fontSize: 15, fontFamily: F.bold }} numberOfLines={1}>{f.full_name}</Text>
                <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, fontFamily: F.regular }}>{lastLabel(f)}</Text>
              </View>
              <Week f={f} />
            </TouchableOpacity>
          ))}
        </View>
      )}
    </GlassCard>
  );
}

import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { GlassSurface } from './GlassSurface';
import { Faces } from './CloseCircleCard';
import { supabase } from '../lib/supabase';
import { signAvatars } from '../lib/storage';
import { GUTTER } from '../constants';
import { F } from '../styles';

// Sur TON profil : tes amis (quelques visages, le nombre) et le bouton pour voir la liste complète, où l'on
// gère aussi le cercle proche et où l'on retire un ami. L'onglet Amis, lui, sert à en trouver de nouveaux.
export function MyFriendsBubble({ userId, onOpen, reloadKey }: { userId: string; onOpen: () => void; reloadKey?: unknown }) {
  const [people, setPeople] = useState<{ id: string; full_name: string; avatar_url: string | null }[] | null>(null);
  const [count, setCount] = useState(0);

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data } = await supabase.rpc('friends_of', { p_user: userId });
      const list = [...new Map(((data || []) as any[]).map(p => [p.id, p])).values()];
      const top = list.slice(0, 5);
      const signed = await signAvatars(top.map(p => p.avatar_url));
      if (!alive) return;
      setCount(list.length);
      setPeople(top.map(p => ({ id: p.id, full_name: p.full_name, avatar_url: p.avatar_url ? signed[p.avatar_url] ?? null : null })));
    })().catch(() => {});
    return () => { alive = false; };
  }, [userId, reloadKey]);

  if (people === null || count === 0) return null;
  return (
    <TouchableOpacity onPress={onOpen} activeOpacity={0.85} accessibilityRole="button" accessibilityLabel={`Voir mes ${count} amis`}>
      <GlassSurface radius={28} style={{ marginHorizontal: GUTTER, marginTop: 14 }}>
        <View style={{ padding: 18 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Ionicons name="people" size={13} color="rgba(255,255,255,0.55)" />
            <Text style={{ color: 'rgba(255,255,255,0.55)', fontSize: 10, fontFamily: F.bold, letterSpacing: 1.5 }}>MES AMIS</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 }}>
            <Faces people={people} size={40} />
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 14, fontFamily: F.semibold }}>{count} {count > 1 ? 'amis' : 'ami'}</Text>
              <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.5)" />
            </View>
          </View>
        </View>
      </GlassSurface>
    </TouchableOpacity>
  );
}

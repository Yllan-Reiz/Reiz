import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, Image, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { supabase } from '../lib/supabase';
import { signAvatars } from '../lib/storage';
import { sportName } from '../lib/helpers';
import { track } from '../lib/track';
import { GlassSurface } from './GlassSurface';
import { F } from '../styles';
import { t, tp } from '../i18n';

// Des gens à ajouter dès l'accueil (1.3, 05/11/2026). Au 05/11, aucun des nouveaux passés par l'accueil n'avait
// ajouté d'ami : l'écran ne proposait qu'un lien à partager. Ici, en un geste : les amis de ceux qui t'ont déjà
// ajouté, les gens de ton sport (choisi juste avant), puis les nouveaux sur Reiz. Chacun une seule fois.

type Person = { id: string; name: string; avatar: string | null; reason: string };
const MAX_ROWS = 5;

export function WelcomeSuggestions({ userId, dryRun, onAdded }: { userId: string | null; /** Aperçu (Réglages) : rien n'est envoyé. */ dryRun?: boolean; onAdded?: () => void }) {
  const [people, setPeople] = useState<Person[] | null>(null);
  const [sent, setSent] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    let alive = true;
    (async () => {
      // Déjà ami, demande envoyée ou reçue : jamais proposé ici (les demandes reçues ont leur propre carte).
      const { data: rel } = await supabase.from('friendships').select('requester_id, receiver_id')
        .or(`requester_id.eq.${userId},receiver_id.eq.${userId}`);
      const known = new Set<string>([userId, ...((rel as any[]) || []).flatMap(r => [r.requester_id, r.receiver_id])]);
      const out = new Map<string, Person>();
      const add = (u: any, reason: string) => {
        if (!u?.id || known.has(u.id) || out.has(u.id)) return;
        out.set(u.id, { id: u.id, name: u.full_name || u.username || '?', avatar: u.avatar_url ?? null, reason });
      };
      const [mutual, me] = await Promise.all([
        supabase.rpc('suggest_friends', { p_limit: 8 }),
        supabase.from('users').select('sport').eq('id', userId).maybeSingle(),
      ]);
      ((mutual.data as any[]) || []).forEach(u => add(u, tp('friends.mutual', u.mutual)));
      if (me.data?.sport && me.data.sport !== 'autre') {
        const { data: same } = await supabase.rpc('discover_people', { p_terms: [me.data.sport], p_limit: 8 });
        ((same as any[]) || []).filter(u => u.reason?.startsWith('Sport'))
          .forEach(u => add(u, t('friends.sameSport', { sport: sportName(u.reason.replace('Sport : ', '')) })));
      }
      const { data: fresh } = await supabase.rpc('new_members', { p_limit: 8 });
      ((fresh as any[]) || []).forEach(u => add(u, t('suggest.newOnReiz')));
      const top = [...out.values()].slice(0, MAX_ROWS);
      const signed = await signAvatars(top.map(p => p.avatar));
      top.forEach(p => { if (p.avatar) p.avatar = signed[p.avatar] ?? null; });
      if (alive) setPeople(top);
    })().catch(() => { if (alive) setPeople([]); });
    return () => { alive = false; };
  }, [userId]);

  const addFriend = async (p: Person) => {
    if (!userId || busy || sent.has(p.id)) return;
    setBusy(p.id);
    const { error } = dryRun ? { error: null } : await supabase.from('friendships').insert({ requester_id: userId, receiver_id: p.id, status: 'pending' });
    setBusy(null);
    // 23505 : la demande existe déjà, c'est le même résultat pour la personne.
    if (error && error.code !== '23505') return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    if (!dryRun) track('friend_request', { from: 'welcome' }, 'welcome');
    setSent(prev => new Set(prev).add(p.id));
    onAdded?.();
  };

  if (!userId) return null;
  if (people === null) return <ActivityIndicator color="rgba(255,255,255,0.6)" style={{ marginTop: 8 }} />;
  if (people.length === 0) return null;

  return (
    <GlassSurface radius={28}>
      <View style={{ padding: 18, paddingBottom: 10 }}>
        <Text style={{ color: 'rgba(255,255,255,0.55)', fontSize: 10, fontFamily: F.bold, letterSpacing: 1.5 }}>{t('suggest.title')}</Text>
        {people.map((p, i) => {
          const done = sent.has(p.id);
          return (
            <View key={p.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: 'rgba(255,255,255,0.08)', marginTop: i === 0 ? 6 : 0 }}>
              {p.avatar
                ? <Image source={{ uri: p.avatar }} style={{ width: 40, height: 40, borderRadius: 20 }} />
                : <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: '#fff', fontFamily: F.bold, fontSize: 16 }}>{p.name.charAt(0).toUpperCase()}</Text></View>}
              <View style={{ flex: 1 }}>
                <Text numberOfLines={1} style={{ color: '#fff', fontSize: 15, fontFamily: F.bold }}>{p.name}</Text>
                <Text numberOfLines={1} style={{ color: 'rgba(255,255,255,0.55)', fontSize: 12.5, fontFamily: F.regular, marginTop: 1 }}>{p.reason}</Text>
              </View>
              <TouchableOpacity onPress={() => addFriend(p)} disabled={done || !!busy} accessibilityRole="button" accessibilityLabel={t('suggest.addA11y', { name: p.name })} accessibilityState={{ disabled: done }} hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
                style={{ height: 36, paddingHorizontal: 14, borderRadius: 18, backgroundColor: done ? 'rgba(255,255,255,0.12)' : '#fff', alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6, opacity: busy === p.id ? 0.5 : 1 }}>
                <Ionicons name={done ? 'checkmark' : 'person-add'} size={15} color={done ? 'rgba(255,255,255,0.7)' : '#000'} />
                <Text style={{ color: done ? 'rgba(255,255,255,0.7)' : '#000', fontSize: 14, fontFamily: F.extrabold }}>{done ? t('suggest.sent') : t('suggest.add')}</Text>
              </TouchableOpacity>
            </View>
          );
        })}
      </View>
    </GlassSurface>
  );
}

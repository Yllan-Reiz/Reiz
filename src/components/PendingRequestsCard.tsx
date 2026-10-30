import { useCallback, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, Image, AppState } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { supabase } from '../lib/supabase';
import { signAvatars } from '../lib/storage';
import { track } from '../lib/track';
import { GlassSurface } from './GlassSurface';
import { F } from '../styles';
import { t, tp, dirIcon } from '../i18n';

// Les demandes d'ami reçues, là où on les voit (1.2, 30/10/2026) : en haut du fil, et dans l'écran Amis de
// l'accueil. Avant, elles n'étaient que dans l'onglet Amis : au 30/10, les 11 membres sans ami avaient tous une
// demande en attente, et aucun ne l'avait vue. Accepter ou refuser se fait ici, d'un geste.
// La carte disparaît quand il n'y a plus rien à répondre.

type Req = { friendshipId: string; id: string; name: string; avatar: string | null };
const MAX_ROWS = 3;

export function PendingRequestsCard({ userId, from, onChanged, onSeeAll, style }: {
  userId: string | null;
  /** Pour le back-office : fil, accueil. */
  from: string;
  /** Une demande acceptée ou refusée : compteurs et fil à relire. */
  onChanged?: () => void;
  onSeeAll?: () => void;
  style?: any;
}) {
  const [reqs, setReqs] = useState<Req[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!userId) return;
    const { data } = await supabase.from('friendships')
      .select('id, created_at, requester:users!friendships_requester_id_fkey(id, full_name, avatar_url)')
      .eq('receiver_id', userId).eq('status', 'pending').order('created_at', { ascending: false });
    const rows = ((data as any[]) || []).filter(r => r.requester);
    const signed = await signAvatars(rows.map(r => r.requester.avatar_url));
    setReqs(rows.map(r => ({ friendshipId: r.id, id: r.requester.id, name: r.requester.full_name, avatar: r.requester.avatar_url ? signed[r.requester.avatar_url] ?? null : null })));
  }, [userId]);

  useEffect(() => {
    load();
    // Une demande peut arriver pendant que l'app dort : relue au retour.
    const sub = AppState.addEventListener('change', st => { if (st === 'active') load(); });
    return () => sub.remove();
  }, [load]);

  const answer = async (r: Req, accept: boolean) => {
    if (busy) return;
    setBusy(r.friendshipId);
    const { error } = accept
      ? await supabase.from('friendships').update({ status: 'accepted' }).eq('id', r.friendshipId)
      : await supabase.from('friendships').delete().eq('id', r.friendshipId);
    setBusy(null);
    if (error) return;
    if (accept) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    else Haptics.selectionAsync().catch(() => {});
    track('friend_answer', { from, accept }, from);
    setReqs(list => list.filter(x => x.friendshipId !== r.friendshipId));
    onChanged?.();
  };

  if (!userId || reqs.length === 0) return null;
  const shown = reqs.slice(0, MAX_ROWS);

  return (
    <GlassSurface radius={28} style={[{ marginBottom: 14 }, style]}>
      <View style={{ padding: 18, paddingBottom: 10 }}>
        <Text style={{ color: 'rgba(255,255,255,0.55)', fontSize: 10, fontFamily: F.bold, letterSpacing: 1.5 }}>
          {tp('requests.label', reqs.length)}
        </Text>
        {shown.map((r, i) => (
          <View key={r.friendshipId} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: 'rgba(255,255,255,0.08)', marginTop: i === 0 ? 6 : 0 }}>
            {r.avatar
              ? <Image source={{ uri: r.avatar }} style={{ width: 40, height: 40, borderRadius: 20 }} />
              : <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: '#fff', fontFamily: F.bold, fontSize: 16 }}>{(r.name || '?').charAt(0).toUpperCase()}</Text></View>}
            <View style={{ flex: 1 }}>
              <Text numberOfLines={1} style={{ color: '#fff', fontSize: 15, fontFamily: F.bold }}>{r.name}</Text>
              <Text numberOfLines={1} style={{ color: 'rgba(255,255,255,0.55)', fontSize: 12.5, fontFamily: F.regular, marginTop: 1 }}>{t('requests.wants')}</Text>
            </View>
            {/* Mêmes boutons que l'onglet Amis : coche blanche, croix discrète. */}
            <TouchableOpacity onPress={() => answer(r, true)} disabled={!!busy} accessibilityRole="button" accessibilityLabel={t('requests.accept', { name: r.name })} hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
              style={{ height: 36, paddingHorizontal: 14, borderRadius: 18, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6, opacity: busy === r.friendshipId ? 0.5 : 1 }}>
              <Ionicons name="checkmark" size={17} color="#000" />
              <Text style={{ color: '#000', fontSize: 14, fontFamily: F.extrabold }}>{t('requests.acceptShort')}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => answer(r, false)} disabled={!!busy} accessibilityRole="button" accessibilityLabel={t('requests.decline', { name: r.name })} hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
              style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="close" size={16} color="rgba(255,255,255,0.7)" />
            </TouchableOpacity>
          </View>
        ))}
        {reqs.length > MAX_ROWS && onSeeAll && (
          <TouchableOpacity onPress={onSeeAll} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 8 }} accessibilityRole="button">
            <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 14, fontFamily: F.semibold }}>{t('requests.seeAll', { n: reqs.length })}</Text>
            <Ionicons name={dirIcon('chevron-forward')} size={15} color="rgba(255,255,255,0.6)" />
          </TouchableOpacity>
        )}
      </View>
    </GlassSurface>
  );
}

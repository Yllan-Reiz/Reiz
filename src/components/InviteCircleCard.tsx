import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, Share } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { supabase } from '../lib/supabase';
import { inviteText } from '../lib/contacts';
import { track } from '../lib/track';
import { GlassSurface } from './GlassSurface';
import { F } from '../styles';
import { t, tp } from '../i18n';

// L'invitation mise en avant (1.3, 05/11/2026) : en haut du fil tant que le cercle compte moins de 3 amis.
// Le lien porte ton pseudo : la personne qui s'inscrit avec t'envoie une demande toute seule (voir invites.ts).
// La carte disparaît d'elle-même à partir de 3 amis.
const ENOUGH = 3;

export function InviteCircleCard({ userId, friendCount }: { userId: string | null; friendCount: number | null }) {
  const [username, setUsername] = useState<string | null>(null);
  useEffect(() => {
    if (!userId) return;
    supabase.from('users').select('username').eq('id', userId).maybeSingle()
      .then(({ data }) => setUsername(data?.username ?? null), () => {});
  }, [userId]);

  if (!userId || friendCount === null || friendCount >= ENOUGH) return null;

  const invite = async () => {
    Haptics.selectionAsync().catch(() => {});
    track('invite_share', { from: 'feed', friends: friendCount }, 'feed');
    try { await Share.share({ message: inviteText(username) }); } catch {}
  };

  return (
    <GlassSurface radius={28} style={{ marginBottom: 14 }}>
      <View style={{ padding: 18 }}>
        <Text style={{ color: 'rgba(255,255,255,0.55)', fontSize: 10, fontFamily: F.bold, letterSpacing: 1.5 }}>{t('inviteCard.label')}</Text>
        <Text style={{ color: '#fff', fontSize: 18, fontFamily: F.extrabold, marginTop: 10, letterSpacing: -0.3 }}>
          {friendCount === 0 ? t('inviteCard.titleNone') : tp('inviteCard.title', friendCount)}
        </Text>
        <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 14, lineHeight: 20, fontFamily: F.regular, marginTop: 4 }}>{t('inviteCard.text')}</Text>
        <TouchableOpacity onPress={invite} activeOpacity={0.85} accessibilityRole="button"
          style={{ marginTop: 14, height: 44, borderRadius: 16, backgroundColor: '#fff', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <Ionicons name="share-outline" size={18} color="#000" />
          <Text style={{ color: '#000', fontSize: 15, fontFamily: F.extrabold }}>{t('inviteCard.cta')}</Text>
        </TouchableOpacity>
      </View>
    </GlassSurface>
  );
}

import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { shareInvite } from '../lib/invites';
import { track } from '../lib/track';
import { GlassSurface } from './GlassSurface';
import { F } from '../styles';
import { t, tp } from '../i18n';

// L'invitation mise en avant (1.3, 05/11/2026) : en haut du fil tant que le cercle compte moins de 3 amis.
// Le lien est personnel (1.4) : la personne qui s'inscrit avec devient ton amie tout de suite (voir invites.ts).
// La carte disparaît d'elle-même à partir de 3 amis.
const ENOUGH = 3;

export function InviteCircleCard({ userId, friendCount }: { userId: string | null; friendCount: number | null }) {
  // Aucun ami : la carte « Ta semaine » (SoloCard) porte déjà l'invitation.
  if (!userId || friendCount === null || friendCount === 0 || friendCount >= ENOUGH) return null;

  const invite = async () => {
    Haptics.selectionAsync().catch(() => {});
    track('invite_share', { from: 'feed', friends: friendCount }, 'feed');
    // 1.4 : le lien personnel (ami d'office à l'inscription), plus le lien de l'App Store.
    await shareInvite(userId, 'share', 'feed').catch(() => {});
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

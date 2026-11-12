import { forwardRef } from 'react';
import { View, Text, Image, Share } from 'react-native';
import { requireOptionalNativeModule } from 'expo';
import * as Sharing from 'expo-sharing';
import { captureRef } from 'react-native-view-shot';
import { QrCode } from './QrCode';
import { myInviteLink } from '../lib/invites';
import { track } from '../lib/track';
import { F } from '../styles';
import { t } from '../i18n';

// La carte d'invitation (inspirée de BeReal) : ta photo, ton nom, ton @pseudo et le QR code de TON lien personnel.
// Celui qui le scanne et s'inscrit devient ton ami tout de suite, comme avec le lien envoyé par message.
// Une seule carte et un seul partage pour toute l'app (12/11/2026) : la feuille de l'onglet Amis l'affiche, l'accueil
// (« Qui te suit ? ») la garde hors de l'écran pour en faire l'image à poster sur Instagram.

// Le presse-papiers (expo-clipboard) est un module natif arrivé avec la 1.0.1 : on vérifie qu'il existe avant de le charger.
let clip: any | null | undefined;
export function clipboard(): any | null {
  if (clip !== undefined) return clip;
  try { clip = requireOptionalNativeModule('ExpoClipboard') ? require('expo-clipboard') : null; } catch { clip = null; }
  return clip;
}

export const InviteCard = forwardRef<View, {
  width: number;
  name: string;
  username?: string | null;
  avatar?: string | null;
  /** Ce que le QR code ouvre : le lien d'invitation personnel (ou l'App Store tant qu'il n'est pas chargé). */
  link: string;
  /** Le lien est personnel : « Scanne pour rejoindre Léa ». Sinon l'ancienne phrase (télécharger puis ajouter). */
  personal: boolean;
}>(function InviteCard({ width, name, username, avatar, link, personal }, ref) {
  const first = name.trim().split(' ')[0] || t('shareSheet.me');
  return (
    <View ref={ref} collapsable={false} style={{ width, alignItems: 'center' }}>
      <View style={{ width, marginTop: 60, borderRadius: 32, backgroundColor: '#fafafa', alignItems: 'center', paddingTop: 72, paddingBottom: 28 }}>
        <Text style={{ color: '#0a0a0a', fontSize: 24, fontFamily: F.black, letterSpacing: -0.6 }} numberOfLines={1}>{name}</Text>
        {!!username && <Text style={{ color: '#8a8a8a', fontSize: 16, fontFamily: F.semibold, marginTop: 2 }}>@{username}</Text>}
        <View style={{ marginTop: 20 }}>
          <QrCode value={link} size={width - 96} logo={require('../../assets/ecriture-reiz-blanc.png')} />
        </View>
        <Text style={{ color: '#8a8a8a', fontSize: 12, fontFamily: F.semibold, marginTop: 16, textAlign: 'center', paddingHorizontal: 20 }}>
          {personal ? t('shareSheet.scanInvite', { who: first }) : t('shareSheet.scan', { who: username ? `@${username}` : t('shareSheet.me') })}
        </Text>
      </View>
      {/* La photo dépasse du haut de la carte. */}
      <View style={{ position: 'absolute', top: 0, width: 120, height: 120, borderRadius: 60, borderWidth: 4, borderColor: '#fafafa', backgroundColor: '#2a2a2a', overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
        {avatar ? <Image source={{ uri: avatar }} style={{ width: 120, height: 120 }} /> : <Text style={{ color: '#fff', fontSize: 44, fontFamily: F.black }}>{(name.trim().charAt(0) || 'R').toUpperCase()}</Text>}
      </View>
    </View>
  );
});

/**
 * Instagram : la carte devient une image (story, post ou message) et le lien personnel est copié, pour le coller en
 * sticker « Lien ». La feuille de partage du téléphone s'ouvre, rien n'est publié sans le geste de la personne.
 * `onCopied` : appelé dès que le lien est dans le presse-papiers, pour afficher « Lien copié ». Renvoie vrai si le
 * partage a été ouvert.
 */
export async function shareInviteCard(card: React.RefObject<View | null>, userId: string, from: string, onCopied?: () => void): Promise<boolean> {
  const { link, personal } = await myInviteLink(userId);
  const c = clipboard();
  if (c) { try { await c.setStringAsync(link); onCopied?.(); } catch {} }
  const sent = () => { track('invite_sent', { channel: 'instagram', from, personal }); };
  try {
    const uri = await captureRef(card, { format: 'png', quality: 1, result: 'tmpfile' });
    await Sharing.shareAsync(uri, { mimeType: 'image/png', UTI: 'public.png', dialogTitle: t('shareSheet.shareInstagram') });
    sent();
    return true;
  } catch {
    // Pas d'image possible (module absent, carte pas prête) : le message et le lien, par la feuille de partage.
    try {
      const r = await Share.share({ message: t('invite.linkText', { link }) });
      if (r.action === Share.dismissedAction) return false;
      sent();
      return true;
    } catch { return false; }
  }
}

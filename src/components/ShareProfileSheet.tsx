import { useEffect, useRef, useState } from 'react';
import { View, Text, Image, Modal, TouchableOpacity, Animated, Share, StyleSheet, Platform, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { GlassSurface, ANDROID_BLUR_METHOD } from './GlassSurface';
import { InviteCard, shareInviteCard, clipboard } from './InviteCard';
import { APP_STORE_URL } from '../constants';
import { currentUser } from '../lib/supabase';
import { currentInviteLink, myInviteLink, shareInvite, type InviteChannel } from '../lib/invites';
import { F } from '../styles';
import { t } from '../i18n';

// La carte de partage de ton profil (InviteCard) : ta photo, ton nom, ton @pseudo et le QR code de ton lien personnel.
// En dessous, les raccourcis de partage : Instagram, WhatsApp, Messages, copier, et la feuille de partage.
// Même lien, même message et mêmes canaux qu'à l'accueil (« Qui te suit ? ») : tout passe par shareInvite et
// shareInviteCard. Celui qui scanne le QR code ou ouvre le lien et s'inscrit devient ton ami tout de suite.

export const inviteMessage = (username?: string | null) =>
  `${t('shareSheet.message')}${username ? `\n${t('shareSheet.addMe', { username })}` : ''}\n${currentInviteLink() ?? APP_STORE_URL}`;

export function ShareProfileSheet({ visible, onClose, name, username, avatar }: {
  visible: boolean;
  onClose: () => void;
  name: string;
  username: string | null;
  avatar: string | null;
}) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [copied, setCopied] = useState(false);
  const toast = useRef(new Animated.Value(0)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cardRef = useRef<View>(null);
  const [toastText, setToastText] = useState('');
  const cardW = Math.min(width - 72, 340);
  const [uid, setUid] = useState<string | null>(null);
  // Le lien personnel est en général déjà chargé (Main le prépare) ; sinon il arrive un instant après l'ouverture.
  const [mine, setMine] = useState<{ link: string; personal: boolean }>(() => {
    const l = currentInviteLink();
    return { link: l ?? APP_STORE_URL, personal: !!l };
  });
  useEffect(() => {
    if (!visible) return;
    let alive = true;
    currentUser().then(async u => {
      if (!u || !alive) return;
      setUid(u.id);
      const l = await myInviteLink(u.id);
      if (alive) setMine(l);
    }).catch(() => {});
    return () => { alive = false; };
  }, [visible]);
  // Lien personnel : le même message qu'à l'accueil. Sinon l'ancien, qui donne le @pseudo à ajouter.
  const message = mine.personal ? t('invite.linkText', { link: mine.link }) : inviteMessage(username);

  useEffect(() => { if (!visible) { setCopied(false); toast.setValue(0); } }, [visible, toast]);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const showCopied = (text = t('shareSheet.copied')) => {
    setToastText(text);
    setCopied(true);
    Animated.spring(toast, { toValue: 1, useNativeDriver: true, damping: 16, stiffness: 220 }).start();
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => Animated.timing(toast, { toValue: 0, duration: 220, useNativeDriver: true }).start(() => setCopied(false)), 1800);
  };

  const copy = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    const c = clipboard();
    if (c) { await c.setStringAsync(message).catch(() => {}); showCopied(); return; }
    Share.share({ message }).catch(() => {}); // build sans le module : la feuille de partage propose « Copier »
  };
  const send = (channel: InviteChannel) => {
    Haptics.selectionAsync().catch(() => {});
    if (uid) shareInvite(uid, channel, 'friends').catch(() => {});
    else Share.share({ message }).catch(() => {});
  };
  // Instagram : la carte (photo, nom, QR code) devient une image à poster en story, en post ou en message.
  // Le lien personnel est copié en même temps, pour le coller en sticker « Lien » sur la story.
  const shareInstagram = () => {
    Haptics.selectionAsync().catch(() => {});
    if (uid) shareInviteCard(cardRef, uid, 'friends', () => showCopied(t('shareSheet.linkCopied'))).catch(() => {});
    else Share.share({ message }).catch(() => {});
  };

  const actions: { label: string; icon: any; bg: string; gradient?: readonly [string, string, string]; onPress: () => void }[] = [
    { label: 'Instagram', icon: 'logo-instagram', bg: '#d62976', gradient: ['#feda75', '#d62976', '#4f5bd5'], onPress: shareInstagram },
    { label: 'WhatsApp', icon: 'logo-whatsapp', bg: '#25D366', onPress: () => send('whatsapp') },
    { label: 'Messages', icon: 'chatbubble', bg: '#34C759', onPress: () => send('sms') },
    { label: t('story.copy'), icon: 'link', bg: 'rgba(255,255,255,0.14)', onPress: () => copy() },
    { label: t('common.more'), icon: 'share-outline', bg: 'rgba(255,255,255,0.14)', onPress: () => send('share') },
  ];

  return (
    <Modal visible={visible} animationType="fade" presentationStyle="overFullScreen" transparent onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: '#0a0a0a' }}>
        {/* Fond : ta photo floutée, comme la carte BeReal. */}
        {avatar ? <Image source={{ uri: avatar }} style={StyleSheet.absoluteFill} resizeMode="cover" blurRadius={Platform.OS === 'ios' ? 0 : 20} /> : null}
        <BlurView intensity={80} tint="dark" experimentalBlurMethod={ANDROID_BLUR_METHOD} style={StyleSheet.absoluteFill} />
        <LinearGradient colors={['rgba(10,10,10,0.35)', 'rgba(10,10,10,0.7)']} style={StyleSheet.absoluteFill} />

        <View style={{ paddingTop: insets.top + 8, paddingHorizontal: 16, flexDirection: 'row' }}>
          <TouchableOpacity onPress={onClose} accessibilityLabel={t('common.close')} hitSlop={10}>
            <GlassSurface radius={24} variant="clear" style={{ width: 48, height: 48, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="close" size={24} color="#fff" />
            </GlassSurface>
          </TouchableOpacity>
        </View>

        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <InviteCard ref={cardRef} width={cardW} name={name} username={username} avatar={avatar} link={mine.link} personal={mine.personal} />

          <Animated.View pointerEvents="none" style={{ marginTop: 22, opacity: toast, transform: [{ scale: toast.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] }) }] }}>
            <GlassSurface radius={26} variant="regular" tintColor="rgba(255,255,255,0.08)" style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 22, height: 52, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)' }}>
              <Ionicons name="checkmark-circle-outline" size={22} color="#34C759" />
              <Text style={{ color: '#fff', fontSize: 17, fontFamily: F.bold }}>{copied ? toastText : ' '}</Text>
            </GlassSurface>
          </Animated.View>
        </View>

        <View style={{ flexDirection: 'row', justifyContent: 'space-evenly', paddingHorizontal: 8, paddingBottom: insets.bottom + 20 }}>
          {actions.map(a => (
            <TouchableOpacity key={a.label} onPress={a.onPress} activeOpacity={0.8} accessibilityRole="button" accessibilityLabel={a.label} style={{ alignItems: 'center', width: 70 }}>
              <View style={{ width: 58, height: 58, borderRadius: 29, backgroundColor: a.bg, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                {a.gradient && <LinearGradient colors={a.gradient} start={{ x: 0, y: 1 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />}
                <Ionicons name={a.icon} size={26} color="#fff" />
              </View>
              <Text style={{ color: '#fff', fontSize: 12, fontFamily: F.semibold, marginTop: 8 }} numberOfLines={1} maxFontSizeMultiplier={1.2}>{a.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </Modal>
  );
}

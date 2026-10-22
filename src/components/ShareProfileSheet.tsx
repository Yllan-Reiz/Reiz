import { useEffect, useRef, useState } from 'react';
import { View, Text, Image, Modal, TouchableOpacity, Animated, Linking, Share, StyleSheet, Platform, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { requireOptionalNativeModule } from 'expo';
import { GlassSurface } from './GlassSurface';
import { QrCode } from './QrCode';
import { APP_STORE_URL } from '../constants';
import { F } from '../styles';

// La carte de partage de ton profil (inspirée de BeReal) : ta photo, ton nom, ton @pseudo et un QR code qui ouvre
// Reiz sur l'App Store. En dessous, les raccourcis de partage : copier, WhatsApp, Messages, et la feuille de partage.

// Le presse-papiers (expo-clipboard) est un module natif arrivé avec la 1.0.1 : on vérifie qu'il existe avant de le charger.
let clip: any | null | undefined;
function clipboard(): any | null {
  if (clip !== undefined) return clip;
  try { clip = requireOptionalNativeModule('ExpoClipboard') ? require('expo-clipboard') : null; } catch { clip = null; }
  return clip;
}

export const inviteMessage = (username?: string | null) =>
  `Rejoins-moi sur Reiz, on se motive ensemble 💪${username ? `\nAjoute-moi : @${username}` : ''}\n${APP_STORE_URL}`;

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
  const message = inviteMessage(username);
  const cardW = Math.min(width - 72, 340);
  const qrSize = cardW - 96;

  useEffect(() => { if (!visible) { setCopied(false); toast.setValue(0); } }, [visible, toast]);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const showCopied = () => {
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
  const openApp = async (url: string) => {
    Haptics.selectionAsync().catch(() => {});
    try { await Linking.openURL(url); } catch { Share.share({ message }).catch(() => {}); }
  };
  const more = () => { Haptics.selectionAsync().catch(() => {}); Share.share({ message }).catch(() => {}); };

  const actions: { label: string; icon: any; bg: string; onPress: () => void }[] = [
    { label: 'Copier', icon: 'link', bg: 'rgba(255,255,255,0.14)', onPress: copy },
    { label: 'WhatsApp', icon: 'logo-whatsapp', bg: '#25D366', onPress: () => openApp(`whatsapp://send?text=${encodeURIComponent(message)}`) },
    { label: 'Messages', icon: 'chatbubble', bg: '#34C759', onPress: () => openApp(`sms:${Platform.OS === 'ios' ? '&' : '?'}body=${encodeURIComponent(message)}`) },
    { label: 'Plus', icon: 'share-outline', bg: 'rgba(255,255,255,0.14)', onPress: more },
  ];

  return (
    <Modal visible={visible} animationType="fade" presentationStyle="overFullScreen" transparent onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: '#0a0a0a' }}>
        {/* Fond : ta photo floutée, comme la carte BeReal. */}
        {avatar ? <Image source={{ uri: avatar }} style={StyleSheet.absoluteFill} resizeMode="cover" blurRadius={Platform.OS === 'ios' ? 0 : 20} /> : null}
        <BlurView intensity={80} tint="dark" style={StyleSheet.absoluteFill} />
        <LinearGradient colors={['rgba(10,10,10,0.35)', 'rgba(10,10,10,0.7)']} style={StyleSheet.absoluteFill} />

        <View style={{ paddingTop: insets.top + 8, paddingHorizontal: 16, flexDirection: 'row' }}>
          <TouchableOpacity onPress={onClose} accessibilityLabel="Fermer" hitSlop={10}>
            <GlassSurface radius={24} variant="clear" style={{ width: 48, height: 48, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="close" size={24} color="#fff" />
            </GlassSurface>
          </TouchableOpacity>
        </View>

        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <View style={{ width: cardW, alignItems: 'center' }}>
            <View style={{ width: cardW, marginTop: 60, borderRadius: 32, backgroundColor: '#fafafa', alignItems: 'center', paddingTop: 72, paddingBottom: 28 }}>
              <Text style={{ color: '#0a0a0a', fontSize: 24, fontFamily: F.black, letterSpacing: -0.6 }} numberOfLines={1}>{name}</Text>
              {!!username && <Text style={{ color: '#8a8a8a', fontSize: 16, fontFamily: F.semibold, marginTop: 2 }}>@{username}</Text>}
              <View style={{ marginTop: 20 }}>
                <QrCode value={APP_STORE_URL} size={qrSize} logo={require('../../assets/ecriture-reiz-blanc.png')} />
              </View>
              <Text style={{ color: '#8a8a8a', fontSize: 12, fontFamily: F.semibold, marginTop: 16, textAlign: 'center', paddingHorizontal: 20 }}>
                Scanne pour télécharger Reiz, puis ajoute {username ? `@${username}` : 'moi'}
              </Text>
            </View>
            {/* La photo dépasse du haut de la carte. */}
            <View style={{ position: 'absolute', top: 0, width: 120, height: 120, borderRadius: 60, borderWidth: 4, borderColor: '#fafafa', backgroundColor: '#2a2a2a', overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
              {avatar ? <Image source={{ uri: avatar }} style={{ width: 120, height: 120 }} /> : <Text style={{ color: '#fff', fontSize: 44, fontFamily: F.black }}>{name.charAt(0).toUpperCase()}</Text>}
            </View>
          </View>

          <Animated.View pointerEvents="none" style={{ marginTop: 22, opacity: toast, transform: [{ scale: toast.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] }) }] }}>
            <GlassSurface radius={26} variant="regular" tintColor="rgba(255,255,255,0.08)" style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 22, height: 52, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)' }}>
              <Ionicons name="checkmark-circle-outline" size={22} color="#34C759" />
              <Text style={{ color: '#fff', fontSize: 17, fontFamily: F.bold }}>{copied ? 'Copié !' : ' '}</Text>
            </GlassSurface>
          </Animated.View>
        </View>

        <View style={{ flexDirection: 'row', justifyContent: 'space-evenly', paddingHorizontal: 12, paddingBottom: insets.bottom + 20 }}>
          {actions.map(a => (
            <TouchableOpacity key={a.label} onPress={a.onPress} activeOpacity={0.8} accessibilityRole="button" accessibilityLabel={a.label} style={{ alignItems: 'center', width: 76 }}>
              <View style={{ width: 62, height: 62, borderRadius: 31, backgroundColor: a.bg, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name={a.icon} size={26} color="#fff" />
              </View>
              <Text style={{ color: '#fff', fontSize: 13, fontFamily: F.semibold, marginTop: 8 }}>{a.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </Modal>
  );
}

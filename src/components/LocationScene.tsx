import { useEffect, useRef } from 'react';
import { View, Text, Image, Animated, Easing, ImageSourcePropType } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { GlassSurface } from './GlassSurface';
import { F } from '../styles';

// L'illustration de l'étape « Ton lieu d'entraînement » de l'accueil : un plan de quartier sombre, ta salle
// avec sa zone de détection qui pulse, et ta photo qui arrive dans la zone. À l'arrivée, la notification
// « Ton cercle proche est prévenu » descend en haut du plan. En boucle, sans module de carte (simples vues).

const EASE = Easing.bezier(0.23, 1, 0.32, 1);

export function LocationScene({ width, height = 264, fullBleed, cardTop = 12, avatar, circle }: {
  width: number;
  height?: number;
  /** Bord à bord, sans cadre arrondi (en haut de l'écran, comme la photo du profil). */
  fullBleed?: boolean;
  /** Hauteur où descend la notification (sous la barre de progression en plein écran). */
  cardTop?: number;
  /** Ta photo de profil (sinon une silhouette). */
  avatar: string | null;
  /** Quelques visages du cercle proche, pour la notification. */
  circle: ImageSourcePropType[];
}) {
  const W = width;
  const H = height;
  // Les rues : une verticale et une horizontale qui se croisent, plus une avenue en biais.
  const roadX = W * 0.28;
  const roadY = Math.round(H * (fullBleed ? 0.62 : 0.65));
  // La salle et sa zone de détection.
  const gym = { x: W * 0.68, y: Math.round(H * (fullBleed ? 0.5 : 0.485)) };
  const R = fullBleed ? 72 : 60;
  // Trajet de la photo : on remonte la rue verticale, puis on prend la rue horizontale jusqu'à la zone.
  const start = { x: roadX, y: H + 10 };
  const corner = { x: roadX, y: roadY };
  const end = { x: gym.x - 34, y: roadY };

  const move = useRef(new Animated.Value(0)).current;
  const arrived = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const ping = Animated.loop(Animated.timing(pulse, { toValue: 1, duration: 1800, easing: Easing.out(Easing.quad), useNativeDriver: true }));
    const story = Animated.loop(Animated.sequence([
      Animated.parallel([
        Animated.timing(move, { toValue: 0, duration: 0, useNativeDriver: true }),
        Animated.timing(arrived, { toValue: 0, duration: 0, useNativeDriver: true }),
      ]),
      Animated.delay(400),
      Animated.timing(move, { toValue: 1, duration: 2600, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }),
      Animated.timing(arrived, { toValue: 1, duration: 420, easing: EASE, useNativeDriver: true }),
      Animated.delay(2200),
      Animated.timing(arrived, { toValue: 0, duration: 320, useNativeDriver: true }),
    ]));
    ping.start();
    story.start();
    return () => { ping.stop(); story.stop(); };
  }, [move, arrived, pulse]);

  const AV = 40;
  const tx = move.interpolate({ inputRange: [0, 0.45, 1], outputRange: [start.x - AV / 2, corner.x - AV / 2, end.x - AV / 2] });
  const ty = move.interpolate({ inputRange: [0, 0.45, 1], outputRange: [start.y - AV / 2, corner.y - AV / 2, end.y - AV / 2] });
  const ringScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1.35] });
  const ringOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.55, 0] });
  const zoneGlow = arrived.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });
  const cardY = arrived.interpolate({ inputRange: [0, 1], outputRange: [-24, 0] });

  return (
    <View style={[{ width: W, height: H, overflow: 'hidden', backgroundColor: '#0e0e0e' }, !fullBleed && { borderRadius: 28, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' }]}
      accessible accessibilityLabel="Illustration : quand tu arrives à ta salle, ton cercle proche est prévenu">
      {/* Pâtés de maisons : quelques rectangles un peu plus clairs que le fond. */}
      {[
        [0.04, 0.06, 0.2, 0.42], [0.04, 0.72, 0.2, 0.26], [0.34, 0.04, 0.22, 0.2], [0.34, 0.72, 0.28, 0.3],
        [0.82, 0.04, 0.16, 0.26], [0.82, 0.74, 0.16, 0.24], [0.6, 0.04, 0.18, 0.16],
      ].map(([x, y, w, h], i) => (
        <View key={i} style={{ position: 'absolute', left: W * x, top: H * y, width: W * w, height: H * h, borderRadius: 8, backgroundColor: '#151515' }} />
      ))}
      {/* Rues */}
      <View style={{ position: 'absolute', left: roadX - 7, top: 0, bottom: 0, width: 14, backgroundColor: '#242424' }} />
      <View style={{ position: 'absolute', top: roadY - 7, left: 0, right: 0, height: 14, backgroundColor: '#242424' }} />
      <View style={{ position: 'absolute', left: W * 0.45, top: -40, width: 10, height: H + 80, backgroundColor: '#1d1d1d', transform: [{ rotate: '32deg' }] }} />
      <View style={{ position: 'absolute', top: 54, left: 0, right: 0, height: 8, backgroundColor: '#1b1b1b' }} />
      {/* Marquage au centre de la rue horizontale */}
      <View style={{ position: 'absolute', top: roadY - 0.5, left: 0, right: 0, height: 1, borderStyle: 'dashed', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.12)' }} />

      {/* Zone de détection de la salle : un disque, un anneau qui pulse, et le disque s'éclaire à l'arrivée. */}
      <View style={{ position: 'absolute', left: gym.x - R, top: gym.y - R, width: R * 2, height: R * 2, borderRadius: R, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)' }} />
      <Animated.View style={{ position: 'absolute', left: gym.x - R, top: gym.y - R, width: R * 2, height: R * 2, borderRadius: R, backgroundColor: 'rgba(255,255,255,0.14)', opacity: zoneGlow }} />
      <Animated.View style={{ position: 'absolute', left: gym.x - R, top: gym.y - R, width: R * 2, height: R * 2, borderRadius: R, borderWidth: 2, borderColor: '#fff', opacity: ringOpacity, transform: [{ scale: ringScale }] }} />

      {/* La salle */}
      <View style={{ position: 'absolute', left: gym.x - 22, top: gym.y - 22, width: 44, height: 44, borderRadius: 22, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', shadowColor: '#fff', shadowOpacity: 0.35, shadowRadius: 12 }}>
        <Ionicons name="barbell" size={22} color="#000" />
      </View>
      <View style={{ position: 'absolute', left: gym.x - 50, top: gym.y - 52, width: 100, alignItems: 'center' }}>
        <View style={{ backgroundColor: 'rgba(10,10,10,0.72)', borderRadius: 10, paddingHorizontal: 9, paddingVertical: 3, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' }}>
          <Text style={{ color: '#fff', fontSize: 11, fontFamily: F.bold }}>Ma salle</Text>
        </View>
      </View>

      {/* Toi, qui arrives */}
      <Animated.View style={{ position: 'absolute', left: 0, top: 0, width: AV, height: AV, borderRadius: AV / 2, borderWidth: 2.5, borderColor: '#fff', backgroundColor: '#2a2a2a', overflow: 'hidden', alignItems: 'center', justifyContent: 'center', transform: [{ translateX: tx }, { translateY: ty }] }}>
        {avatar ? <Image source={{ uri: avatar }} style={{ width: AV, height: AV }} /> : <Ionicons name="person" size={20} color="rgba(255,255,255,0.75)" />}
      </Animated.View>

      {/* À l'arrivée : la notification du cercle proche. */}
      <Animated.View pointerEvents="none" style={{ position: 'absolute', left: fullBleed ? 16 : 12, right: fullBleed ? 16 : 12, top: cardTop, opacity: arrived, transform: [{ translateY: cardY }] }}>
        <GlassSurface radius={20} variant="regular" tintColor="rgba(255,255,255,0.08)" style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 11, paddingHorizontal: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)' }}>
          <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="location" size={16} color="#000" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: '#fff', fontSize: 13.5, fontFamily: F.bold }} numberOfLines={1}>Tu es arrivé à ta salle</Text>
            <Text style={{ color: 'rgba(255,255,255,0.65)', fontSize: 12, fontFamily: F.regular, marginTop: 1 }} numberOfLines={1}>Ton cercle proche est prévenu</Text>
          </View>
          <View style={{ flexDirection: 'row' }}>
            {circle.slice(0, 3).map((src, i) => (
              <Image key={i} source={src} style={{ width: 24, height: 24, borderRadius: 12, borderWidth: 1.5, borderColor: '#111', marginLeft: i ? -8 : 0 }} />
            ))}
          </View>
        </GlassSurface>
      </Animated.View>


    </View>
  );
}

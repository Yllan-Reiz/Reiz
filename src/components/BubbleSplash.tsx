import { memo, useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, Image, StatusBar, Animated, PanResponder, Easing, AccessibilityInfo,
  useWindowDimensions, ImageSourcePropType, StyleSheet, Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SocialAuthButtons } from './SocialAuthButtons';
import { s, F } from '../styles';
import { t } from '../i18n';

// Accueil « bulles » (essai du 07/11/2026, inspiré d'un écran de connexion vu sur Instagram).
// Des bulles irisées montent sur un fond chaud : visages du cercle, mots de l'app, bulles vides.
// Le doigt les pousse, un tap en éclate une (elle repart d'en bas). L'écran s'ouvre par un flou qui se dissipe.
// Tout tourne avec Animated + PanResponder (aucun module natif ajouté), donc publiable par `eas update`.
// Interrupteur : BUBBLE_SPLASH dans src/constants.ts (false = l'ancien accueil avec le logo).

const FACES = {
  lea: require('../../assets/onboarding/lea.jpg'),
  tom: require('../../assets/onboarding/tom.jpg'),
  sam: require('../../assets/onboarding/sam.jpg'),
  c1: require('../../assets/onboarding/cercle-1.jpg'),
  c2: require('../../assets/onboarding/cercle-2.jpg'),
  c3: require('../../assets/onboarding/cercle-3.jpg'),
  c4: require('../../assets/onboarding/cercle-4.jpg'),
};

type Kind = 'glass' | 'face' | 'word';
type Spec = { kind: Kind; r: number; src?: ImageSourcePropType; word?: string; tint?: string };
type Bubble = Spec & {
  x: number; y: number; vx: number; vy: number; phase: number; dead: boolean;
  tx: Animated.Value; ty: Animated.Value; pop: Animated.Value;
};

// Ordre = ordre d'affichage : les petites bulles derrière, les gros visages devant.
function specs(words: string[]): Spec[] {
  const glass = ['#ffd6f5', '#bdf2ff', '#fff2b8', '#d9c6ff', '#ffffff'];
  return [
    ...[9, 13, 7, 17, 11, 21, 8, 15].map((r, i) => ({ kind: 'glass' as const, r, tint: glass[i % glass.length] })),
    { kind: 'face', r: 26, src: FACES.c1 }, { kind: 'face', r: 22, src: FACES.c4 }, { kind: 'face', r: 19, src: FACES.lea },
    { kind: 'face', r: 23, src: FACES.sam }, { kind: 'face', r: 17, src: FACES.tom }, { kind: 'face', r: 16, src: FACES.c2 },
    { kind: 'face', r: 28, src: FACES.c3 },
    ...words.map(word => ({ kind: 'word' as const, r: 35, word })),
    { kind: 'face', r: 44, src: FACES.c2 }, { kind: 'face', r: 40, src: FACES.sam }, { kind: 'face', r: 48, src: FACES.tom },
    { kind: 'face', r: 52, src: FACES.c3 }, { kind: 'face', r: 58, src: FACES.lea },
  ];
}

const IRIS = ['#ffc4ef', '#9fe9ff', '#fff4a8', '#c8a8ff', '#ffb59a', '#ffc4ef'] as const;
const AnimatedBlur = Animated.createAnimatedComponent(BlurView);

export function BubbleSplash({ onStart, onLogin }: { onStart: () => void; onLogin: () => void }) {
  const { width: W, height: H } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const k = Math.min(1.15, Math.max(0.8, W / 402)); // tailles calées sur un iPhone 17 Pro
  const words = [t('bubbles.word1'), t('bubbles.word2'), t('bubbles.word3')];

  const bubbles = useMemo<Bubble[]>(() => {
    const list = specs(words).map(sp => {
      const r = sp.r * k;
      const x = r + Math.random() * (W - 2 * r);
      const y = H * 0.06 + Math.random() * H * 1.0;
      return { ...sp, r, x, y, vx: 0, vy: 0, phase: Math.random() * Math.PI * 2, dead: false,
        tx: new Animated.Value(0), ty: new Animated.Value(0), pop: new Animated.Value(0) };
    });
    // Écarte les bulles qui se chevauchent au départ, pour un écran plein mais propre dès la première image.
    for (let it = 0; it < 40; it++) separate(list, 1);
    list.forEach(b => { b.tx.setValue(b.x - b.r); b.ty.setValue(b.y - b.r); });
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [W, H]);

  const finger = useRef({ active: false, x: 0, y: 0, vx: 0, vy: 0 });
  const grantAt = useRef(0);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [introDone, setIntroDone] = useState(false);

  // Ouverture : le flou se dissipe, le titre monte, les boutons arrivent.
  const blur = useRef(new Animated.Value(90)).current;
  const titleIn = useRef(new Animated.Value(0)).current;
  const ctaIn = useRef(new Animated.Value(0)).current;
  const spin = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion).catch(() => {});
    Animated.timing(blur, { toValue: 0, duration: 1300, delay: 150, easing: Easing.out(Easing.cubic), useNativeDriver: false })
      .start(() => setIntroDone(true));
    Animated.timing(titleIn, { toValue: 1, duration: 700, delay: 550, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    Animated.timing(ctaIn, { toValue: 1, duration: 600, delay: 850, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    Animated.loop(Animated.timing(spin, { toValue: 1, duration: 7000, easing: Easing.linear, useNativeDriver: true })).start();
  }, [blur, titleIn, ctaIn, spin]);

  // Rattache les positions au moteur natif : une animation native nulle suffit, ensuite setValue y va directement.
  useEffect(() => {
    bubbles.forEach(b => {
      Animated.timing(b.tx, { toValue: b.x - b.r, duration: 0, useNativeDriver: true }).start();
      Animated.timing(b.ty, { toValue: b.y - b.r, duration: 0, useNativeDriver: true }).start();
    });
  }, [bubbles]);

  // Boucle physique : montée lente qui ondule, poussée du doigt, bulles qui se repoussent entre elles.
  useEffect(() => {
    if (reduceMotion) return;
    let raf = 0;
    let last = 0;
    let time = 0;
    const tick = (now: number) => {
      const dt = last ? Math.min(0.05, (now - last) / 1000) : 0.016;
      last = now; time += dt;
      const f = finger.current;
      const ease = Math.min(1, dt * 1.3);
      for (const b of bubbles) {
        if (b.dead) continue;
        const rise = -(30 + 42 * (1 - Math.min(1, b.r / (60 * k)))) * k;
        const sway = Math.sin(time * 0.7 + b.phase) * 9 * k;
        b.vx += (sway - b.vx) * ease;
        b.vy += (rise - b.vy) * ease;
        if (f.active) {
          const dx = b.x - f.x, dy = b.y - f.y;
          const d = Math.hypot(dx, dy);
          const reach = b.r + 64 * k;
          if (d < reach && d > 0.01) {
            const p = (reach - d) / reach;
            b.vx += (dx / d) * p * 2600 * dt + f.vx * p * 0.06;
            b.vy += (dy / d) * p * 2600 * dt + f.vy * p * 0.06;
          }
        }
      }
      separate(bubbles, 0.6);
      for (const b of bubbles) {
        if (b.dead) continue;
        const sp = Math.hypot(b.vx, b.vy);
        if (sp > 900) { b.vx *= 900 / sp; b.vy *= 900 / sp; }
        b.x += b.vx * dt; b.y += b.vy * dt;
        if (b.x < b.r) { b.x = b.r; b.vx = Math.abs(b.vx) * 0.5; }
        if (b.x > W - b.r) { b.x = W - b.r; b.vx = -Math.abs(b.vx) * 0.5; }
        if (b.y > H + b.r + 140) { b.y = H + b.r + 140; b.vy = Math.min(b.vy, 0); }
        if (b.y < -b.r - 12) respawn(b, W, H);
        place(b);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [bubbles, reduceMotion, W, H, k]);

  const popAt = (x: number, y: number) => {
    for (let i = bubbles.length - 1; i >= 0; i--) {
      const b = bubbles[i];
      if (b.dead || Math.hypot(b.x - x, b.y - y) > b.r + 6) continue;
      b.dead = true;
      Haptics.impactAsync(b.r > 30 * k ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      Animated.timing(b.pop, { toValue: 1, duration: 190, easing: Easing.out(Easing.quad), useNativeDriver: true }).start(() => {
        respawn(b, W, H);
        place(b);
        b.pop.setValue(0);
        b.dead = false;
      });
      return;
    }
  };

  const pan = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: e => {
      grantAt.current = Date.now();
      finger.current = { active: true, x: e.nativeEvent.pageX, y: e.nativeEvent.pageY, vx: 0, vy: 0 };
    },
    onPanResponderMove: (e, g) => {
      finger.current = { active: true, x: e.nativeEvent.pageX, y: e.nativeEvent.pageY, vx: g.vx * 1000, vy: g.vy * 1000 };
    },
    onPanResponderRelease: (_e, g) => {
      finger.current.active = false;
      if (Math.hypot(g.dx, g.dy) < 8 && Date.now() - grantAt.current < 300) popAt(g.x0, g.y0);
    },
    onPanResponderTerminate: () => { finger.current.active = false; },
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [bubbles]);

  const rotate = useMemo(() => spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }), [spin]);
  const rotateBack = useMemo(() => spin.interpolate({ inputRange: [0, 1], outputRange: ['360deg', '0deg'] }), [spin]);
  const rise = (v: Animated.Value) => [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }];

  return (
    <View style={{ flex: 1, backgroundColor: '#0a0a0a' }}>
      <StatusBar barStyle="light-content" />
      <LinearGradient
        colors={['#ffb27a', '#ff7a45', '#f0463c', '#a3203a', '#3a0b18', '#0a0a0a']}
        locations={[0, 0.22, 0.48, 0.7, 0.86, 1]}
        style={StyleSheet.absoluteFill}
      />

      {/* Titre derrière les bulles, comme sur la vidéo : elles passent devant le texte. */}
      <Animated.View pointerEvents="none" style={{ position: 'absolute', top: insets.top + 28, left: 24, right: 24, opacity: titleIn, transform: rise(titleIn) }}>
        <Image source={require('../../assets/ecriture-reiz-blanc.png')} style={{ width: 112, height: 39, marginLeft: -6, marginBottom: 10 }} resizeMode="contain" />
        <Text style={st.title}>{t('bubbles.title')}</Text>
        <Text style={st.titleItalic}>{t('bubbles.titleItalic')}</Text>
        <Text style={st.sub}>{t('bubbles.sub')}</Text>
      </Animated.View>

      <View style={StyleSheet.absoluteFill} {...pan.panHandlers}>
        {bubbles.map((b, i) => (
          <BubbleView key={i} b={b} rotate={i % 2 ? rotate : rotateBack} />
        ))}
      </View>

      {/* Fondu vers le noir sous les boutons : les bulles naissent dans l'ombre. */}
      <LinearGradient pointerEvents="none" colors={['rgba(10,10,10,0)', 'rgba(10,10,10,0.9)', '#0a0a0a', '#0a0a0a']} locations={[0, 0.2, 0.3, 1]}
        style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 360 + insets.bottom }} />

      <Animated.View style={{ position: 'absolute', left: 24, right: 24, bottom: insets.bottom + 16, opacity: ctaIn, transform: rise(ctaIn) }}>
        <TouchableOpacity style={s.btn} onPress={onStart} activeOpacity={0.85}>
          <Text style={s.btnText}>{t('auth.start')}</Text>
        </TouchableOpacity>
        <SocialAuthButtons />
        <TouchableOpacity style={{ marginTop: 12, paddingVertical: 10, alignItems: 'center' }} onPress={onLogin}>
          <Text style={s.splashLogin}>{t('auth.haveAccount')} <Text style={s.splashLoginLink}>{t('auth.signIn')}</Text></Text>
        </TouchableOpacity>
      </Animated.View>

      {!introDone && !reduceMotion && (
        <AnimatedBlur pointerEvents="none" intensity={blur} tint="dark" style={StyleSheet.absoluteFill} />
      )}
    </View>
  );
}

// Mémorisé : la vue ne se redessine jamais par React, la boucle la déplace par le moteur natif (place).
const BubbleView = memo(function BubbleView({ b, rotate }: { b: Bubble; rotate: Animated.AnimatedInterpolation<string> }) {
  const d = b.r * 2;
  const ring = Math.max(1.5, b.r * 0.07);
  const scale = b.pop.interpolate({ inputRange: [0, 1], outputRange: [1, 1.4] });
  const opacity = b.pop.interpolate({ inputRange: [0, 0.4, 1], outputRange: [1, 0.8, 0] });
  const round = { width: d, height: d, borderRadius: b.r };
  return (
    <Animated.View pointerEvents="none" style={[st.abs, round, { transform: [{ translateX: b.tx }, { translateY: b.ty }] }]}>
      <Animated.View style={[round, { opacity, transform: [{ scale }] }]}>
        {b.kind === 'glass' ? (
          <View style={[round, { borderWidth: 1, borderColor: b.tint + 'b0', backgroundColor: b.tint + '18' }]} />
        ) : (
          <>
            <Animated.View style={[st.abs, round, { overflow: 'hidden', transform: [{ rotate }] }]}>
              <LinearGradient colors={IRIS} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={round} />
            </Animated.View>
            {b.kind === 'face' ? (
              <Image source={b.src!} style={{ position: 'absolute', left: ring, top: ring, width: d - ring * 2, height: d - ring * 2, borderRadius: b.r - ring }} />
            ) : (
              <View style={{ position: 'absolute', left: ring, top: ring, width: d - ring * 2, height: d - ring * 2, borderRadius: b.r - ring, backgroundColor: '#2a0c16', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 }}>
                <Text style={st.word} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>{b.word}</Text>
              </View>
            )}
          </>
        )}
        {/* Reflet de savon en haut à gauche. */}
        <View style={{ position: 'absolute', left: b.r * 0.3, top: b.r * 0.22, width: b.r * 0.55, height: b.r * 0.24, borderRadius: b.r, backgroundColor: 'rgba(255,255,255,0.55)', transform: [{ rotate: '-32deg' }] }} />
      </Animated.View>
    </Animated.View>
  );
});

// Les valeurs tx/ty sont rattachées au moteur d'animation natif (voir l'effet « native » plus haut) : chaque setValue
// part droit à l'écran, sans repasser par React ni recalculer la mise en page. 22 bulles tiennent ainsi 60 images/s.
function place(b: Bubble) {
  b.tx.setValue(b.x - b.r);
  b.ty.setValue(b.y - b.r);
}

function respawn(b: Bubble, W: number, H: number) {
  b.x = b.r + Math.random() * (W - 2 * b.r);
  b.y = H + b.r + Math.random() * H * 0.2; // retour étalé : pas de vagues de bulles toutes ensemble
  b.vx = 0; b.vy = 0;
}

// Les bulles se repoussent : la plus grosse bouge moins que la petite.
function separate(list: Bubble[], bounce: number) {
  for (let i = 0; i < list.length; i++) {
    const a = list[i];
    if (a.dead) continue;
    for (let j = i + 1; j < list.length; j++) {
      const c = list[j];
      if (c.dead) continue;
      const dx = c.x - a.x, dy = c.y - a.y;
      const min = a.r + c.r + 3;
      const d2 = dx * dx + dy * dy;
      if (d2 >= min * min) continue;
      const d = Math.sqrt(d2) || 0.01;
      const nx = dx / d, ny = dy / d;
      const ma = a.r * a.r, mc = c.r * c.r;
      const shareA = mc / (ma + mc);
      const o = min - d;
      a.x -= nx * o * shareA; a.y -= ny * o * shareA;
      c.x += nx * o * (1 - shareA); c.y += ny * o * (1 - shareA);
      const rv = (c.vx - a.vx) * nx + (c.vy - a.vy) * ny;
      if (rv < 0) {
        const imp = rv * bounce;
        a.vx += nx * imp * shareA; a.vy += ny * imp * shareA;
        c.vx -= nx * imp * (1 - shareA); c.vy -= ny * imp * (1 - shareA);
      }
    }
  }
}

const SERIF = Platform.select({ ios: 'Georgia', default: 'serif' });
const st = StyleSheet.create({
  abs: { position: 'absolute', left: 0, top: 0 },
  title: { fontFamily: F.black, fontSize: 40, lineHeight: 44, color: '#fff', letterSpacing: -1 },
  titleItalic: { fontFamily: SERIF, fontStyle: 'italic', fontSize: 42, lineHeight: 48, color: '#fff', letterSpacing: -0.5 },
  sub: { fontFamily: F.semibold, fontSize: 15, lineHeight: 21, color: 'rgba(255,255,255,0.85)', marginTop: 10, maxWidth: 300 },
  word: { fontFamily: F.extrabold, fontSize: 11, letterSpacing: 1.2, color: '#fff' },
});

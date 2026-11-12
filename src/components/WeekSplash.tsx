import { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, Image, StatusBar, Animated, Easing, AccessibilityInfo, useWindowDimensions, StyleSheet, ImageSourcePropType } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SocialAuthButtons } from './SocialAuthButtons';
import { GlassCard } from './GlassSurface';
import type { ParsedGoal } from '../lib/sentence';
import { goalTitle } from '../lib/createGoal';
import { DAY_LETTERS } from '../constants';
import { s, F } from '../styles';
import { t } from '../i18n';

// Accueil « la semaine du cercle » (12/11/2026). Remplace l'accueil à bulles orange, qui n'avait rien de la DA.
// Ici tout vient de l'app : fond noir, blanc, Inter, carte en verre, pastilles L M M J V S D de « Ton cercle cette
// semaine ». L'écran montre le concept au lieu de le raconter : trois amis remplissent leur semaine, chacun à son
// rythme, la semaine se valide quand le compte y est. La dernière ligne, vide, c'est toi.
// Rien ne bloque : tout est lisible et touchable dès la première image (pas de flou d'ouverture).
// Interrupteur : WEEK_SPLASH dans src/constants.ts (false = l'accueil à bulles ou le logo seul, selon BUBBLE_SPLASH).

type Friend = { name: string; face: ImageSourcePropType; goal: ParsedGoal; hits: number[] };

// Les jours (0 = lundi) où chacun valide une séance. Tous finissent leur semaine, pas le même jour.
const demo = (activity: string, perWeek: number): ParsedGoal => ({ kind: 'rhythm', activity, category: activity, emoji: '', text: '', perWeek });
const FRIENDS: Friend[] = [
  { name: 'Léa', face: require('../../assets/onboarding/lea.jpg'), goal: demo('running', 2), hits: [1, 4] },
  { name: 'Tom', face: require('../../assets/onboarding/tom.jpg'), goal: demo('musculation', 3), hits: [0, 2, 5] },
  { name: 'Sam', face: require('../../assets/onboarding/sam.jpg'), goal: demo('sport', 3), hits: [2, 4, 6] },
];

const STEP_MS = 750; // un jour de la semaine
const HOLD = 4; // la semaine pleine reste affichée ce nombre de pas, puis repart à lundi

function Dot({ letter, hit, today }: { letter: string; hit: boolean; today: boolean }) {
  const pop = useRef(new Animated.Value(1)).current;
  const was = useRef(hit);
  useEffect(() => {
    if (hit && !was.current) {
      pop.setValue(0.55);
      Animated.spring(pop, { toValue: 1, friction: 5, tension: 220, useNativeDriver: true }).start();
    }
    was.current = hit;
  }, [hit, pop]);
  return (
    <Animated.View style={[st.dot, hit && st.dotHit, today && !hit && st.dotToday, { transform: [{ scale: pop }] }]}>
      <Text style={{ color: hit ? '#000' : today ? '#fff' : 'rgba(255,255,255,0.45)', fontSize: 9, fontFamily: F.extrabold }}>{letter}</Text>
    </Animated.View>
  );
}

function Row({ name, goal, face, hits, quota, day, me }: { name: string; goal: string; face?: ImageSourcePropType; hits: number[]; quota: number; day: number; me?: boolean }) {
  const done = hits.filter(h => h < day).length;
  const valid = !me && done >= quota;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      {face
        ? <Image source={face} style={st.face} />
        : <View style={[st.face, st.faceMe]}><Ionicons name="add" size={20} color="#fff" /></View>}
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
          <Text style={{ color: '#fff', fontSize: 15, fontFamily: F.bold }} maxFontSizeMultiplier={1.2}>{name}</Text>
          <Text style={{ flex: 1, color: 'rgba(255,255,255,0.55)', fontSize: 13, fontFamily: F.regular }} numberOfLines={1} maxFontSizeMultiplier={1.2}>{goal}</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 7 }}>
          <View style={{ flexDirection: 'row', gap: 5 }}>
            {DAY_LETTERS.map((l, i) => <Dot key={i} letter={l} hit={hits.includes(i) && i < day} today={i === day} />)}
          </View>
          {/* Hauteur fixe : la carte ne bouge pas d'un pixel quand le compte devient une coche. */}
          <View style={{ height: 22, minWidth: 40, alignItems: 'flex-end', justifyContent: 'center' }}>
            {valid ? (
              <View style={st.valid}>
                <Ionicons name="checkmark" size={13} color="#000" />
              </View>
            ) : (
              <Text style={{ color: '#fff', fontSize: 14, lineHeight: 18, fontFamily: F.extrabold }} maxFontSizeMultiplier={1.2}>
                {done}<Text style={{ color: 'rgba(255,255,255,0.5)', fontFamily: F.semibold }}>{` / ${quota}`}</Text>
              </Text>
            )}
          </View>
        </View>
      </View>
    </View>
  );
}

export function WeekSplash({ onStart, onLogin }: { onStart: () => void; onLogin: () => void }) {
  const { height: H } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  // Petits écrans : une ligne d'ami en moins, puis le sous-titre en moins.
  const friends = H < 760 ? FRIENDS.slice(0, 2) : FRIENDS;
  const compact = H < 690;

  // Le « jour » de la démonstration : 0 = lundi matin, 7 = dimanche soir. On part de mercredi pour que la carte
  // soit déjà vivante à la première image.
  const [day, setDay] = useState(3);
  const [still, setStill] = useState(false);
  const tick = useRef(3);
  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled().then(v => { if (alive && v) { setStill(true); setDay(7); } }).catch(() => {});
    return () => { alive = false; };
  }, []);
  useEffect(() => {
    if (still) return;
    const id = setInterval(() => {
      tick.current = tick.current >= 7 + HOLD ? 0 : tick.current + 1;
      setDay(Math.min(7, tick.current));
    }, STEP_MS);
    return () => clearInterval(id);
  }, [still]);

  // La carte se pose en un quart de seconde. Le titre et les boutons sont là tout de suite.
  const cardIn = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(cardIn, { toValue: 1, duration: 280, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [cardIn]);

  const allValid = friends.every(f => f.hits.filter(h => h < day).length >= (f.goal.perWeek || 1));

  return (
    <View style={{ flex: 1, backgroundColor: '#0a0a0a', paddingTop: insets.top + 20, paddingBottom: insets.bottom + 16, paddingHorizontal: 24 }}>
      <StatusBar barStyle="light-content" />
      {/* Une lueur grise en haut, pour que le verre de la carte ait quelque chose à attraper. */}
      <LinearGradient pointerEvents="none" colors={['#1d1d1d', '#0a0a0a']} style={[StyleSheet.absoluteFill, { bottom: '50%' }]} />

      <View>
        <Image source={require('../../assets/ecriture-reiz-blanc.png')} style={{ width: 112, height: 39, marginLeft: -6, marginBottom: 12 }} resizeMode="contain" />
        <Text style={st.title} maxFontSizeMultiplier={1.15}>{t('bubbles.title')}</Text>
        <Text style={[st.title, { color: 'rgba(255,255,255,0.55)' }]} maxFontSizeMultiplier={1.15}>{t('bubbles.titleItalic')}</Text>
        {!compact && <Text style={st.sub} maxFontSizeMultiplier={1.2}>{t('bubbles.sub')}</Text>}
      </View>

      <View style={{ flex: 1, justifyContent: 'center', paddingVertical: 12 }}>
        <Animated.View style={{ opacity: cardIn, transform: [{ translateY: cardIn.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }] }}>
          <GlassCard radius={28}>
            <View style={{ padding: 16, gap: 14 }} accessible accessibilityLabel={`${t('rhythm.title')}. ${t('bubbles.sub')}`}>
              {/* Dimanche soir, tout le monde y est : le titre de la carte devient « Semaine validée ». */}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, height: 14 }}>
                <Ionicons name={allValid ? 'checkmark-circle' : 'pulse'} size={13} color={allValid ? '#fff' : 'rgba(255,255,255,0.55)'} />
                <Text style={[st.label, allValid && { color: '#fff' }]} numberOfLines={1} maxFontSizeMultiplier={1.2}>
                  {allValid ? t('profileSec.weekDone').toUpperCase() : t('rhythm.title')}
                </Text>
              </View>
              {friends.map(f => (
                <Row key={f.name} name={f.name} goal={goalTitle(f.goal)} face={f.face} hits={f.hits} quota={f.goal.perWeek || 1} day={day} />
              ))}
              <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.12)' }} />
              <Row name={t('common.you')} goal={t('quick.objTitle')} hits={[]} quota={3} day={day} me />
            </View>
          </GlassCard>
        </Animated.View>
      </View>

      <View>
        <TouchableOpacity style={s.btn} onPress={onStart} activeOpacity={0.85} accessibilityRole="button">
          <Text style={s.btnText}>{t('auth.start')}</Text>
        </TouchableOpacity>
        <SocialAuthButtons />
        <TouchableOpacity style={{ marginTop: 12, paddingVertical: 10, alignItems: 'center' }} onPress={onLogin} accessibilityRole="button">
          <Text style={s.splashLogin}>{t('auth.haveAccount')} <Text style={s.splashLoginLink}>{t('auth.signIn')}</Text></Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  title: { fontFamily: F.black, fontSize: 38, lineHeight: 42, color: '#fff', letterSpacing: -1 },
  sub: { fontFamily: F.regular, fontSize: 15, lineHeight: 21, color: 'rgba(255,255,255,0.7)', marginTop: 12, maxWidth: 310 },
  label: { color: 'rgba(255,255,255,0.55)', fontSize: 10, fontFamily: F.bold, letterSpacing: 1.5 },
  face: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#222' },
  faceMe: { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.6)', borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' },
  dot: { width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  dotHit: { backgroundColor: '#fff' },
  dotToday: { borderWidth: 1.5, borderColor: '#fff' },
  valid: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
});

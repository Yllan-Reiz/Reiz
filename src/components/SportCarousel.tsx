import { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, Pressable, Animated, FlatList, StyleSheet, useWindowDimensions, NativeScrollEvent, NativeSyntheticEvent, ImageSourcePropType } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { ALL_DAYS } from '../constants';
import { F } from '../styles';
import { t, dirIcon } from '../i18n';

// Choix de la discipline, à l'accueil : une grande photo par sport, plein écran, qu'on fait défiler au doigt.
// La discipline choisie sert ensuite à préremplir le premier objectif (nom, unité, but, jours).
// Photos : Unsplash, licence libre (assets/sports/CREDITS.md).

export type Sport = {
  id: string;
  name: string;
  description: string;
  photo: ImageSourcePropType;
  /** Pour l'objectif créé ensuite : l'icône reste en base, elle n'est pas montrée dans l'accueil. */
  emoji: string;
  /** Nom proposé pour l'objectif ('' = la personne le donne : « Autre »). */
  title: string;
  unit: string;
  target: number;
  step: number;
  days: number[];
  /** Les trois profils de l'accueil (Tranquille, Régulier, À fond) : séances par semaine et durée, propres au sport.
   *  Le nom de l'objectif vient de i18n : sports.<id>.pace_<profil>. */
  paces: Record<'easy' | 'regular' | 'hard', { per: number; weeks: number }>;
};

const P = (e: [number, number], r: [number, number], h: [number, number]) => ({ easy: { per: e[0], weeks: e[1] }, regular: { per: r[0], weeks: r[1] }, hard: { per: h[0], weeks: h[1] } });

export const SPORTS: Sport[] = [
  { id: 'musculation', name: t('sports.musculation.name'), description: t('sports.musculation.description'), photo: require('../../assets/sports/musculation.jpg'), emoji: '🏋️', title: t('sports.musculation.title'), unit: 'séances', target: 12, step: 1, days: [1, 3, 5] , paces: P([2, 4], [3, 8], [5, 12]) },
  { id: 'street-workout', name: t('sports.street-workout.name'), description: t('sports.street-workout.description'), photo: require('../../assets/sports/street-workout.jpg'), emoji: '🤸', title: t('sports.street-workout.title'), unit: 'séances', target: 12, step: 1, days: [2, 4, 6] , paces: P([2, 4], [3, 8], [5, 12]) },
  { id: 'hyrox', name: t('sports.hyrox.name'), description: t('sports.hyrox.description'), photo: require('../../assets/sports/hyrox.jpg'), emoji: '🛷', title: t('sports.hyrox.title'), unit: 'séances', target: 16, step: 1, days: [1, 3, 5, 6] , paces: P([2, 4], [4, 8], [5, 12]) },
  { id: 'running', name: t('sports.running.name'), description: t('sports.running.description'), photo: require('../../assets/sports/running.jpg'), emoji: '🏃', title: t('sports.running.title'), unit: 'séances', target: 12, step: 1, days: [2, 4, 6] , paces: P([2, 4], [3, 8], [4, 12]) },
  { id: 'cyclisme', name: t('sports.cyclisme.name'), description: t('sports.cyclisme.description'), photo: require('../../assets/sports/cyclisme.jpg'), emoji: '🚴', title: t('sports.cyclisme.title'), unit: 'séances', target: 8, step: 1, days: [6, 7] , paces: P([1, 4], [2, 8], [4, 12]) },
  { id: 'combat', name: t('sports.combat.name'), description: t('sports.combat.description'), photo: require('../../assets/sports/combat.jpg'), emoji: '🥋', title: t('sports.combat.title'), unit: 'séances', target: 12, step: 1, days: [1, 3, 5] , paces: P([2, 4], [3, 8], [5, 12]) },
  { id: 'natation', name: t('sports.natation.name'), description: t('sports.natation.description'), photo: require('../../assets/sports/natation.jpg'), emoji: '🏊', title: t('sports.natation.title'), unit: 'séances', target: 8, step: 1, days: [2, 5] , paces: P([1, 4], [2, 8], [4, 12]) },
  { id: 'autre', name: t('sports.autre.name'), description: t('sports.autre.description'), photo: require('../../assets/sports/autre.jpg'), emoji: '🎯', title: '', unit: 'séances', target: 12, step: 1, days: ALL_DAYS , paces: P([2, 4], [3, 8], [5, 12]) },
];

// Hauteur réservée en bas aux commandes fixes (Continuer, Plus tard), hors encoche.
const CONTROLS_H = 124;

export function SportCarousel({ initialIndex = 0, bottomInset, onContinue, onSkip }: {
  initialIndex?: number;
  bottomInset: number;
  onContinue: (sport: Sport, index: number) => void;
  onSkip: () => void;
}) {
  const { width: W, height: H } = useWindowDimensions();
  const start = Math.max(0, Math.min(SPORTS.length - 1, initialIndex));
  const scrollX = useRef(new Animated.Value(start * W)).current;
  const list = useRef<FlatList<Sport>>(null);
  const [index, setIndex] = useState(start);
  const indexRef = useRef(start);
  // Dès que la personne a touché l'écran, l'animation d'arrivée ne se joue plus.
  const touched = useRef(false);

  // Animation de défilement à l'arrivée : les photos glissent un peu vers la gauche pour montrer
  // le sport suivant, puis reviennent. Une seule fois, et rien si la personne a déjà touché l'écran.
  useEffect(() => {
    if (start >= SPORTS.length - 1) return;
    const t1 = setTimeout(() => { if (!touched.current) list.current?.scrollToOffset({ offset: start * W + W * 0.18, animated: true }); }, 900);
    const t2 = setTimeout(() => { if (!touched.current) list.current?.scrollToOffset({ offset: start * W, animated: true }); }, 1350);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [start, W]);

  // Le sport affiché suit le doigt (changement dès la moitié de l'écran).
  useEffect(() => {
    const id = scrollX.addListener(({ value }) => {
      const i = Math.max(0, Math.min(SPORTS.length - 1, Math.round(value / W)));
      if (i !== indexRef.current) {
        indexRef.current = i;
        setIndex(i);
        Haptics.selectionAsync().catch(() => {});
      }
    });
    return () => scrollX.removeListener(id);
  }, [scrollX, W]);

  const goTo = (i: number) => {
    if (i < 0 || i >= SPORTS.length) return;
    list.current?.scrollToOffset({ offset: i * W, animated: true });
  };

  // Comme les stories : un appui sur la moitié droite de la photo passe au sport suivant, à gauche au précédent.
  const onTap = (x: number) => {
    touched.current = true;
    goTo(indexRef.current + (x > W / 2 ? 1 : -1));
  };

  const onScroll = Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], { useNativeDriver: true });
  const textBottom = CONTROLS_H + bottomInset + 20;

  const renderItem = ({ item, index: i }: { item: Sport; index: number }) => {
    const range = [(i - 1) * W, i * W, (i + 1) * W];
    // Parallaxe : la photo glisse moins vite que la page, et respire légèrement en arrivant.
    const imgX = scrollX.interpolate({ inputRange: range, outputRange: [-W * 0.1, 0, W * 0.1], extrapolate: 'clamp' });
    const imgScale = scrollX.interpolate({ inputRange: range, outputRange: [1.06, 1, 1.06], extrapolate: 'clamp' });
    const textOpacity = scrollX.interpolate({ inputRange: [(i - 0.6) * W, i * W, (i + 0.6) * W], outputRange: [0, 1, 0], extrapolate: 'clamp' });
    const textY = scrollX.interpolate({ inputRange: range, outputRange: [18, 0, 18], extrapolate: 'clamp' });
    return (
      <Pressable onPress={e => onTap(e.nativeEvent.locationX)} style={{ width: W, height: H, overflow: 'hidden' }} accessible accessibilityRole="adjustable" accessibilityLabel={`${item.name}. ${item.description}`}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={e => goTo(indexRef.current + (e.nativeEvent.actionName === 'increment' ? 1 : -1))}>
        <Animated.Image
          source={item.photo}
          fadeDuration={0}
          resizeMode="cover"
          style={{ position: 'absolute', top: 0, left: -W * 0.1, width: W * 1.2, height: H, transform: [{ translateX: imgX }, { scale: imgScale }] }}
        />
        <LinearGradient pointerEvents="none" colors={['rgba(5,5,5,0.78)', 'rgba(5,5,5,0)']} locations={[0, 0.24]} style={StyleSheet.absoluteFill} />
        <LinearGradient pointerEvents="none" colors={['rgba(5,5,5,0)', 'rgba(5,5,5,0.62)', 'rgba(5,5,5,0.95)', '#050505']} locations={[0.3, 0.52, 0.74, 1]} style={StyleSheet.absoluteFill} />
        <Animated.View pointerEvents="none" style={{ position: 'absolute', left: 24, right: 24, bottom: textBottom, opacity: textOpacity, transform: [{ translateY: textY }] }}>
          <Text style={{ color: '#fff', fontSize: 48, lineHeight: 52, fontFamily: F.black, letterSpacing: -1.6 }} numberOfLines={1} adjustsFontSizeToFit>
            {item.name}
          </Text>
          <Text style={{ color: 'rgba(255,255,255,0.72)', fontSize: 16, lineHeight: 23, fontFamily: F.regular, marginTop: 8, maxWidth: 340 }}>
            {item.description}
          </Text>
        </Animated.View>
      </Pressable>
    );
  };

  return (
    <View style={StyleSheet.absoluteFill}>
      <Animated.FlatList
        ref={list as any}
        data={SPORTS}
        keyExtractor={s => s.id}
        renderItem={renderItem}
        horizontal
        pagingEnabled
        bounces={false}
        decelerationRate="fast"
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        initialScrollIndex={start}
        getItemLayout={(_, i) => ({ length: W, offset: W * i, index: i })}
        initialNumToRender={2}
        windowSize={3}
        maxToRenderPerBatch={2}
        onScrollBeginDrag={() => { touched.current = true; }}
        onMomentumScrollEnd={(e: NativeSyntheticEvent<NativeScrollEvent>) => {
          const i = Math.round(e.nativeEvent.contentOffset.x / W);
          if (i !== indexRef.current) { indexRef.current = i; setIndex(i); }
        }}
      />

      {/* Commandes fixes : Continuer, puis Plus tard. */}
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 24, paddingBottom: bottomInset + 14 }} pointerEvents="box-none">
        <TouchableOpacity
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {}); onContinue(SPORTS[index], index); }}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel={t('sports.continueWith', { name: SPORTS[index].name })}
          style={{ backgroundColor: '#fff', borderRadius: 16, minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 }}
        >
          <Text style={{ color: '#000', fontSize: 17, fontFamily: F.extrabold }}>{t('common.continue')}</Text>
          <Ionicons name={dirIcon('arrow-forward')} size={20} color="#000" />
        </TouchableOpacity>
        <TouchableOpacity onPress={onSkip} activeOpacity={0.8} accessibilityRole="button" style={{ paddingVertical: 14, alignItems: 'center' }}>
          <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 15, fontFamily: F.semibold }}>{t('welcome.chooseLater')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

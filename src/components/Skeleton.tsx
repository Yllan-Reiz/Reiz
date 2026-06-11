import { useEffect, useRef } from 'react';
import { View, Animated } from 'react-native';
import { s } from '../styles';

// Bloc gris qui "respire" — remplace les spinners pour un chargement plus doux.
function Pulse({ style }: { style: any }) {
  const opacity = useRef(new Animated.Value(0.5)).current;
  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.5, duration: 700, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, []);
  return <Animated.View style={[s.skeletonBlock, style, { opacity }]} />;
}

export function FeedSkeleton() {
  return (
    <>
      {[0, 1].map(i => (
        <View key={i} style={s.skeletonCard}>
          <Pulse style={{ width: '100%', height: 260, borderRadius: 0 }} />
          <View style={{ padding: 14, gap: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Pulse style={{ width: 40, height: 40, borderRadius: 20 }} />
              <View style={{ gap: 6 }}>
                <Pulse style={{ width: 120, height: 12 }} />
                <Pulse style={{ width: 70, height: 9 }} />
              </View>
            </View>
            <Pulse style={{ width: '85%', height: 11 }} />
          </View>
        </View>
      ))}
    </>
  );
}

export function ProfileSkeleton() {
  return (
    <View style={{ paddingHorizontal: 12, paddingTop: 32 }}>
      <View style={{ alignItems: 'center', gap: 12, marginBottom: 28 }}>
        <Pulse style={{ width: 88, height: 88, borderRadius: 44 }} />
        <Pulse style={{ width: 140, height: 16 }} />
        <Pulse style={{ width: 90, height: 11 }} />
      </View>
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
        {[0, 1, 2].map(i => <Pulse key={i} style={{ flex: 1, height: 70, borderRadius: 18 }} />)}
      </View>
      {[0, 1].map(i => <Pulse key={i} style={{ width: '100%', height: 110, borderRadius: 18, marginBottom: 10 }} />)}
    </View>
  );
}

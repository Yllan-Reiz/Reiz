import { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import * as Haptics from 'expo-haptics';
import { s } from '../styles';
import { UNITS, ITEM_H } from '../constants';

export function WheelPicker({ selected, onSelect }: { selected: string; onSelect: (u: string) => void }) {
  const ref = useRef<ScrollView>(null);
  const lastIdx = useRef<number>(UNITS.indexOf(selected) === -1 ? 0 : UNITS.indexOf(selected));
  const idx = UNITS.indexOf(selected) === -1 ? 0 : UNITS.indexOf(selected);

  // Scroll initial vers l'unité sélectionnée
  useEffect(() => {
    setTimeout(() => ref.current?.scrollTo({ y: idx * ITEM_H, animated: false }), 50);
  }, []);

  const handleSelectFromOffset = (offsetY: number) => {
    const i = Math.round(offsetY / ITEM_H);
    const clamped = Math.max(0, Math.min(i, UNITS.length - 1));
    onSelect(UNITS[clamped]);
  };

  // Vibration "tick" à chaque changement de cran pendant le scroll
  const handleScroll = (offsetY: number) => {
    const i = Math.round(offsetY / ITEM_H);
    const clamped = Math.max(0, Math.min(i, UNITS.length - 1));
    if (clamped !== lastIdx.current) {
      lastIdx.current = clamped;
      Haptics.selectionAsync().catch(() => {});
    }
  };

  return (
    <View style={s.wheelWrap}>
      <View style={s.wheelSelector} pointerEvents="none" />
      <ScrollView
        ref={ref}
        style={s.wheelScroll}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_H}
        decelerationRate="fast"
        nestedScrollEnabled
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingVertical: ITEM_H * 2 }}
        onScroll={e => handleScroll(e.nativeEvent.contentOffset.y)}
        onMomentumScrollEnd={e => handleSelectFromOffset(e.nativeEvent.contentOffset.y)}
        onScrollEndDrag={e => handleSelectFromOffset(e.nativeEvent.contentOffset.y)}
      >
        {UNITS.map((u, i) => (
          <TouchableOpacity
            key={u}
            style={s.wheelItem}
            activeOpacity={0.6}
            onPress={() => {
              Haptics.selectionAsync().catch(() => {});
              onSelect(u);
              ref.current?.scrollTo({ y: i * ITEM_H, animated: true });
            }}
          >
            <Text style={[s.wheelItemText, selected === u && s.wheelItemTextActive]}>{u}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

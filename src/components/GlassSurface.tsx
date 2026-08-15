import { ReactNode } from 'react';
import { View, StyleSheet, Platform, StyleProp, ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';

// « Liquid Glass » d'iOS 26 (expo-glass-effect → UIGlassEffect natif).
// Le module natif n'existe pas partout (Android, web, iOS < 26, anciens builds) :
// on tente le require une seule fois et on retombe sinon sur un verre simulé
// (blur natif + reflet + liseré), qui reste très proche visuellement.
let NativeGlassView: any = null;
let liquid = false;
try {
  const mod = require('expo-glass-effect');
  liquid = typeof mod.isLiquidGlassAvailable === 'function' && mod.isLiquidGlassAvailable();
  NativeGlassView = mod.GlassView;
} catch {
  liquid = false;
}

/** true = verre Apple natif dispo (iOS 26+). Sert aussi à ajuster les couleurs autour. */
export const LIQUID_GLASS = liquid && !!NativeGlassView;

// Sur iOS on prend le matériau système des barres (celui des tab bars Apple),
// sur Android le blur expérimental de expo-blur.
const FALLBACK_TINT = Platform.OS === 'ios' ? 'systemChromeMaterialDark' : 'dark';

export function GlassSurface({
  radius,
  style,
  variant = 'regular',
  tintColor,
  interactive = false,
  intensity = 42,
  pointerEvents,
  children,
}: {
  radius: number;
  style?: StyleProp<ViewStyle>;
  /** 'regular' = verre dépoli (barres), 'clear' = verre net (pastilles par-dessus) */
  variant?: 'regular' | 'clear';
  tintColor?: string;
  /** iOS 26 : le verre se déforme sous le doigt */
  interactive?: boolean;
  intensity?: number;
  pointerEvents?: 'auto' | 'none' | 'box-none' | 'box-only';
  children?: ReactNode;
}) {
  if (LIQUID_GLASS) {
    return (
      <NativeGlassView
        glassEffectStyle={variant}
        tintColor={tintColor}
        isInteractive={interactive}
        colorScheme="dark"
        pointerEvents={pointerEvents}
        style={[{ borderRadius: radius, overflow: 'hidden' }, style]}
      >
        {children}
      </NativeGlassView>
    );
  }

  return (
    <View pointerEvents={pointerEvents} style={[{ borderRadius: radius, overflow: 'hidden' }, style]}>
      <BlurView
        intensity={intensity}
        tint={FALLBACK_TINT as any}
        experimentalBlurMethod={Platform.OS === 'android' ? 'dimezisBlurView' : undefined}
        style={StyleSheet.absoluteFill}
      />
      {/* Reflet spéculaire : la lumière tombe du haut, le bas s'assombrit */}
      <LinearGradient
        colors={['rgba(255,255,255,0.18)', 'rgba(255,255,255,0.04)', 'rgba(0,0,0,0.20)']}
        locations={[0, 0.42, 1]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      {!!tintColor && (
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: tintColor }]} />
      )}
      {/* Liseré de verre : arête claire en haut, quasi invisible en bas */}
      <View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          {
            borderRadius: radius,
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.20)',
            borderBottomColor: 'rgba(255,255,255,0.06)',
          },
        ]}
      />
      {children}
    </View>
  );
}

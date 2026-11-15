import { BlurView } from 'expo-blur';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import type { ReactNode } from 'react';
import { theme } from '../../lib/theme';

const LEVELS = {
  sm: { intensity: 20, bg: theme.colors.glass, border: theme.colors.border },
  md: { intensity: 30, bg: theme.colors.glassMd, border: theme.colors.borderMd },
  strong: { intensity: 40, bg: theme.colors.glassStrong, border: theme.colors.borderStrong },
} as const;

export function GlassCard({
  children,
  style,
  intensity = 'sm',
}: {
  children: ReactNode;
  style?: ViewStyle;
  intensity?: keyof typeof LEVELS;
}) {
  const level = LEVELS[intensity];
  return (
    <View style={[styles.wrap, { borderColor: level.border }, style]}>
      <BlurView intensity={level.intensity} tint="dark" style={StyleSheet.absoluteFill} />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: level.bg }]} />
      <View style={styles.content}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { borderRadius: theme.radius, borderWidth: 1, overflow: 'hidden' },
  content: { padding: 16 },
});

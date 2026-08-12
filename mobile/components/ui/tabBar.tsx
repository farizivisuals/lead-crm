import { BlurView } from 'expo-blur';
import { StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { ComponentProps } from 'react';
import { Tabs } from 'expo-router';
import { theme } from '../../lib/theme';

type TabsScreenOptions = ComponentProps<typeof Tabs>['screenOptions'];

/**
 * Floating pill tab bar: transparent blur fill, hairline border, inset from
 * the screen edges, with the native shift transition between tab scenes.
 */
export function usePillTabOptions(): TabsScreenOptions {
  const insets = useSafeAreaInsets();
  return {
    headerShown: false,
    animation: 'shift',
    tabBarActiveTintColor: theme.colors.accent,
    tabBarInactiveTintColor: theme.text.dim,
    tabBarStyle: {
      position: 'absolute',
      marginHorizontal: 16,
      marginBottom: Math.max(insets.bottom, 16),
      height: 72,
      borderRadius: 36,
      overflow: 'hidden',
      borderTopWidth: 0,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.colors.borderStrong,
      backgroundColor: 'transparent',
    },
    tabBarItemStyle: { paddingTop: 10, paddingBottom: 8 },
    tabBarLabelStyle: { fontSize: 10, fontWeight: '600', marginTop: 2 },
    tabBarBackground: () => (
      // The opaque-ish fill is what makes the bar readable: expo-blur is a
      // no-op on Android, so blur alone leaves it fully transparent.
      <BlurView
        intensity={40}
        tint="dark"
        style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(8,9,13,0.82)' }]}
      />
    ),
  };
}

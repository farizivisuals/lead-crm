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
      height: 64,
      borderRadius: 32,
      overflow: 'hidden',
      borderTopWidth: 0,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.colors.borderStrong,
      backgroundColor: 'transparent',
    },
    tabBarItemStyle: { paddingVertical: 6 },
    tabBarLabelStyle: { fontSize: 10, fontWeight: '600' },
    tabBarBackground: () => (
      <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
    ),
  };
}

import { BlurView } from 'expo-blur';
import { StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMemo, type ComponentProps } from 'react';
import { Tabs } from 'expo-router';
import { theme } from '../../lib/theme';

type TabsScreenOptions = ComponentProps<typeof Tabs>['screenOptions'];

// Defined once at module scope. Inlining this as an arrow inside the options
// object gave it a new identity on every render, which remounted the tab bar
// background and re-rendered the navigator along with it.
function renderTabBarBackground() {
  return (
    // The opaque-ish fill is what makes the bar readable: expo-blur is a
    // no-op on Android, so blur alone leaves it fully transparent.
    <BlurView
      intensity={40}
      tint="dark"
      style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(8,9,13,0.82)' }]}
    />
  );
}

/**
 * Floating pill tab bar: transparent blur fill, hairline border, inset from
 * the screen edges.
 *
 * The options object is memoised on purpose. It used to be rebuilt on every
 * render, so the navigator saw fresh `screenOptions` constantly — and
 * `useSafeAreaInsets()` guarantees at least one change right after mount, just
 * as the user makes their first tab switch. Combined with the `shift`
 * animation that churn could interrupt a transition and leave the incoming
 * scene parked off-screen: the tab bar updated, but the page never painted.
 */
export function usePillTabOptions(): TabsScreenOptions {
  const insets = useSafeAreaInsets();
  const bottom = Math.max(insets.bottom, 16);

  return useMemo(
    () => ({
      headerShown: false,
      // No transition. `shift` was the animation that could strand a scene,
      // and an instant switch is the safer behaviour for a tab bar.
      animation: 'none' as const,
      tabBarActiveTintColor: theme.colors.accent,
      tabBarInactiveTintColor: theme.text.dim,
      tabBarStyle: {
        position: 'absolute' as const,
        marginHorizontal: 16,
        marginBottom: bottom,
        height: 72,
        borderRadius: 36,
        overflow: 'hidden' as const,
        borderTopWidth: 0,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: theme.colors.borderStrong,
        backgroundColor: 'transparent',
      },
      tabBarItemStyle: { paddingTop: 10, paddingBottom: 8 },
      tabBarLabelStyle: { fontSize: 10, fontWeight: '600' as const, marginTop: 2 },
      tabBarBackground: renderTabBarBackground,
    }),
    [bottom]
  );
}

import { useEffect } from 'react';
import { ActivityIndicator, View, StyleSheet } from 'react-native';
import { Stack, useRouter, usePathname } from 'expo-router';
import { QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as Notifications from 'expo-notifications';
import { queryClient } from '../lib/query-client';
import { routeForNotification } from '../lib/push';
import { AuthProvider, useAuth } from '../lib/auth';
import { resolveRoute } from '../lib/routing';
import { theme } from '../lib/theme';

export function SessionGate() {
  const { session, profile, loading, recoveryChecked, recovering } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  // Computed unconditionally (not after the loading early-return below) so the
  // navigation effect can depend on it without breaking the rules of hooks.
  const target = resolveRoute({
    hasSession: !!session,
    userType: profile?.user_type ?? null,
    recovering,
  });

  // Warm-path fix: when a recovery link arrives while the (auth) group isn't
  // mounted (e.g. the user is already signed in), expo-router 56 drops the
  // link outright — see node_modules/expo-router/build/fork/useLinking.native.js
  // (a link whose root route isn't in the current `routeNames` is discarded)
  // and build/useScreens.js (Stack.Protected excludes guarded-out screens from
  // that list). `recovering` still flips true and the guard below mounts
  // (auth) — but expo-router's sortRoutes (build/sortRoutes.js) then defaults
  // an unrouted group to its shortest-named screen, `login`, not
  // `update-password`. Once (auth) is actually on screen — `pathname` reads
  // `/login` — push it to the right place ourselves.
  //
  // Guarded on `pathname` itself, so this can't loop: after the replace,
  // `pathname` becomes `/update-password` and the condition goes false. Cold
  // start is unaffected — there, the initial navigation state is built
  // straight from the deep link and already resolves to `/update-password`,
  // so `pathname` is never `/login` in the first place.
  useEffect(() => {
    if (recovering && pathname === '/login') {
      router.replace('/update-password');
    }
  }, [recovering, pathname, router]);

  // Deep-link a tapped push notification. Only attached once a session exists,
  // because every destination sits behind a Stack.Protected guard — navigating
  // there while signed out would be dropped, exactly like the recovery-link
  // case above. Keyed on `session` presence rather than the user id: the
  // listener is identity-agnostic, so a token refresh must not re-subscribe.
  useEffect(() => {
    if (!session) return;
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as {
        entity_type?: string;
        entity_id?: string;
      };
      const route = routeForNotification(data?.entity_type, data?.entity_id);
      if (route) router.push(route as never);
    });
    return () => sub.remove();
  }, [!!session, router]);

  // `target` can't be *used* until useAuth() resolves — keep the loading
  // early-return so we never render Stack.Protected guards with a stale target.
  // `recoveryChecked` must hold this gate too: getSession() + the profile
  // fetch can resolve before the initial deep-link check does, and without
  // this an already-signed-in user tapping a recovery link would flash their
  // real dashboard for a frame before `recovering` catches up.
  if (loading || !recoveryChecked) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color="#fff" />
      </View>
    );
  }

  // Declarative guards: the screen for a false guard is excluded during state
  // resolution, so the wrong shell never mounts, not even for one frame. This
  // replaces the old useEffect + router.replace redirect, which ran after
  // commit and could paint a frame of the wrong user type's shell first.
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.colors.background } }}>
      <Stack.Protected guard={target === '/login'}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
      <Stack.Protected guard={target === '/(employee)/dashboard'}>
        <Stack.Screen name="(employee)" />
      </Stack.Protected>
      <Stack.Protected guard={target === '/(client)'}>
        <Stack.Screen name="(client)" />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <StatusBar style="light" />
          <SessionGate />
        </AuthProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    backgroundColor: theme.colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

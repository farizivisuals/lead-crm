import { useEffect } from 'react';
import { ActivityIndicator, View, StyleSheet } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider, useAuth } from '../lib/auth';
import { resolveRoute } from '../lib/routing';
import { theme } from '../lib/theme';

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
});

function SessionGate() {
  const { session, profile, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    const target = resolveRoute({
      hasSession: !!session,
      userType: profile?.user_type ?? null,
    });

    const group = segments[0];
    const inAuth = group === '(auth)' || group === undefined;

    if (target === '/login') {
      if (!inAuth) {
        // @ts-expect-error — route literal not in the generated Href union until Task 5 adds (auth)/login
        router.replace('/login');
      }
      return;
    }
    // Only redirect on a group mismatch, so in-group navigation isn't stomped.
    const wantedGroup = target === '/(client)' ? '(client)' : '(employee)';
    if (group !== wantedGroup) {
      // @ts-expect-error — route literal not in the generated Href union until Task 7 adds (employee)/dashboard and (client)
      router.replace(target);
    }
  }, [loading, session, profile, segments, router]);

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color="#fff" />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.colors.background } }}>
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(employee)" />
      <Stack.Screen name="(client)" />
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

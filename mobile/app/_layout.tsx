import { ActivityIndicator, View, StyleSheet } from 'react-native';
import { Stack } from 'expo-router';
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
  const { session, profile, loading, recovering } = useAuth();

  // `target` can't be computed until useAuth() resolves — keep the loading
  // early-return so we never render Stack.Protected guards with a stale target.
  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color="#fff" />
      </View>
    );
  }

  const target = resolveRoute({
    hasSession: !!session,
    userType: profile?.user_type ?? null,
    recovering,
  });

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

import { QueryClient } from '@tanstack/react-query';

/**
 * The app's one QueryClient. It was always a module-scoped singleton (it lived
 * in app/_layout.tsx); it lives here so non-render code can reach it — auth.tsx
 * must clear the whole cache on sign-out, and pulling that in via
 * useQueryClient() would force every test that renders AuthProvider to stand up
 * a QueryClientProvider it otherwise has no use for.
 *
 * ponytail: no focusManager/onlineManager wiring. TanStack's default focus
 * listener binds `visibilitychange`, which never fires under React Native, and
 * Expo Router keeps tab screens mounted so `refetchOnMount` never re-runs —
 * explicit invalidation (see lib/queries/keys.ts) is the only refresh path.
 * Wire focusManager to AppState if background staleness ever bites app-wide.
 */
export const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
});

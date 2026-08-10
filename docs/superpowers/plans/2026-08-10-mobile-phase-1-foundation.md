# Lead CRM Mobile — Phase 1: Foundation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A running Expo iOS app that authenticates against the existing Supabase project and routes an employee to an employee tab shell and a client to a client tab shell.

**Architecture:** An Expo SDK 56 app in `mobile/`, talking directly to Supabase with the anon key under existing RLS. No backend. Expo Router file-based routing mirrors the web app's `(admin)`/`(portal)` split as `(employee)`/`(client)` route groups, with a session gate in the root layout deciding which group to enter.

**Tech Stack:** Expo SDK 56 · Expo Router · `@supabase/supabase-js` · `expo-sqlite` (session storage) · `expo-blur` · `expo-linear-gradient` · TanStack Query · Jest (`jest-expo`)

**Spec:** `docs/superpowers/specs/2026-08-10-mobile-app-design.md`

## Global Constraints

- **Never import or reference `SUPABASE_SERVICE_ROLE_KEY`, `lib/supabase/admin.ts`, or `createAdminClient` anywhere under `mobile/`.** A leak there is total database compromise.
- Target **iOS only** for now. Do not add Android-specific config (adaptive icon, FCM, notification channels). Keep all code cross-platform so Android remains a later build target.
- **Dark theme only.** No light-mode values, no `useColorScheme` branching.
- Canvas colour is exactly `#06060a`. Border radius is `12`.
- Env vars must use the `EXPO_PUBLIC_` prefix to be readable at runtime.
- Point at the **same Supabase project** as the web app — no separate project, no new migrations in this phase.
- Role gating in the UI must use the shared `isExecutive()` from `lib/rbac.ts`, never a hand-rolled role check.
- Testing is deliberately minimal per spec §12: one runnable check per piece of non-trivial logic. Do not write render tests for screens.

---

### Task 1: Scaffold the Expo app and wire the Supabase client

**Files:**
- Create: `mobile/` (via `create-expo-app`)
- Create: `mobile/lib/supabase.ts`
- Create: `mobile/.env`
- Create: `mobile/.env.example`
- Modify: `.gitignore` (repo root)

**Interfaces:**
- Consumes: nothing
- Produces: `supabase` — a configured `SupabaseClient` exported from `mobile/lib/supabase.ts`, used by every later task.

- [ ] **Step 1: Scaffold the project**

Run from the repo root:

```bash
npx create-expo-app@latest mobile --template default@sdk-56
```

- [ ] **Step 2: Fix the root .gitignore so mobile deps aren't committed**

The existing `/node_modules` pattern is anchored to the repo root, so `mobile/node_modules` would NOT be ignored. Open `.gitignore` and change the `# dependencies` block's first line from `/node_modules` to:

```
node_modules
```

Unanchored, it matches at any depth. The existing `.env*` pattern is already unanchored, so `mobile/.env` is covered.

- [ ] **Step 3: Install runtime dependencies**

```bash
cd mobile && npx expo install @supabase/supabase-js react-native-url-polyfill expo-sqlite expo-blur expo-linear-gradient expo-linking expo-symbols react-native-safe-area-context @tanstack/react-query
```

`react-native-url-polyfill` is required by the client in Step 5. `expo-symbols`,
`expo-linking` and `react-native-safe-area-context` are used in Tasks 5–7; some
ship with the template already, in which case `expo install` is a no-op for them.

- [ ] **Step 4: Create the env files**

`mobile/.env.example` (committed):

```
EXPO_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
```

`mobile/.env` (git-ignored) — copy the **same two values** from the repo-root `.env.local`. Copy only these two. Do not copy `SUPABASE_SERVICE_ROLE_KEY`.

- [ ] **Step 5: Write the Supabase client**

`mobile/lib/supabase.ts`:

```ts
import 'react-native-url-polyfill/auto';
import 'expo-sqlite/localStorage/install';
import { AppState } from 'react-native';
import { createClient } from '@supabase/supabase-js';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error(
    'Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY. Copy mobile/.env.example to mobile/.env and fill it in.'
  );
}

export const supabase = createClient(url, anonKey, {
  auth: {
    storage: localStorage,
    autoRefreshToken: true,
    persistSession: true,
    // No URL-based session detection on native — deep links are handled explicitly.
    detectSessionInUrl: false,
  },
});

// Realtime subscriptions go stale after the app is backgrounded (spec §10).
AppState.addEventListener('change', (state) => {
  if (state === 'active' && !supabase.realtime.isConnected()) {
    supabase.realtime.connect();
  }
});
```

- [ ] **Step 6: Verify the app boots**

```bash
cd mobile && npx expo start --clear
```

Expected: Metro starts and the default template renders in the iOS simulator with no red screen. A red screen naming the missing env var means Step 4 was skipped.

- [ ] **Step 7: Commit**

```bash
git add .gitignore mobile
git commit -m "feat(mobile): scaffold Expo SDK 56 app with Supabase client"
```

---

### Task 2: Port the design tokens and build the glass primitives

**Files:**
- Create: `mobile/lib/theme.ts`
- Create: `mobile/components/ui/Screen.tsx`
- Create: `mobile/components/ui/GlassCard.tsx`
- Create: `mobile/components/ui/Button.tsx`
- Create: `mobile/components/ui/Input.tsx`

**Interfaces:**
- Consumes: nothing
- Produces:
  - `theme` — `{ colors, radius, spacing, text }` from `mobile/lib/theme.ts`
  - `<Screen>` — full-bleed `#06060a` background with ambient gradients and safe-area padding. Props: `{ children: ReactNode }`
  - `<GlassCard>` — blurred translucent surface. Props: `{ children: ReactNode; style?: ViewStyle; intensity?: 'sm' | 'md' | 'strong' }`
  - `<Button>` — Props: `{ title: string; onPress: () => void; loading?: boolean; disabled?: boolean; variant?: 'primary' | 'ghost' }`
  - `<Input>` — Props: `{ label: string; value: string; onChangeText: (t: string) => void; placeholder?: string; secureTextEntry?: boolean; autoComplete?: string; keyboardType?: string }`

- [ ] **Step 1: Write the theme**

Values ported from `app/globals.css`. The HSL tokens there are converted to hex here.

`mobile/lib/theme.ts`:

```ts
export const theme = {
  colors: {
    background: '#06060a',
    foreground: 'rgba(255,255,255,0.9)',
    muted: '#27272A',            // hsl(240 4% 16%)
    mutedForeground: '#878792',  // hsl(240 5% 55%)
    destructive: '#DC2828',      // hsl(0 72% 51%)
    border: 'rgba(255,255,255,0.08)',
    glass: 'rgba(255,255,255,0.04)',
    glassMd: 'rgba(255,255,255,0.06)',
    glassStrong: 'rgba(255,255,255,0.08)',
    borderMd: 'rgba(255,255,255,0.10)',
    borderStrong: 'rgba(255,255,255,0.12)',
  },
  radius: 12,
  spacing: (n: number) => n * 4,
  text: {
    dim: 'rgba(255,255,255,0.4)',
    dimmer: 'rgba(255,255,255,0.25)',
    label: 'rgba(255,255,255,0.6)',
  },
} as const;

// Department colours — mirrors DEPT_COLORS in lib/rbac.ts
export const DEPT_COLORS: Record<string, string> = {
  video: '#6366f1',
  photo: '#ec4899',
  pr: '#f59e0b',
  creatives: '#7c3aed',
};
```

- [ ] **Step 2: Write the Screen wrapper**

The web uses `body::after` radial gradients for ambience. `expo-linear-gradient` has no radial mode, so two large soft linear gradients approximate it. The noise overlay from `globals.css` is **deferred to Phase 6 polish** — it needs a tiled PNG asset and contributes almost nothing at phone scale.

`mobile/components/ui/Screen.tsx`:

```tsx
import { View, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { ReactNode } from 'react';
import { theme } from '../../lib/theme';

export function Screen({ children }: { children: ReactNode }) {
  return (
    <View style={styles.root}>
      <LinearGradient
        colors={['rgba(255,255,255,0.04)', 'transparent']}
        style={StyleSheet.absoluteFill}
        start={{ x: 0.2, y: 0 }}
        end={{ x: 0.8, y: 0.6 }}
        pointerEvents="none"
      />
      <SafeAreaView style={styles.safe}>{children}</SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.background },
  safe: { flex: 1 },
});
```

- [ ] **Step 3: Write GlassCard**

```tsx
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
```

- [ ] **Step 4: Write Button**

Primary matches the web's white gradient pill (`from-white to-zinc-100`, dark text).

```tsx
import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import { theme } from '../../lib/theme';

export function Button({
  title,
  onPress,
  loading = false,
  disabled = false,
  variant = 'primary',
}: {
  title: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: 'primary' | 'ghost';
}) {
  const isPrimary = variant === 'primary';
  const off = disabled || loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={off}
      style={({ pressed }) => [
        styles.base,
        isPrimary ? styles.primary : styles.ghost,
        off && styles.off,
        pressed && !off && styles.pressed,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={isPrimary ? '#18181b' : '#fff'} />
      ) : (
        <Text style={[styles.text, isPrimary ? styles.primaryText : styles.ghostText]}>{title}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { height: 44, borderRadius: theme.radius, alignItems: 'center', justifyContent: 'center' },
  primary: { backgroundColor: '#fafafa' },
  ghost: { backgroundColor: 'transparent', borderWidth: 1, borderColor: theme.colors.border },
  off: { opacity: 0.5 },
  pressed: { transform: [{ scale: 0.98 }] },
  text: { fontSize: 14, fontWeight: '600' },
  primaryText: { color: '#18181b' },
  ghostText: { color: theme.colors.foreground },
});
```

- [ ] **Step 5: Write Input**

```tsx
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { theme } from '../../lib/theme';

export function Input({
  label,
  value,
  onChangeText,
  placeholder,
  secureTextEntry,
  autoComplete,
  keyboardType,
}: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
  autoComplete?: any;
  keyboardType?: any;
}) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.text.dimmer}
        secureTextEntry={secureTextEntry}
        autoComplete={autoComplete}
        keyboardType={keyboardType}
        autoCapitalize="none"
        style={styles.input}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  label: {
    fontSize: 11,
    fontWeight: '500',
    color: theme.text.label,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  input: {
    height: 44,
    borderRadius: theme.radius,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: 'rgba(255,255,255,0.05)',
    paddingHorizontal: 14,
    fontSize: 14,
    color: '#fff',
  },
});
```

- [ ] **Step 6: Commit**

```bash
git add mobile/lib/theme.ts mobile/components/ui
git commit -m "feat(mobile): port design tokens and glass UI primitives"
```

---

### Task 3: Session routing logic (the one unit test in this phase)

This is the only genuinely branchy logic in Phase 1, and spec §12 names it explicitly. Extracting it as a pure function keeps it testable without rendering anything.

**Files:**
- Create: `mobile/lib/routing.ts`
- Test: `mobile/lib/__tests__/routing.test.ts`
- Modify: `mobile/package.json`

**Interfaces:**
- Consumes: nothing
- Produces: `resolveRoute(input: { hasSession: boolean; userType: 'employee' | 'client' | null }): '/login' | '/(employee)/dashboard' | '/(client)'`

- [ ] **Step 1: Install the test runner**

```bash
cd mobile && npx expo install jest-expo jest @types/jest --dev
```

`expo install` (rather than plain `npm install`) picks the `jest-expo` version
matching SDK 56; a mismatched version fails to transform Expo modules.

Then add to `mobile/package.json`:

```json
"scripts": {
  "test": "jest"
},
"jest": {
  "preset": "jest-expo"
}
```

(Keep the existing `scripts` entries the template created; add `test` alongside them.)

- [ ] **Step 2: Write the failing test**

`mobile/lib/__tests__/routing.test.ts`:

```ts
import { resolveRoute } from '../routing';

describe('resolveRoute', () => {
  it('sends a signed-out user to login', () => {
    expect(resolveRoute({ hasSession: false, userType: null })).toBe('/login');
  });

  it('sends an employee to the employee dashboard', () => {
    expect(resolveRoute({ hasSession: true, userType: 'employee' })).toBe('/(employee)/dashboard');
  });

  it('sends a client to the client portal', () => {
    expect(resolveRoute({ hasSession: true, userType: 'client' })).toBe('/(client)');
  });

  it('sends a session with no resolvable profile back to login', () => {
    // Profile row missing or unreadable — treat as unauthenticated rather than
    // guessing a route, so the user gets a clean retry instead of an empty shell.
    expect(resolveRoute({ hasSession: true, userType: null })).toBe('/login');
  });

  it('ignores a stale userType when the session is gone', () => {
    expect(resolveRoute({ hasSession: false, userType: 'employee' })).toBe('/login');
  });
});
```

- [ ] **Step 3: Run the test and confirm it fails**

```bash
cd mobile && npm test
```

Expected: FAIL — `Cannot find module '../routing'`.

- [ ] **Step 4: Implement**

`mobile/lib/routing.ts`:

```ts
export type UserType = 'employee' | 'client';

export type Route = '/login' | '/(employee)/dashboard' | '/(client)';

export function resolveRoute(input: {
  hasSession: boolean;
  userType: UserType | null;
}): Route {
  if (!input.hasSession) return '/login';
  if (input.userType === 'client') return '/(client)';
  if (input.userType === 'employee') return '/(employee)/dashboard';
  return '/login';
}
```

- [ ] **Step 5: Run the test and confirm it passes**

```bash
cd mobile && npm test
```

Expected: PASS, 5 tests.

- [ ] **Step 6: Commit**

```bash
git add mobile/lib/routing.ts mobile/lib/__tests__ mobile/package.json
git commit -m "feat(mobile): add session route resolution with tests"
```

---

### Task 4: Auth provider and root layout session gate

**Files:**
- Create: `mobile/lib/auth.tsx`
- Replace: `mobile/app/_layout.tsx`
- Delete: whatever demo routes the template created under `mobile/app/` (`(tabs)/`, `modal.tsx`, `+not-found.tsx` — keep `+not-found.tsx` if present)

**Interfaces:**
- Consumes: `supabase` (Task 1), `resolveRoute` (Task 3), `Screen` (Task 2)
- Produces:
  - `<AuthProvider>` — wraps the app
  - `useAuth(): { session: Session | null; profile: { id: string; full_name: string; user_type: UserType } | null; employee: { role: EmployeeRole } | null; loading: boolean; signOut: () => Promise<void> }`

- [ ] **Step 1: Write the auth provider**

`mobile/lib/auth.tsx`:

```tsx
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';
import type { UserType } from './routing';

type EmployeeRole = 'root' | 'ceo' | 'cfo' | 'manager' | 'employee';

type Profile = { id: string; full_name: string; user_type: UserType };
type EmployeeRow = { role: EmployeeRole };

type AuthValue = {
  session: Session | null;
  profile: Profile | null;
  employee: EmployeeRow | null;
  loading: boolean;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [employee, setEmployee] = useState<EmployeeRow | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!session?.user) {
        setProfile(null);
        setEmployee(null);
        setLoading(false);
        return;
      }
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name, user_type, employees(role)')
        .eq('id', session.user.id)
        .single();

      if (cancelled) return;

      if (!data) {
        setProfile(null);
        setEmployee(null);
      } else {
        const { employees, ...rest } = data as any;
        setProfile(rest as Profile);
        // `employees` is embedded via a PK foreign key, so Supabase may return
        // it as an object or a single-element array. Normalise for either.
        setEmployee(Array.isArray(employees) ? (employees[0] ?? null) : (employees ?? null));
      }
      setLoading(false);
    }

    setLoading(true);
    load();
    return () => {
      cancelled = true;
    };
    // Keyed on the user id, NOT the whole session object. Supabase fires
    // TOKEN_REFRESHED with a fresh session object roughly hourly and on
    // app-foreground for the same user; keying on `session` would re-run this
    // effect, flip `loading`, and remount the root navigator in SessionGate —
    // wiping the user's tab, pushed screens and form input mid-session.
  }, [session?.user?.id]);

  async function signOut() {
    await supabase.auth.signOut();
  }

  return (
    <AuthContext.Provider value={{ session, profile, employee, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
```

- [ ] **Step 2: Remove the template's demo routes**

```bash
cd mobile && rm -rf app/\(tabs\) app/modal.tsx
```

If either path doesn't exist, that's fine — the template layout varies.

- [ ] **Step 3: Write the root layout**

`mobile/app/_layout.tsx`:

```tsx
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
    // Do NOT fold `group === undefined` in here. An unmatched route is not the
    // same as "already in the auth group": on cold boot to a bare `/`, segments
    // is empty, and treating that as in-auth suppresses the redirect — the user
    // gets a 404 today, and once (client)/index.tsx resolves `/`, a logged-out
    // user or an employee renders a frame of the CLIENT portal before being
    // bounced. Leaking another user type's shell is worse than either.
    const inAuth = group === '(auth)';

    if (target === '/login') {
      if (!inAuth) router.replace('/login');
      return;
    }
    // Only redirect on a group mismatch, so in-group navigation isn't stomped.
    const wantedGroup = target === '/(client)' ? '(client)' : '(employee)';
    if (group !== wantedGroup) router.replace(target);
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
```

- [ ] **Step 4: Confirm it compiles**

```bash
cd mobile && npx tsc --noEmit
```

Expected: no errors. The app will red-screen on missing routes until Task 5 and Task 7 land — that is expected at this step.

- [ ] **Step 5: Commit**

```bash
git add mobile/lib/auth.tsx mobile/app
git commit -m "feat(mobile): add auth provider and root session gate"
```

---

### Task 5: Login screen

Ports `app/(auth)/login/page.tsx`. The two-column desktop layout and the animated `AbstractVisual` are dropped — they exist only at `lg:` breakpoints on the web and have no phone equivalent. The mobile branch of that page (centred logo + glass card) is what carries over.

**Files:**
- Create: `mobile/app/(auth)/_layout.tsx`
- Create: `mobile/app/(auth)/login.tsx`
- Create: `mobile/assets/logo.png` (copied from `public/logo.png`)

**Interfaces:**
- Consumes: `supabase` (Task 1), `Screen` / `GlassCard` / `Button` / `Input` (Task 2)
- Produces: the `/login` route. Navigation after sign-in is handled by the Task 4 session gate — this screen must NOT navigate itself.

- [ ] **Step 1: Copy the logo asset**

```bash
cp "public/logo.png" mobile/assets/logo.png
```

- [ ] **Step 2: Write the auth group layout**

`mobile/app/(auth)/_layout.tsx`:

```tsx
import { Stack } from 'expo-router';
import { theme } from '../../lib/theme';

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.colors.background },
      }}
    />
  );
}
```

- [ ] **Step 3: Write the login screen**

`mobile/app/(auth)/login.tsx`:

```tsx
import { useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Link } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { Screen } from '../../components/ui/Screen';
import { GlassCard } from '../../components/ui/GlassCard';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { theme } from '../../lib/theme';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLogin() {
    setLoading(true);
    setError(null);
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }
    // No navigation here — the root session gate routes by user_type once the
    // auth state change lands. Leave `loading` true so the button stays busy
    // through the transition.
  }

  return (
    <Screen>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <Image
              source={require('../../assets/logo.png')}
              style={styles.logo}
              resizeMode="contain"
            />
            <Text style={styles.tagline}>Marketing Agency CRM</Text>
          </View>

          <GlassCard style={styles.card}>
            <Text style={styles.title}>Welcome back</Text>
            <Text style={styles.subtitle}>Sign in to your workspace</Text>

            <View style={styles.form}>
              <Input
                label="Email"
                value={email}
                onChangeText={setEmail}
                placeholder="you@agency.com"
                autoComplete="email"
                keyboardType="email-address"
              />
              <Input
                label="Password"
                value={password}
                onChangeText={setPassword}
                placeholder="••••••••"
                secureTextEntry
                autoComplete="current-password"
              />

              {error && (
                <View style={styles.error}>
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              )}

              <Button title="Sign in" onPress={handleLogin} loading={loading} />

              <Link href="/forgot-password" asChild>
                <Pressable style={styles.forgot}>
                  <Text style={styles.forgotText}>Forgot your password?</Text>
                </Pressable>
              </Link>
            </View>
          </GlassCard>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  header: { alignItems: 'center', marginBottom: 32 },
  // The web renders logo.png inverted (it's a dark-on-light source asset).
  // tintColor white is the RN equivalent of `className="invert"`.
  logo: { height: 44, width: 124, opacity: 0.9, tintColor: '#fff' },
  tagline: { color: theme.text.dim, fontSize: 13, marginTop: 8 },
  card: { padding: 24 },
  title: { color: '#fff', fontSize: 22, fontWeight: '700', letterSpacing: -0.5 },
  subtitle: { color: theme.text.dim, fontSize: 13, marginTop: 4 },
  form: { gap: 16, marginTop: 24 },
  error: {
    backgroundColor: 'rgba(220,40,40,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(220,40,40,0.20)',
    borderRadius: theme.radius,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  errorText: { color: '#f87171', fontSize: 13 },
  forgot: { alignItems: 'center', paddingVertical: 4 },
  forgotText: { color: theme.text.dimmer, fontSize: 12 },
});
```

- [ ] **Step 4: Verify by signing in**

```bash
cd mobile && npx expo start --clear
```

In the simulator: sign in with a real employee account from your Supabase project. Expected: the button spins, then the app redirects — it will land on a "route not found" error until Task 7 creates `(employee)/dashboard`. That error **is** the pass condition here; it proves auth and the session gate both fired. Also confirm a wrong password shows the error box.

- [ ] **Step 5: Commit**

```bash
git add mobile/app/\(auth\) mobile/assets/logo.png
git commit -m "feat(mobile): add login screen"
```

---

### Task 6: Forgot-password and update-password screens

**Files:**
- Create: `mobile/app/(auth)/forgot-password.tsx`
- Create: `mobile/app/(auth)/update-password.tsx`
- Modify: `mobile/app.json`

**Interfaces:**
- Consumes: `supabase` (Task 1), UI primitives (Task 2)
- Produces: `/forgot-password` and `/update-password` routes; the `leadcrm` URL scheme.

- [ ] **Step 1: Register the URL scheme**

In `mobile/app.json`, inside the `expo` object, set:

```json
"scheme": "leadcrm"
```

- [ ] **Step 2: Write the forgot-password screen**

`mobile/app/(auth)/forgot-password.tsx`:

```tsx
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import * as Linking from 'expo-linking';
import { supabase } from '../../lib/supabase';
import { Screen } from '../../components/ui/Screen';
import { GlassCard } from '../../components/ui/GlassCard';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { theme } from '../../lib/theme';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleReset() {
    setLoading(true);
    setError(null);
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: Linking.createURL('/update-password'),
    });
    if (resetError) setError(resetError.message);
    else setSent(true);
    setLoading(false);
  }

  return (
    <Screen>
      <View style={styles.wrap}>
        <GlassCard style={styles.card}>
          <Text style={styles.title}>Reset password</Text>
          <Text style={styles.subtitle}>
            {sent
              ? 'If that email is registered, a reset link is on its way.'
              : "Enter your email and we'll send you a reset link."}
          </Text>

          {!sent && (
            <View style={styles.form}>
              <Input
                label="Email"
                value={email}
                onChangeText={setEmail}
                placeholder="you@agency.com"
                autoComplete="email"
                keyboardType="email-address"
              />
              {error && <Text style={styles.errorText}>{error}</Text>}
              <Button title="Send reset link" onPress={handleReset} loading={loading} />
            </View>
          )}

          <View style={styles.back}>
            <Button title="Back to sign in" variant="ghost" onPress={() => router.replace('/login')} />
          </View>
        </GlassCard>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, justifyContent: 'center', padding: 24 },
  card: { padding: 24 },
  title: { color: '#fff', fontSize: 22, fontWeight: '700', letterSpacing: -0.5 },
  subtitle: { color: theme.text.dim, fontSize: 13, marginTop: 4 },
  form: { gap: 16, marginTop: 24 },
  errorText: { color: '#f87171', fontSize: 13 },
  back: { marginTop: 16 },
});
```

Note the message is deliberately identical whether or not the email exists — it must not leak which addresses are registered.

- [ ] **Step 3: Write the update-password screen**

`mobile/app/(auth)/update-password.tsx`:

```tsx
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { supabase } from '../../lib/supabase';
import { Screen } from '../../components/ui/Screen';
import { GlassCard } from '../../components/ui/GlassCard';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { theme } from '../../lib/theme';

export default function UpdatePasswordScreen() {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleUpdate() {
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setLoading(true);
    setError(null);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      setError(updateError.message);
      setLoading(false);
      return;
    }
    // Session gate routes onward once the user record refreshes.
  }

  return (
    <Screen>
      <View style={styles.wrap}>
        <GlassCard style={styles.card}>
          <Text style={styles.title}>Set a new password</Text>
          <Text style={styles.subtitle}>Choose a password for your account.</Text>

          <View style={styles.form}>
            <Input
              label="New password"
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              secureTextEntry
              autoComplete="new-password"
            />
            <Input
              label="Confirm password"
              value={confirm}
              onChangeText={setConfirm}
              placeholder="••••••••"
              secureTextEntry
              autoComplete="new-password"
            />
            {error && <Text style={styles.errorText}>{error}</Text>}
            <Button title="Update password" onPress={handleUpdate} loading={loading} />
          </View>
        </GlassCard>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, justifyContent: 'center', padding: 24 },
  card: { padding: 24 },
  title: { color: '#fff', fontSize: 22, fontWeight: '700', letterSpacing: -0.5 },
  subtitle: { color: theme.text.dim, fontSize: 13, marginTop: 4 },
  form: { gap: 16, marginTop: 24 },
  errorText: { color: '#f87171', fontSize: 13 },
});
```

- [ ] **Step 4: Verify**

```bash
cd mobile && npx tsc --noEmit
```

Expected: no errors. In the simulator, tap "Forgot your password?" from login and confirm the screen renders and submitting shows the confirmation copy.

**Manual follow-up (record it, do not skip):** the deep-link redirect URL printed by `Linking.createURL('/update-password')` must be added to the Supabase dashboard under **Authentication → URL Configuration → Redirect URLs**. Until that's done, the emailed link won't return to the app. Log the exact URL in the commit message.

- [ ] **Step 5: Commit**

```bash
git add mobile/app/\(auth\) mobile/app.json
git commit -m "feat(mobile): add password reset and update screens"
```

---

> **Design amendment (added during execution).** Task 7 must also convert
> `SessionGate` from the imperative `router.replace()`-in-`useEffect` redirect
> shown in Task 4 to Expo Router's declarative `Stack.Protected` guards.
> Reason: `(client)/index.tsx` maps to `/`, so on cold boot a logged-out user
> or an employee resolves to it, mounts it, and paints a frame of the CLIENT
> portal before the effect redirects them — one user type seeing another's
> shell, and a crash risk if that screen assumes a client-shaped profile.
> `useEffect` runs after commit, so no logic inside it can prevent the paint.
> `Stack.Protected` excludes guarded screens during state resolution, so the
> wrong screen never mounts. This also retires both remaining
> `@ts-expect-error` directives in `mobile/app/_layout.tsx`.
> `app/+not-found.tsx` stays — it still catches genuinely bogus deep links.

### Task 7: Employee and client tab shells

Placeholder screens only — each tab renders its title. Real screens land in Phases 2–4. This task's deliverable is that both shells mount and gate correctly by role.

**Files:**
- Create: `mobile/app/(employee)/_layout.tsx`
- Create: `mobile/app/(employee)/dashboard.tsx`, `projects.tsx`, `tasks.tsx`, `calendar.tsx`, `more.tsx`
- Create: `mobile/app/(client)/_layout.tsx`
- Create: `mobile/app/(client)/index.tsx`, `calendar.tsx`, `profile.tsx`
- Create: `mobile/components/ui/Placeholder.tsx`

**Interfaces:**
- Consumes: `useAuth` (Task 4), `Screen` (Task 2), `isExecutive` from the web app's `lib/rbac.ts`
- Produces: `/(employee)/dashboard` and `/(client)` routes, satisfying the Task 3 route targets.

- [ ] **Step 1: Write the placeholder component**

`mobile/components/ui/Placeholder.tsx`:

```tsx
import { StyleSheet, Text, View } from 'react-native';
import { Screen } from './Screen';
import { theme } from '../../lib/theme';

export function Placeholder({ title }: { title: string }) {
  return (
    <Screen>
      <View style={styles.wrap}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.note}>Coming in a later phase.</Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6 },
  title: { color: '#fff', fontSize: 20, fontWeight: '700' },
  note: { color: theme.text.dimmer, fontSize: 13 },
});
```

- [ ] **Step 2: Write the employee tab layout**

Icons use `expo-symbols` (SF Symbols), which the SDK 56 template already depends on. Tab order matches spec §5.

`mobile/app/(employee)/_layout.tsx`:

```tsx
import { Tabs } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { BlurView } from 'expo-blur';
import { StyleSheet } from 'react-native';
import { theme } from '../../lib/theme';

function icon(name: string) {
  return ({ color }: { color: string }) => (
    <SymbolView name={name as any} tintColor={color} size={24} />
  );
}

export default function EmployeeLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#fff',
        tabBarInactiveTintColor: theme.text.dimmer,
        tabBarStyle: { position: 'absolute', borderTopColor: theme.colors.border },
        tabBarBackground: () => (
          <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
        ),
      }}
    >
      <Tabs.Screen name="dashboard" options={{ title: 'Dashboard', tabBarIcon: icon('square.grid.2x2') }} />
      <Tabs.Screen name="projects" options={{ title: 'Projects', tabBarIcon: icon('folder') }} />
      <Tabs.Screen name="tasks" options={{ title: 'Tasks', tabBarIcon: icon('checklist') }} />
      <Tabs.Screen name="calendar" options={{ title: 'Calendar', tabBarIcon: icon('calendar') }} />
      <Tabs.Screen name="more" options={{ title: 'More', tabBarIcon: icon('ellipsis.circle') }} />
    </Tabs>
  );
}
```

- [ ] **Step 3: Write the employee placeholder screens**

Create four files (the fifth tab, `more.tsx`, is Step 4 — it is not a bare
placeholder). Each is two lines, repeated in full rather than abbreviated, since
tasks may be read out of order.

`mobile/app/(employee)/dashboard.tsx`:

```tsx
import { Placeholder } from '../../components/ui/Placeholder';
export default function Dashboard() { return <Placeholder title="Dashboard" />; }
```

`mobile/app/(employee)/projects.tsx`:

```tsx
import { Placeholder } from '../../components/ui/Placeholder';
export default function Projects() { return <Placeholder title="Projects" />; }
```

`mobile/app/(employee)/tasks.tsx`:

```tsx
import { Placeholder } from '../../components/ui/Placeholder';
export default function Tasks() { return <Placeholder title="Tasks" />; }
```

`mobile/app/(employee)/calendar.tsx`:

```tsx
import { Placeholder } from '../../components/ui/Placeholder';
export default function Calendar() { return <Placeholder title="Calendar" />; }
```

- [ ] **Step 4: Write the More screen with role gating and sign-out**

This screen proves role gating works end to end, so it is not a bare placeholder.

`mobile/app/(employee)/more.tsx`:

```tsx
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Screen } from '../../components/ui/Screen';
import { GlassCard } from '../../components/ui/GlassCard';
import { Button } from '../../components/ui/Button';
import { useAuth } from '../../lib/auth';
import { isExecutive, ROLE_LABELS } from '@shared/rbac';
import { theme } from '../../lib/theme';

export default function More() {
  const { profile, employee, signOut } = useAuth();
  const role = employee?.role ?? 'employee';
  const exec = isExecutive(role);

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.heading}>More</Text>

        <GlassCard>
          <Text style={styles.name}>{profile?.full_name ?? '—'}</Text>
          <Text style={styles.role}>{ROLE_LABELS[role]}</Text>
        </GlassCard>

        <GlassCard>
          {exec && <Text style={styles.row}>Clients</Text>}
          {exec && <Text style={styles.row}>Team</Text>}
          {exec && <Text style={styles.row}>Stages</Text>}
          <Text style={styles.row}>Profile</Text>
          <Text style={styles.row}>Notifications</Text>
        </GlassCard>

        <Button title="Sign out" variant="ghost" onPress={signOut} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 20, gap: 16, paddingBottom: 100 },
  heading: { color: '#fff', fontSize: 26, fontWeight: '700', letterSpacing: -0.5 },
  name: { color: '#fff', fontSize: 16, fontWeight: '600' },
  role: { color: theme.text.dim, fontSize: 13, marginTop: 2 },
  row: { color: theme.colors.foreground, fontSize: 15, paddingVertical: 10 },
});
```

- [ ] **Step 5: Wire the `@shared` alias to the web app's lib**

`mobile/metro.config.js`:

```js
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const repoRoot = path.resolve(projectRoot, '..');

const config = getDefaultConfig(projectRoot);

// Share lib/types.ts and lib/rbac.ts with the Next.js app so the role
// hierarchy and status labels cannot drift between web and mobile.
config.watchFolders = [path.resolve(repoRoot, 'lib')];
config.resolver.nodeModulesPaths = [path.resolve(projectRoot, 'node_modules')];
config.resolver.extraNodeModules = {
  '@shared': path.resolve(repoRoot, 'lib'),
  // lib/rbac.ts imports "@/lib/types" (a Next.js alias). Map it here so Metro
  // can resolve the same file without touching the web app.
  '@': repoRoot,
};

module.exports = config;
```

Add matching paths to `mobile/tsconfig.json` under `compilerOptions`:

```json
"paths": {
  "@shared/*": ["../lib/*"],
  "@/*": ["../*"]
}
```

- [ ] **Step 6: Write the client tab layout and screens**

`mobile/app/(client)/_layout.tsx`:

```tsx
import { Tabs } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { BlurView } from 'expo-blur';
import { StyleSheet } from 'react-native';
import { theme } from '../../lib/theme';

function icon(name: string) {
  return ({ color }: { color: string }) => (
    <SymbolView name={name as any} tintColor={color} size={24} />
  );
}

export default function ClientLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#fff',
        tabBarInactiveTintColor: theme.text.dimmer,
        tabBarStyle: { position: 'absolute', borderTopColor: theme.colors.border },
        tabBarBackground: () => (
          <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
        ),
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Projects', tabBarIcon: icon('folder') }} />
      <Tabs.Screen name="calendar" options={{ title: 'Calendar', tabBarIcon: icon('calendar') }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: icon('person.circle') }} />
    </Tabs>
  );
}
```

`mobile/app/(client)/index.tsx`:

```tsx
import { Placeholder } from '../../components/ui/Placeholder';
export default function ClientProjects() { return <Placeholder title="Projects" />; }
```

`mobile/app/(client)/calendar.tsx`:

```tsx
import { Placeholder } from '../../components/ui/Placeholder';
export default function ClientCalendar() { return <Placeholder title="Calendar" />; }
```

`mobile/app/(client)/profile.tsx`:

```tsx
import { ScrollView, StyleSheet, Text } from 'react-native';
import { Screen } from '../../components/ui/Screen';
import { GlassCard } from '../../components/ui/GlassCard';
import { Button } from '../../components/ui/Button';
import { useAuth } from '../../lib/auth';
import { theme } from '../../lib/theme';

export default function ClientProfile() {
  const { profile, session, signOut } = useAuth();
  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.heading}>Profile</Text>
        <GlassCard>
          <Text style={styles.name}>{profile?.full_name ?? '—'}</Text>
          <Text style={styles.email}>{session?.user.email ?? '—'}</Text>
        </GlassCard>
        <Button title="Sign out" variant="ghost" onPress={signOut} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 20, gap: 16, paddingBottom: 100 },
  heading: { color: '#fff', fontSize: 26, fontWeight: '700', letterSpacing: -0.5 },
  name: { color: '#fff', fontSize: 16, fontWeight: '600' },
  email: { color: theme.text.dim, fontSize: 13, marginTop: 2 },
});
```

- [ ] **Step 7: Verify both shells**

```bash
cd mobile && npx tsc --noEmit && npm test && npx expo start --clear
```

In the simulator, verify all four:
1. Sign in as an **executive** employee → employee tabs; More shows Clients, Team and Stages.
2. Sign out, sign in as a **plain employee** (role `employee`) → More hides Clients, Team and Stages.
3. Sign out, sign in as a **client** → client tabs (Projects · Calendar · Profile), no employee tabs reachable.
4. Sign out from either shell → returns to login.

If Metro fails to resolve `@shared/rbac`, do not spend more than 30 minutes on it. Fall back: copy `lib/types.ts` and `lib/rbac.ts` into `mobile/lib/shared/`, change the import to a relative path, revert `metro.config.js` and the `tsconfig.json` paths, and note the duplication in the commit message so Phase 6 can revisit it.

- [ ] **Step 8: Commit**

```bash
git add mobile
git commit -m "feat(mobile): add employee and client tab shells with role gating"
```

---

### Task 8: EAS configuration and first development build

**Files:**
- Create: `mobile/eas.json`
- Modify: `mobile/app.json`

**Interfaces:**
- Consumes: everything above
- Produces: an installable dev-client build — the prerequisite for Phase 5 push work, which cannot run in Expo Go.

- [ ] **Step 1: Set the app identity**

In `mobile/app.json`, inside `expo`, set `name`, `slug`, `scheme` (already set in Task 6), and the iOS bundle identifier:

```json
"name": "Lead CRM",
"slug": "lead-crm",
"scheme": "leadcrm",
"ios": {
  "bundleIdentifier": "com.leadagency.leadcrm",
  "supportsTablet": false
},
"userInterfaceStyle": "dark"
```

Replace `com.leadagency.leadcrm` with the reverse-DNS identifier you want on the App Store. **It cannot be changed after the first submission**, so confirm it with the user before running the build.

- [ ] **Step 2: Write eas.json**

`mobile/eas.json`:

```json
{
  "cli": {
    "version": ">= 16.0.1",
    "appVersionSource": "remote"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "ios": { "simulator": true }
    },
    "preview": {
      "distribution": "internal",
      "ios": { "resourceClass": "m-medium" }
    },
    "production": {
      "autoIncrement": true,
      "ios": { "resourceClass": "m-medium" }
    }
  },
  "submit": {
    "production": {}
  }
}
```

The `submit.production` block is intentionally empty — Apple credentials get filled in during Phase 6, when the App Store Connect record exists.

- [ ] **Step 3: Log in to EAS and initialise the project**

```bash
cd mobile && npx eas-cli login && npx eas-cli init
```

`init` writes `extra.eas.projectId` into `app.json`. Phase 5's push token registration reads that value.

- [ ] **Step 4: Build the simulator dev client**

```bash
cd mobile && npx eas-cli build -p ios --profile development
```

Expected: a cloud build completing in roughly 10–20 minutes, ending with a download URL. Install it in the simulator, then run `npx expo start --dev-client` and confirm sign-in still works against the dev client rather than Expo Go.

- [ ] **Step 5: Commit**

```bash
git add mobile/eas.json mobile/app.json
git commit -m "chore(mobile): add EAS build configuration"
```

---

## Phase 1 Done When

- [ ] `npm test` passes (5 tests in `routing.test.ts`)
- [ ] `npx tsc --noEmit` is clean
- [ ] An executive employee signs in and sees Dashboard · Projects · Tasks · Calendar · More, with Clients/Team/Stages visible under More
- [ ] A plain employee sees the same tabs with Clients/Team/Stages hidden
- [ ] A client signs in and sees Projects · Calendar · Profile
- [ ] Sign-out returns to login from either shell
- [ ] A dev-client build is installed and running
- [ ] `grep -ri "service_role\|createAdminClient" mobile/ --exclude-dir=node_modules` returns nothing

## Carried Into Later Phases

- Noise-texture overlay (Phase 6 polish — needs a tiled PNG asset)
- Geist font via `expo-font` (Phase 6 — system font is fine until the visual pass)
- Supabase redirect-URL allowlist entry for `leadcrm://update-password` (manual dashboard step, recorded in Task 6)
- If the `@shared` alias fell back to copied files, de-duplicate or accept it explicitly (Phase 6)

// Regression test for the reviewer-flagged gap in Fix 3: after a profile-fetch
// failure resets the login button, a REPEAT sign-in attempt must actually
// retry the profile fetch. It didn't: the profile effect in auth.tsx is keyed
// on `session?.user?.id` (deliberately, to survive TOKEN_REFRESHED — see
// auth.session-identity.test.tsx), and signing in again as the same user
// doesn't change that id, so the effect never re-ran and the button spun
// forever with no error on the second attempt.
//
// This exercises the real AuthProvider (not a mocked useAuth) together with
// the real LoginScreen, since the fix spans both — `retryProfile()` in
// auth.tsx and the "retry instead of re-authenticating" branch in
// login.tsx's handleLogin.
import React from 'react';
import { act, create, type ReactTestInstance } from 'react-test-renderer';
import { AuthProvider } from '../../../lib/auth';
import LoginScreen from '../login';

type AuthChangeCb = (event: string, session: any) => void;
let authChangeCb: AuthChangeCb = () => {};

const mockSignInWithPassword = jest.fn(
  (_credentials: { email: string; password: string }): Promise<{ error: { message: string } | null }> =>
    Promise.resolve({ error: null })
);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockProfileSingle = jest.fn((): Promise<{ data: any; error: any }> =>
  Promise.resolve({ data: null, error: { message: 'network error' } })
);

jest.mock('../../../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: jest.fn(() => Promise.resolve({ data: { session: null } })),
      onAuthStateChange: jest.fn((cb: AuthChangeCb) => {
        authChangeCb = cb;
        return { data: { subscription: { unsubscribe: jest.fn() } } };
      }),
      setSession: jest.fn(() => Promise.resolve({ data: { session: null }, error: null })),
      signOut: jest.fn(),
      signInWithPassword: (...args: Parameters<typeof mockSignInWithPassword>) =>
        mockSignInWithPassword(...args),
    },
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: (...args: Parameters<typeof mockProfileSingle>) => mockProfileSingle(...args),
        })),
      })),
    })),
  },
}));

jest.mock('expo-linking', () => ({
  getInitialURL: jest.fn(() => Promise.resolve<string | null>(null)),
  addEventListener: jest.fn(() => ({ remove: jest.fn() })),
}));

jest.mock('expo-router', () => {
  const ReactActual = require('react');
  return {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Link: ({ children }: any) => ReactActual.createElement(ReactActual.Fragment, null, children),
  };
});

function findSignInButton(root: ReactTestInstance) {
  return root.findByProps({ title: 'Sign in' });
}

function makeSession() {
  return { access_token: `tok-${Math.random()}`, user: { id: 'user-1' } };
}

async function flush() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

beforeEach(() => {
  authChangeCb = () => {};
  mockSignInWithPassword.mockClear().mockResolvedValue({ error: null });
  mockProfileSingle.mockReset().mockResolvedValue({
    data: null,
    error: { message: 'network error' },
  });
});

test('fail -> retry -> fail again leaves a usable button both times, and genuinely re-fetches', async () => {
  let renderer!: ReturnType<typeof create>;
  await act(async () => {
    renderer = create(
      <AuthProvider>
        <LoginScreen />
      </AuthProvider>
    );
  });
  await flush();

  // First attempt: sign-in succeeds, profile fetch fails.
  await act(async () => {
    findSignInButton(renderer.root).props.onPress();
  });
  await flush();
  await act(async () => {
    authChangeCb('SIGNED_IN', makeSession());
  });
  await flush();

  expect(mockProfileSingle).toHaveBeenCalledTimes(1);
  expect(findSignInButton(renderer.root).props.loading).toBe(false);
  let texts = renderer.root.findAllByType(require('react-native').Text);
  expect(texts.some((t) => t.props.children === 'network error')).toBe(true);

  // Second attempt (retry): must not re-authenticate (same user id, so that
  // alone wouldn't retrigger the fetch) — must call retryProfile() and
  // genuinely hit the profile query again.
  await act(async () => {
    findSignInButton(renderer.root).props.onPress();
  });
  await flush();

  // The retry itself must not silently re-authenticate.
  expect(mockSignInWithPassword).toHaveBeenCalledTimes(1);
  // The critical assertion: the fetch actually ran again.
  expect(mockProfileSingle).toHaveBeenCalledTimes(2);

  // Second failure must still leave a usable button, not a stuck spinner.
  expect(findSignInButton(renderer.root).props.loading).toBe(false);
  texts = renderer.root.findAllByType(require('react-native').Text);
  expect(texts.some((t) => t.props.children === 'network error')).toBe(true);
});

test('fail -> retry -> succeed clears the error and lets the profile resolve', async () => {
  mockProfileSingle
    .mockResolvedValueOnce({ data: null, error: { message: 'network error' } })
    .mockResolvedValueOnce({
      data: { id: 'user-1', full_name: 'User One', user_type: 'employee', employees: { role: 'employee' } },
      error: null,
    });

  let renderer!: ReturnType<typeof create>;
  await act(async () => {
    renderer = create(
      <AuthProvider>
        <LoginScreen />
      </AuthProvider>
    );
  });
  await flush();

  await act(async () => {
    findSignInButton(renderer.root).props.onPress();
  });
  await flush();
  await act(async () => {
    authChangeCb('SIGNED_IN', makeSession());
  });
  await flush();

  expect(findSignInButton(renderer.root).props.loading).toBe(false);

  await act(async () => {
    findSignInButton(renderer.root).props.onPress();
  });
  await flush();

  expect(mockProfileSingle).toHaveBeenCalledTimes(2);
  // No lingering error once the retry succeeds.
  const texts = renderer.root.findAllByType(require('react-native').Text);
  expect(texts.some((t) => t.props.children === 'network error')).toBe(false);
});

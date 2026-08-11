// Regression test for the finding that a successful signInWithPassword
// followed by a failed profile read (transient network, RLS denial, missing
// row) left the login button spinning forever with no error and no way to
// retry — the profile query's error was silently discarded in auth.tsx.
//
// `useAuth` is mocked directly (rather than exercising the real AuthProvider
// + supabase round trip, already covered by lib/__tests__/auth.*.test.tsx)
// so this test isolates exactly what login.tsx is responsible for: reacting
// to `profileError` by resetting `loading` and surfacing the message. The
// success path (loading stays true) is asserted first so a fix that resets
// the button unconditionally would also be caught.
import React from 'react';
import { act, create, type ReactTestInstance } from 'react-test-renderer';
import LoginScreen from '../login';

const mockSignInWithPassword = jest.fn();

jest.mock('../../../lib/supabase', () => ({
  supabase: {
    auth: {
      signInWithPassword: (...args: unknown[]) => mockSignInWithPassword(...args),
    },
  },
}));

const mockAuthValue: { profileError: string | null } = { profileError: null };

jest.mock('../../../lib/auth', () => ({
  useAuth: () => mockAuthValue,
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

beforeEach(() => {
  mockAuthValue.profileError = null;
  mockSignInWithPassword.mockReset().mockResolvedValue({ error: null });
});

test('a profile-fetch failure after a successful sign-in stops the spinner and shows a retryable error', async () => {
  let renderer!: ReturnType<typeof create>;
  await act(async () => {
    renderer = create(<LoginScreen />);
  });

  // Trigger the sign-in flow directly, the same way a tap on the button would.
  await act(async () => {
    findSignInButton(renderer.root).props.onPress();
    await Promise.resolve();
    await Promise.resolve();
  });

  // Success path is untouched: signInWithPassword resolved with no error, so
  // the button deliberately stays busy through the gate transition.
  expect(findSignInButton(renderer.root).props.loading).toBe(true);

  // The profile read that follows now fails — auth.tsx surfaces this via
  // `profileError`. Simulate that context update reaching the screen.
  mockAuthValue.profileError = 'Could not load your profile. Check your connection and try again.';
  await act(async () => {
    renderer.update(<LoginScreen />);
  });

  const button = findSignInButton(renderer.root);
  expect(button.props.loading).toBe(false);

  const texts = renderer.root.findAllByType(require('react-native').Text);
  const hasErrorMessage = texts.some(
    (t) => t.props.children === mockAuthValue.profileError
  );
  expect(hasErrorMessage).toBe(true);
});

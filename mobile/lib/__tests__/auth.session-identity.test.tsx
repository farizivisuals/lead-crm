// Regression guard for a high-severity, invisible bug: the profile-loading effect in
// auth.tsx must key off `session?.user?.id`, not the whole `session` object. Supabase
// fires TOKEN_REFRESHED with a NEW session object for the SAME user roughly hourly and
// on app-foreground; keying off `session` re-runs the effect, flips `loading`, and
// SessionGate (app/_layout.tsx) unmounts the root navigator while loading — wiping
// navigation state and in-progress form input, mid-session, in production. A future
// "simplify the dependency array back to [session]" edit reads as harmless and won't
// be caught by a smoke test (refresh is silent, ~hourly). This is the one test in an
// otherwise minimal suite that exists to catch exactly that regression.
import React from 'react';
import { act, create } from 'react-test-renderer';
import { AuthProvider, useAuth } from '../auth';

type AuthChangeCb = (event: string, session: any) => void;
let authChangeCb: AuthChangeCb = () => {};

const mockSingle = jest.fn(() =>
  Promise.resolve({
    data: { id: 'user-1', full_name: 'User 1', user_type: 'employee', employees: { role: 'root' } },
  })
);

jest.mock('../supabase', () => ({
  supabase: {
    auth: {
      getSession: jest.fn(() => Promise.resolve({ data: { session: null } })),
      onAuthStateChange: jest.fn((cb: AuthChangeCb) => {
        authChangeCb = cb;
        return { data: { subscription: { unsubscribe: jest.fn() } } };
      }),
      signOut: jest.fn(),
    },
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({ single: mockSingle })),
      })),
    })),
  },
}));

function makeSession(userId: string) {
  // A fresh object every call, mirroring Supabase handing back a NEW session object on
  // every TOKEN_REFRESHED event even when the underlying user is unchanged.
  return { access_token: `tok-${Math.random()}`, user: { id: userId } };
}

async function flush() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

test('TOKEN_REFRESHED with the same user does not re-run the profile load', async () => {
  const loadingLog: boolean[] = [];

  function Probe() {
    const { loading } = useAuth();
    loadingLog.push(loading);
    return null;
  }

  await act(async () => {
    create(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    );
  });
  await flush();

  await act(async () => {
    authChangeCb('SIGNED_IN', makeSession('user-1'));
  });
  await flush();

  const callsAfterSignIn = mockSingle.mock.calls.length;
  const loadingTrueCountAfterSignIn = loadingLog.filter(Boolean).length;

  for (let i = 0; i < 3; i++) {
    await act(async () => {
      authChangeCb('TOKEN_REFRESHED', makeSession('user-1'));
    });
    await flush();
  }

  expect(mockSingle.mock.calls.length).toBe(callsAfterSignIn); // no extra profile fetch
  expect(loadingLog.filter(Boolean).length).toBe(loadingTrueCountAfterSignIn); // no extra loading flip
});

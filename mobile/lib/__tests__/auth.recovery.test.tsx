// Exercises the real recovery deep-link wiring in auth.tsx end to end, with
// Supabase and expo-linking mocked at the boundary (no real device / network —
// see the Task 9 report for exactly what this does and doesn't prove).
import React from 'react';
import { act, create } from 'react-test-renderer';
import { AuthProvider, useAuth } from '../auth';

let urlListener: ((event: { url: string }) => void) | null = null;

const mockSetSession = jest.fn(
  (): Promise<{ data: { session: null }; error: { message: string } | null }> =>
    Promise.resolve({ data: { session: null }, error: null })
);
const mockGetInitialURL = jest.fn(() => Promise.resolve<string | null>(null));

jest.mock('../supabase', () => ({
  supabase: {
    auth: {
      getSession: jest.fn(() => Promise.resolve({ data: { session: null } })),
      // No SIGNED_IN/TOKEN_REFRESHED activity is driven in this file — that's
      // covered by auth.session-identity.test.tsx. Here we only need the
      // subscription handle so AuthProvider's mount effect doesn't throw.
      onAuthStateChange: jest.fn(() => ({
        data: { subscription: { unsubscribe: jest.fn() } },
      })),
      // Wrapped rather than assigned directly: the factory below runs the
      // moment auth.tsx's `import { supabase } ...` is evaluated, which is
      // before this file's own `const mockSetSession = ...` line executes —
      // a direct reference would capture `undefined`. Deferring the read
      // inside a closure (only touched once a test actually calls it) sidesteps
      // that ordering hazard.
      setSession: (...args: Parameters<typeof mockSetSession>) => mockSetSession(...args),
      signOut: jest.fn(),
    },
    from: jest.fn(() => ({
      select: jest.fn(() => ({ eq: jest.fn(() => ({ single: jest.fn(() => Promise.resolve({ data: null })) })) })),
    })),
  },
}));

jest.mock('expo-linking', () => ({
  getInitialURL: () => mockGetInitialURL(),
  addEventListener: jest.fn((_type: string, cb: (event: { url: string }) => void) => {
    urlListener = cb;
    return { remove: jest.fn() };
  }),
}));

async function flush() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

function renderAuth() {
  let ctx: ReturnType<typeof useAuth>;
  function Reader() {
    ctx = useAuth();
    return null;
  }
  return {
    mount: async () => {
      await act(async () => {
        create(
          <AuthProvider>
            <Reader />
          </AuthProvider>
        );
      });
      await flush();
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ctx: () => ctx as any,
  };
}

beforeEach(() => {
  urlListener = null;
  mockGetInitialURL.mockReset().mockResolvedValue(null);
  mockSetSession.mockReset().mockResolvedValue({ data: { session: null }, error: null });
});

test('cold start: a genuine recovery link calls setSession with the parsed tokens', async () => {
  mockGetInitialURL.mockResolvedValue(
    'leadcrm://update-password#access_token=at-123&refresh_token=rt-456&type=recovery'
  );

  const { mount, ctx } = renderAuth();
  await mount();

  expect(mockSetSession).toHaveBeenCalledTimes(1);
  expect(mockSetSession).toHaveBeenCalledWith({ access_token: 'at-123', refresh_token: 'rt-456' });
  expect(ctx().recovering).toBe(true);
});

test('warm: a URL event with a genuine recovery link also triggers setSession', async () => {
  const { mount, ctx } = renderAuth();
  await mount();
  expect(mockSetSession).not.toHaveBeenCalled();

  await act(async () => {
    urlListener?.({
      url: 'leadcrm://update-password#access_token=at-789&refresh_token=rt-000&type=recovery',
    });
  });
  await flush();

  expect(mockSetSession).toHaveBeenCalledWith({ access_token: 'at-789', refresh_token: 'rt-000' });
  expect(ctx().recovering).toBe(true);
});

test('a non-recovery URL never touches setSession', async () => {
  mockGetInitialURL.mockResolvedValue('leadcrm://update-password?foo=bar');

  const { mount, ctx } = renderAuth();
  await mount();

  expect(mockSetSession).not.toHaveBeenCalled();
  expect(ctx().recovering).toBe(false);
});

test('a malformed recovery link (missing refresh_token) surfaces an error and never calls setSession', async () => {
  mockGetInitialURL.mockResolvedValue('leadcrm://update-password#access_token=at-123&type=recovery');

  const { mount, ctx } = renderAuth();
  await mount();

  expect(mockSetSession).not.toHaveBeenCalled();
  expect(ctx().recovering).toBe(true); // stays on the (auth) group so the error is visible
  expect(ctx().recoveryError).toBe('This reset link is missing required information.');
});

test('an expired-link redirect surfaces the server-provided message without calling setSession', async () => {
  mockGetInitialURL.mockResolvedValue(
    'leadcrm://update-password#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired'
  );

  const { mount, ctx } = renderAuth();
  await mount();

  expect(mockSetSession).not.toHaveBeenCalled();
  expect(ctx().recoveryError).toBe('Email link is invalid or has expired');
});

test('a setSession failure (e.g. rejected/expired token server-side) surfaces the Supabase error', async () => {
  mockGetInitialURL.mockResolvedValue(
    'leadcrm://update-password#access_token=at-bad&refresh_token=rt-bad&type=recovery'
  );
  mockSetSession.mockResolvedValue({
    data: { session: null },
    error: { message: 'Invalid Refresh Token' },
  });

  const { mount, ctx } = renderAuth();
  await mount();

  expect(mockSetSession).toHaveBeenCalledTimes(1);
  expect(ctx().recoveryError).toBe('Invalid Refresh Token');
  expect(ctx().session).toBe(null);
});

test('clearRecovery resets both recovering and recoveryError', async () => {
  mockGetInitialURL.mockResolvedValue('leadcrm://update-password#access_token=at-123&type=recovery');

  const { mount, ctx } = renderAuth();
  await mount();
  expect(ctx().recovering).toBe(true);

  await act(async () => {
    ctx().clearRecovery();
  });
  await flush();

  expect(ctx().recovering).toBe(false);
  expect(ctx().recoveryError).toBe(null);
});

test('signOut clears recovery state', async () => {
  mockGetInitialURL.mockResolvedValue('leadcrm://update-password#access_token=at-123&type=recovery');

  const { mount, ctx } = renderAuth();
  await mount();
  expect(ctx().recovering).toBe(true);

  await act(async () => {
    await ctx().signOut();
  });
  await flush();

  expect(ctx().recovering).toBe(false);
  expect(ctx().recoveryError).toBe(null);
});

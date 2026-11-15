// Regression test for the warm-path recovery deep link finding: expo-router
// 56.2.18 drops an incoming link whose root route isn't in the *current*
// navigator's routeNames (node_modules/expo-router/build/fork/useLinking.native.js),
// and Stack.Protected excludes guarded-out screens from that list
// (node_modules/expo-router/build/useScreens.js). So when an already
// signed-in user taps a recovery link, the link itself is silently dropped —
// but `recovering` still flips true in auth.tsx and SessionGate still mounts
// the (auth) group. Without a redirect, expo-router's sortRoutes
// (node_modules/expo-router/build/sortRoutes.js — shorter route name sorts
// first, with no dynamic/index tiebreak in play here) defaults that group to
// `login`, not `update-password`, stranding the user with a consumed,
// one-time reset link and no way forward.
//
// `expo-router` itself is mocked below (there's no real native navigator
// under Jest, and `@testing-library/react-native` isn't installed in this
// project) with a minimal fake that mirrors exactly the two behaviours this
// bug depends on: (1) Stack.Protected only renders its children when its
// guard is true, and (2) mounting a group's Stack.Screen for the first time
// lands on that group's default route — `login` for `(auth)` — exactly as
// real expo-router does per sortRoutes.js. `usePathname`/`useRouter` are
// backed by a tiny pub-sub so SessionGate's effect reacts to pathname
// changes the same way it would against the real router.
import React from 'react';
import { act, create } from 'react-test-renderer';
import { AuthProvider } from '../../lib/auth';
import { SessionGate } from '../_layout';

let urlListener: ((event: { url: string }) => void) | null = null;

const mockSetSession = jest.fn(
  (): Promise<{ data: { session: null }; error: { message: string } | null }> =>
    Promise.resolve({ data: { session: null }, error: null })
);
const mockGetInitialURL = jest.fn(() => Promise.resolve<string | null>(null));
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockGetSession = jest.fn((): Promise<{ data: { session: any } }> =>
  Promise.resolve({ data: { session: null } })
);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockProfileSingle = jest.fn((): Promise<{ data: any; error: null }> =>
  Promise.resolve({ data: null, error: null })
);

jest.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: (...args: Parameters<typeof mockGetSession>) => mockGetSession(...args),
      onAuthStateChange: jest.fn(() => ({
        data: { subscription: { unsubscribe: jest.fn() } },
      })),
      setSession: (...args: Parameters<typeof mockSetSession>) => mockSetSession(...args),
      signOut: jest.fn(),
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
  getInitialURL: () => mockGetInitialURL(),
  addEventListener: jest.fn((_type: string, cb: (event: { url: string }) => void) => {
    urlListener = cb;
    return { remove: jest.fn() };
  }),
}));

// --- Minimal fake expo-router --------------------------------------------
// `mockPathnameHolder`/`mockRouterReplace` must be prefixed "mock" so Jest's
// module-factory hoisting allows the jest.mock('expo-router', ...) factory
// below to close over them.
const mockPathnameHolder = { current: '/(employee)/dashboard' };
const mockPathnameListeners = new Set<() => void>();

// Simulates the navigator's own state changing (either its default-screen
// selection on first mount, or our app code's explicit router.replace()) —
// notifies every usePathname() subscriber, same as a real navigation state
// change would.
function mockSetPathname(next: string) {
  if (mockPathnameHolder.current === next) return;
  mockPathnameHolder.current = next;
  mockPathnameListeners.forEach((listener) => listener());
}

// This is the spy under test: SessionGate's fix calls router.replace(), and
// nothing else in this fake should call it, so its call log is a faithful
// record of the app code's own navigation decisions.
const mockRouterReplace = jest.fn((path: string) => {
  mockSetPathname(path);
});

jest.mock('expo-router', () => {
  const ReactActual = require('react');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function Stack({ children }: any) {
    return children ?? null;
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Stack.Protected = function Protected({ guard, children }: any) {
    return guard ? children : null;
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Stack.Screen = function Screen({ name }: any) {
    // Mirrors expo-router: a group mounted without an existing navigation
    // state targeting one of its children lands on its default (here:
    // shortest-named, per sortRoutes.js) screen.
    ReactActual.useEffect(() => {
      if (name === '(auth)') mockSetPathname('/login');
      else if (name === '(employee)') mockSetPathname('/(employee)/dashboard');
      else if (name === '(client)') mockSetPathname('/(client)');
    }, [name]);
    return null;
  };

  return {
    Stack,
    useRouter: () => ({ replace: mockRouterReplace }),
    usePathname: () => {
      const [, forceRender] = ReactActual.useState(0);
      ReactActual.useEffect(() => {
        const listener = () => forceRender((c: number) => c + 1);
        mockPathnameListeners.add(listener);
        return () => {
          mockPathnameListeners.delete(listener);
        };
      }, []);
      return mockPathnameHolder.current;
    },
  };
});

async function flush() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

beforeEach(() => {
  urlListener = null;
  mockPathnameHolder.current = '/(employee)/dashboard';
  mockPathnameListeners.clear();
  mockRouterReplace.mockClear();
  mockGetInitialURL.mockReset().mockResolvedValue(null);
  mockSetSession.mockReset().mockResolvedValue({ data: { session: null }, error: null });
  mockGetSession.mockReset().mockResolvedValue({
    data: { session: { user: { id: 'user-1' } } },
  });
  mockProfileSingle.mockReset().mockResolvedValue({
    data: {
      id: 'user-1',
      full_name: 'Employee One',
      user_type: 'employee',
      employees: { role: 'employee' },
    },
    error: null,
  });
});

test('warm recovery link for an already-signed-in user redirects (auth)/login to update-password, and does not loop', async () => {
  await act(async () => {
    create(
      <AuthProvider>
        <SessionGate />
      </AuthProvider>
    );
  });
  await flush();
  await flush();

  // Sanity: the employee is already on their dashboard before the link ever fires.
  expect(mockPathnameHolder.current).toBe('/(employee)/dashboard');
  expect(mockRouterReplace).not.toHaveBeenCalled();

  // Warm event: a recovery link arrives while the app is already running and
  // the user already has a session — this is exactly the case expo-router
  // drops (root route "(auth)" isn't in the mounted routeNames yet).
  await act(async () => {
    urlListener?.({
      url: 'leadcrm://update-password#access_token=at-1&refresh_token=rt-1&type=recovery',
    });
  });
  await flush();
  await flush();
  await flush();

  // Without the fix, (auth) mounts and defaults to `login` and nothing ever
  // pushes it onward — the assertion below is what fails on the pre-fix code.
  expect(mockRouterReplace).toHaveBeenCalledWith('/update-password');
  expect(mockPathnameHolder.current).toBe('/update-password');

  // No loop: exactly one replace call, and it doesn't keep firing on
  // subsequent settles now that pathname is already update-password.
  await flush();
  expect(mockRouterReplace).toHaveBeenCalledTimes(1);
});

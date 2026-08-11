import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import * as Linking from 'expo-linking';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';
import type { UserType } from './routing';
import { parseRecoveryLink } from './recovery-link';

type EmployeeRole = 'root' | 'ceo' | 'cfo' | 'manager' | 'employee';

type Profile = { id: string; full_name: string; user_type: UserType };
type EmployeeRow = { role: EmployeeRole };

type AuthValue = {
  session: Session | null;
  profile: Profile | null;
  employee: EmployeeRow | null;
  loading: boolean;
  // True once the initial deep-link check (Linking.getInitialURL, parsed) has
  // completed — whether or not it turned out to be a recovery link. SessionGate
  // must not compute a dashboard target while this is false: getSession() +
  // the profile fetch can resolve before getInitialURL() does, and without this
  // gate an already-signed-in user tapping a recovery link would flash their
  // real dashboard for a frame before `recovering` catches up.
  recoveryChecked: boolean;
  // A password-recovery deep link is being (or has been) consumed — see
  // routing.ts's `recovering` guard for why this has to outlive the session
  // getting established.
  recovering: boolean;
  recoveryError: string | null;
  // Called once the new password is saved, or from a "back to sign in" escape
  // hatch on a failed link — routes the user onward normally again.
  clearRecovery: () => void;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [employee, setEmployee] = useState<EmployeeRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [recoveryChecked, setRecoveryChecked] = useState(false);
  const [recovering, setRecovering] = useState(false);
  const [recoveryError, setRecoveryError] = useState<string | null>(null);

  function clearRecovery() {
    setRecovering(false);
    setRecoveryError(null);
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    // `detectSessionInUrl` is off (lib/supabase.ts), so the recovery email's
    // access/refresh tokens — carried in the URL *fragment*, which
    // Linking.parse() doesn't read — are consumed here instead. Two entry
    // paths: cold start (app not yet running) and warm (already running).
    //
    // `markChecked` is only ever passed for the cold-start call. It fires
    // synchronously once the URL has been parsed — before the `setSession()`
    // await — so `recoveryChecked` flips as soon as we KNOW whether this is a
    // recovery link, not only once the whole flow (including the network
    // round trip) finishes.
    async function consume(url: string | null, markChecked?: () => void) {
      const result = url ? parseRecoveryLink(url) : ({ kind: 'none' } as const);

      if (result.kind === 'none') {
        markChecked?.();
        return;
      }

      // Flip on before setSession() resolves so SessionGate keeps the (auth)
      // group mounted for the async gap too, not just after success.
      setRecovering(true);
      setRecoveryError(null);
      markChecked?.();

      if (result.kind === 'recovery-error') {
        setRecoveryError(result.message);
        return;
      }

      try {
        const { error } = await supabase.auth.setSession({
          access_token: result.accessToken,
          refresh_token: result.refreshToken,
        });
        // Never surface `error.message` verbatim if it could echo the tokens —
        // Supabase's setSession errors are validation/HTTP errors about the
        // session, not the raw token strings, so this is safe to show as-is.
        if (error) setRecoveryError(error.message);
      } catch {
        setRecoveryError('This reset link is invalid or has expired.');
      }
    }

    Linking.getInitialURL()
      .then((url) => consume(url, () => setRecoveryChecked(true)))
      // getInitialURL() itself rejecting must still resolve the check — a
      // permanent spinner is worse than the one-frame flash this replaces.
      .catch(() => setRecoveryChecked(true));

    const sub = Linking.addEventListener('url', (event) => {
      consume(event.url);
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    let cancelled = false;
    // Key this effect off the user id, not the whole `session` object. Supabase fires
    // `TOKEN_REFRESHED` with a NEW session object for the same user roughly hourly and
    // on app-foreground; re-running the profile fetch on every refresh would flip
    // `loading` and tear down the root navigator (SessionGate unmounts <Stack> while
    // loading). Only an actual identity change should trigger a reload.
    const userId = session?.user?.id;

    async function load() {
      if (!userId) {
        setProfile(null);
        setEmployee(null);
        setLoading(false);
        return;
      }
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name, user_type, employees(role)')
        .eq('id', userId)
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
  }, [session?.user?.id]);

  async function signOut() {
    await supabase.auth.signOut();
    clearRecovery();
  }

  return (
    <AuthContext.Provider
      value={{
        session,
        profile,
        employee,
        loading,
        recoveryChecked,
        recovering,
        recoveryError,
        clearRecovery,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}

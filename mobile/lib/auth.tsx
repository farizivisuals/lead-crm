import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import * as Linking from 'expo-linking';
import type { Session } from '@supabase/supabase-js';
import { queryClient } from './query-client';
import { supabase } from './supabase';
import type { UserType } from './routing';
import { parseRecoveryLink } from './recovery-link';

type EmployeeRole = 'root' | 'ceo' | 'cfo' | 'manager' | 'employee';

type Profile = { id: string; full_name: string; user_type: UserType };
type EmployeeRow = {
  role: EmployeeRole;
  // Needed by isCreativeEmployee() in lib/data.ts — a plain employee in the
  // creatives department may edit project moodboards.
  employee_departments?: { department_id: string; departments?: { slug: string } | null }[];
};

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
  // Set when the post-sign-in profile fetch itself fails (network, RLS
  // denial, etc.) — as opposed to succeeding with no row, which is a
  // legitimate "no profile" state. login.tsx uses this to stop the sign-in
  // button spinning and let the user retry instead of hanging forever.
  profileError: string | null;
  // Re-runs the profile fetch without depending on `session?.user?.id`
  // changing (that key must stay frozen against TOKEN_REFRESHED — see the
  // profile effect below). login.tsx calls this on a repeat sign-in attempt
  // after a profileError, since signing in again as the same user doesn't
  // itself change the id and so wouldn't otherwise retrigger the fetch.
  retryProfile: () => void;
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
  const [profileError, setProfileError] = useState<string | null>(null);
  // Bumped by retryProfile() to force the profile effect below to re-run
  // without touching its `session?.user?.id` dependency.
  const [retryNonce, setRetryNonce] = useState(0);

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
        setProfileError(null);
        setLoading(false);
        return;
      }
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, user_type, employees(role, employee_departments(department_id, departments(slug)))')
        .eq('id', userId)
        .single();

      if (cancelled) return;

      if (error) {
        // Transient network failure, RLS denial, or a genuinely missing row
        // (`.single()` errors on zero rows) — surface it rather than leaving
        // the caller (login.tsx) with no signal and a permanently spinning
        // button.
        setProfile(null);
        setEmployee(null);
        setProfileError(error.message);
      } else if (!data) {
        setProfile(null);
        setEmployee(null);
        setProfileError(null);
      } else {
        setProfileError(null);
        const { employees, ...rest } = data as any;
        setProfile(rest as Profile);
        // `employees` is embedded via a PK foreign key, so Supabase may return
        // it as an object or a single-element array. Normalise for either.
        setEmployee(Array.isArray(employees) ? (employees[0] ?? null) : (employees ?? null));
      }
      setLoading(false);
    }

    setLoading(true);
    // Cleared up front (not just inside `load()`'s branches) so a retry that
    // fails the same way as last time still produces a real null -> message
    // transition — otherwise login.tsx's effect (keyed on `profileError`)
    // would never re-fire and the button would stay stuck.
    setProfileError(null);
    load();
    return () => {
      cancelled = true;
    };
    // `retryNonce` deliberately sits ALONGSIDE `session?.user?.id`, not in
    // place of it: that id must stay the only thing that reacts to identity
    // changes (TOKEN_REFRESHED fires a new session object for the same user
    // roughly hourly, and must not re-run this). retryNonce is the one
    // sanctioned way to force a re-run without touching that guard.
  }, [session?.user?.id, retryNonce]);

  function retryProfile() {
    setRetryNonce((n) => n + 1);
  }

  async function signOut() {
    await supabase.auth.signOut();
    // The QueryClient is module-scoped and outlives the session. Only
    // `dashboardEmployee` is user-scoped — ['tasks'], ['projects'] and
    // ['project', id] are not, so without this the next user sees the previous
    // user's rows painted from cache until staleTime (30s) expires.
    queryClient.clear();
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
        profileError,
        retryProfile,
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

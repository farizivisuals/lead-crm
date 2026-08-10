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
  }, [session]);

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

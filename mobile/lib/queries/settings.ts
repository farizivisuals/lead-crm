import { useQuery } from '@tanstack/react-query';
import type { EmployeeRole } from '@shared/types';
import { supabase } from '../supabase';
import { qk } from './keys';

/* ---------------------------------------------------------------- team ---- */

export type TeamMember = {
  profile_id: string;
  role: EmployeeRole;
  profiles: { full_name: string } | { full_name: string }[] | null;
  employee_departments: { department_id: string }[] | null;
};

export type TeamData = {
  members: TeamMember[];
  departments: { id: string; name: string }[];
};

/** Read-only on mobile — adding and editing employees needs service_role. */
export function useTeam() {
  return useQuery({
    queryKey: qk.team(),
    queryFn: async (): Promise<TeamData> => {
      const [membersRes, deptsRes] = await Promise.all([
        supabase
          .from('employees')
          .select('*, profiles(*), employee_departments(department_id)')
          .order('role'),
        supabase.from('departments').select('*').order('name'),
      ]);
      if (membersRes.error) throw membersRes.error;
      if (deptsRes.error) throw deptsRes.error;
      return {
        members: (membersRes.data ?? []) as unknown as TeamMember[],
        departments: (deptsRes.data ?? []) as { id: string; name: string }[],
      };
    },
  });
}

/** Department names for one member, in the order departments are listed. */
export function departmentNames(
  member: TeamMember,
  departments: { id: string; name: string }[]
): string[] {
  const ids = new Set((member.employee_departments ?? []).map((d) => d.department_id));
  return departments.filter((d) => ids.has(d.id)).map((d) => d.name);
}

/* ------------------------------------------------------- notifications ---- */

export type NotificationRow = {
  id: string;
  type: string;
  entity_type: string | null;
  entity_id: string | null;
  title: string;
  body: string;
  is_read: boolean;
  created_at: string;
};

export function useNotifications(userId: string) {
  return useQuery({
    queryKey: qk.notifications(userId),
    queryFn: async (): Promise<NotificationRow[]> => {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('recipient_profile_id', userId)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as NotificationRow[];
    },
  });
}

export function unreadCount(rows: NotificationRow[]): number {
  return rows.filter((n) => !n.is_read).length;
}

export async function markNotificationRead(id: string) {
  const { error } = await supabase.from('notifications').update({ is_read: true }).eq('id', id);
  if (error) throw error;
}

export async function markAllNotificationsRead(userId: string) {
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('recipient_profile_id', userId)
    .eq('is_read', false);
  if (error) throw error;
}

/* ------------------------------------------------------------- profile ---- */

export async function updateFullName(userId: string, fullName: string) {
  const { error } = await supabase
    .from('profiles')
    .update({ full_name: fullName })
    .eq('id', userId);
  if (error) throw error;
}

/**
 * User-scoped: Supabase updates the password of whoever is signed in. No
 * service_role, and no way to target another account from here.
 */
export async function updateOwnPassword(password: string) {
  const { error } = await supabase.auth.updateUser({ password });
  if (error) throw error;
}

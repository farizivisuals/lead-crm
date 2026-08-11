import { useQuery } from '@tanstack/react-query';
import type { TaskPriority } from '@shared/types';
import { supabase } from '../supabase';
import { qk } from './keys';

export type AllTasksRow = {
  id: string;
  title: string;
  priority: TaskPriority;
  due_date: string | null;
  project_id: string;
  assigned_to: string | null;
  projects: { name: string } | { name: string }[] | null;
  departments: { name: string } | { name: string }[] | null;
  department_stages:
    | { name: string; is_terminal: boolean }
    | { name: string; is_terminal: boolean }[]
    | null;
  employees: { profiles: { full_name: string } | null } | { profiles: { full_name: string } | null }[] | null;
};

export function useAllTasks() {
  return useQuery({
    queryKey: qk.allTasks(),
    queryFn: async (): Promise<AllTasksRow[]> => {
      // Deliberately role-agnostic — no .eq('assigned_to', …) here. RLS scopes
      // the result set; the same query text serves every role.
      const { data, error } = await supabase
        .from('tasks')
        .select('id, title, priority, due_date, project_id, assigned_to, projects(name), departments(name), department_stages(name, is_terminal), employees!assigned_to(profiles(full_name))')
        .order('due_date', { ascending: true, nullsFirst: false });
      if (error) throw error;
      return (data ?? []) as unknown as AllTasksRow[];
    },
  });
}

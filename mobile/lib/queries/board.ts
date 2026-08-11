import { useQuery } from '@tanstack/react-query';
import type { TaskPriority } from '@shared/types';
import { supabase } from '../supabase';
import { qk } from './keys';

export type BoardDepartment = { id: string; name: string; slug: string; is_primary: boolean };

export type BoardTask = {
  id: string;
  project_id: string;
  department_id: string;
  current_stage_id: string;
  title: string;
  priority: TaskPriority;
  start_date: string | null;
  due_date: string | null;
  assigned_to: string | null;
  department_stages:
    | { id: string; name: string; is_terminal: boolean; color: string | null }
    | { id: string; name: string; is_terminal: boolean; color: string | null }[]
    | null;
  employees: { profiles: { full_name: string } | null } | { profiles: { full_name: string } | null }[] | null;
  task_creatives:
    | { profile_id: string; employees: { profiles: { full_name: string } | null } | { profiles: { full_name: string } | null }[] | null }[]
    | null;
};

export type Board = {
  projectName: string;
  departments: BoardDepartment[];
  tasks: BoardTask[];
};

export function useBoard(projectId: string) {
  return useQuery({
    queryKey: qk.projectTasks(projectId),
    queryFn: async (): Promise<Board> => {
      const [projectRes, tasksRes] = await Promise.all([
        supabase
          .from('projects')
          .select('name, project_departments(department_id, is_primary, departments(id, name, slug))')
          .eq('id', projectId)
          .single(),
        supabase
          .from('tasks')
          .select('*, department_stages(*), departments(name), employees!assigned_to(profiles(full_name)), task_creatives(profile_id, employees!task_creatives_profile_id_fkey(profiles(full_name)))')
          .eq('project_id', projectId)
          .order('created_at'),
      ]);
      if (projectRes.error) throw projectRes.error;
      if (!projectRes.data) throw new Error('Project not found');
      if (tasksRes.error) throw tasksRes.error;

      const departments = ((projectRes.data as any).project_departments ?? [])
        .map((pd: any) => {
          const dept = Array.isArray(pd.departments) ? pd.departments[0] : pd.departments;
          if (!dept) return null;
          return {
            id: dept.id as string,
            name: dept.name as string,
            slug: dept.slug as string,
            is_primary: !!pd.is_primary,
          };
        })
        .filter(Boolean) as BoardDepartment[];

      return {
        projectName: (projectRes.data as any).name as string,
        departments,
        tasks: (tasksRes.data ?? []) as unknown as BoardTask[],
      };
    },
  });
}

export type BoardStage = {
  id: string;
  department_id: string;
  name: string;
  position: number;
  is_terminal: boolean;
  color: string | null;
};

export type BoardMeta = {
  stages: BoardStage[];
  employees: { profile_id: string; full_name: string; department_id: string }[];
};

/**
 * Batch 2 of the web page's two sequential fetches — it needs the department
 * ids that batch 1 produced, so it stays disabled until they arrive.
 */
export function useBoardMeta(deptIds: string[]) {
  return useQuery({
    queryKey: qk.boardMeta(deptIds),
    enabled: deptIds.length > 0,
    queryFn: async (): Promise<BoardMeta> => {
      const [stagesRes, employeesRes] = await Promise.all([
        supabase
          .from('department_stages')
          .select('*')
          .in('department_id', deptIds)
          .order('position'),
        supabase
          .from('employees')
          .select('profile_id, profiles(full_name), employee_departments!inner(department_id)')
          .in('employee_departments.department_id', deptIds),
      ]);
      if (stagesRes.error) throw stagesRes.error;
      if (employeesRes.error) throw employeesRes.error;

      const employees: BoardMeta['employees'] = [];
      for (const row of (employeesRes.data ?? []) as any[]) {
        const profiles = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
        const memberships = Array.isArray(row.employee_departments)
          ? row.employee_departments
          : [row.employee_departments].filter(Boolean);
        for (const m of memberships) {
          employees.push({
            profile_id: row.profile_id as string,
            full_name: profiles?.full_name ?? 'Unknown',
            department_id: m.department_id as string,
          });
        }
      }

      return { stages: (stagesRes.data ?? []) as BoardStage[], employees };
    },
  });
}

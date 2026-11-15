import { useQuery } from '@tanstack/react-query';
import type { TaskPriority } from '@shared/types';
import { supabase } from '../supabase';
import { one } from '../data';
import { TASK_DELIVERABLES_SELECT, type TaskDeliverable } from './task-deliverables';
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
  task_deliverables: TaskDeliverable[] | null;
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
          .select(
            `*, department_stages(*), departments(name), employees!assigned_to(profiles(full_name)), task_creatives(profile_id, employees!task_creatives_profile_id_fkey(profiles(full_name))), ${TASK_DELIVERABLES_SELECT}`
          )
          .eq('project_id', projectId)
          .order('created_at'),
      ]);
      if (projectRes.error) throw projectRes.error;
      if (!projectRes.data) throw new Error('Project not found');
      if (tasksRes.error) throw tasksRes.error;

      const departments = ((projectRes.data as any).project_departments ?? [])
        .map((pd: any) => {
          const dept = one<any>(pd.departments);
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
};

/**
 * Batch 2 of the web page's two sequential fetches — it needs the department
 * ids that batch 1 produced, so it stays disabled until they arrive.
 *
 * The web also fetches the departments' members here, for its assignee
 * dropdowns. The mobile board has none (assignment happens on the task screens,
 * which fetch their own single-department list via `useTaskPickers`), so that
 * query is deliberately not ported — nothing ever read it.
 */
export function useBoardMeta(deptIds: string[]) {
  return useQuery({
    queryKey: qk.boardMeta(deptIds),
    enabled: deptIds.length > 0,
    queryFn: async (): Promise<BoardMeta> => {
      const { data, error } = await supabase
        .from('department_stages')
        .select('*')
        .in('department_id', deptIds)
        .order('position');
      if (error) throw error;
      return { stages: (data ?? []) as BoardStage[] };
    },
  });
}

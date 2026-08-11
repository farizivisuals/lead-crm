import { useQuery } from '@tanstack/react-query';
import type { ProjectStatus, TaskPriority, DeliverableStatus } from '@shared/types';
import { supabase } from '../supabase';
import { qk } from './keys';
import { distinctClientCount } from '../data';
import {
  STAGE_HISTORY_SELECT,
  describeStageChange,
  type StageChange,
  type StageChangeRow,
} from './activity';

export type ExecutiveDashboardData = {
  departments: { id: string; name: string }[];
  clientCount: number;
  projectCount: number;
  openTaskCount: number;
  overdueCount: number;
  overdueTasks: {
    id: string;
    title: string;
    priority: TaskPriority;
    due_date: string;
    project_id: string;
    projects: { name: string } | { name: string }[] | null;
  }[];
  reviewDeliverables: {
    id: string;
    title: string;
    status: DeliverableStatus;
    updated_at: string;
    project_id: string;
    projects: { name: string } | { name: string }[] | null;
  }[];
  activity: StageChange[];
  recentProjects: {
    id: string;
    name: string;
    status: ProjectStatus;
    clients: { company_name: string } | { company_name: string }[] | null;
  }[];
};

export function useExecutiveDashboard(deptId: string | null) {
  return useQuery({
    queryKey: qk.dashboardExec(deptId),
    queryFn: async (): Promise<ExecutiveDashboardData> => {
      // Same "today" convention as isTaskOverdue() in lib/data.ts.
      const today = new Date().toISOString().slice(0, 10);

      let overdueQuery = supabase
        .from('tasks')
        .select(
          'id, title, priority, due_date, project_id, projects(name), department_stages!current_stage_id!inner(is_terminal)',
          { count: 'exact' }
        )
        .eq('department_stages.is_terminal', false)
        .lt('due_date', today)
        .order('due_date', { ascending: true })
        .limit(5);
      if (deptId) overdueQuery = overdueQuery.eq('department_id', deptId);

      const [deptsRes, clientsRes, projectCountRes, openTasksRes, overdueRes, reviewRes, activityRes, recentRes] =
        await Promise.all([
          supabase.from('departments').select('id, name').order('name'),

          deptId
            ? supabase
                .from('project_departments')
                .select('projects!inner(client_id)')
                .eq('department_id', deptId)
            : supabase.from('clients').select('*', { count: 'exact', head: true }),

          deptId
            ? supabase
                .from('project_departments')
                .select('*', { count: 'exact', head: true })
                .eq('department_id', deptId)
            : supabase.from('projects').select('*', { count: 'exact', head: true }),

          deptId
            ? supabase
                .from('tasks')
                .select('*, department_stages!current_stage_id!inner(is_terminal)', {
                  count: 'exact',
                  head: true,
                })
                .eq('department_id', deptId)
                .eq('department_stages.is_terminal', false)
            : supabase
                .from('tasks')
                .select('*, department_stages!current_stage_id!inner(is_terminal)', {
                  count: 'exact',
                  head: true,
                })
                .eq('department_stages.is_terminal', false),

          overdueQuery,

          // Like the activity feed below, always agency-wide: deliverables
          // carry no department_id, and review bottlenecks are an
          // exec-attention item regardless of the department filter.
          supabase
            .from('deliverables')
            .select('id, title, status, updated_at, project_id, projects(name)')
            .in('status', ['internal_review', 'client_review'])
            .order('updated_at', { ascending: false })
            .limit(5),

          // activity_log has no writer anywhere in the schema, so this panel was
          // always empty. task_stage_history is written by log_task_stage_change()
          // on every real stage change. Never department-filtered — always
          // agency-wide, as the panel has always been — and RLS
          // (task_history_select) already scopes it to projects this employee
          // can see.
          supabase
            .from('task_stage_history')
            .select(STAGE_HISTORY_SELECT)
            .order('moved_at', { ascending: false })
            .limit(8),

          deptId
            ? supabase
                .from('projects')
                .select('*, clients(company_name), project_departments!inner(department_id)')
                .eq('project_departments.department_id', deptId)
                .order('updated_at', { ascending: false })
                .limit(5)
            : supabase
                .from('projects')
                .select('*, clients(company_name)')
                .order('updated_at', { ascending: false })
                .limit(5),
        ]);

      if (deptsRes.error) throw deptsRes.error;
      if (clientsRes.error) throw clientsRes.error;
      if (projectCountRes.error) throw projectCountRes.error;
      if (openTasksRes.error) throw openTasksRes.error;
      if (overdueRes.error) throw overdueRes.error;
      if (reviewRes.error) throw reviewRes.error;
      if (activityRes.error) throw activityRes.error;
      if (recentRes.error) throw recentRes.error;

      return {
        overdueCount: overdueRes.count ?? 0,
        overdueTasks: (overdueRes.data ?? []) as unknown as ExecutiveDashboardData['overdueTasks'],
        reviewDeliverables: (reviewRes.data ?? []) as unknown as ExecutiveDashboardData['reviewDeliverables'],
        departments: (deptsRes.data ?? []) as { id: string; name: string }[],
        // Filtered: distinct clients across the department's projects.
        // Unfiltered: the head-count the query already returned.
        clientCount: deptId
          ? distinctClientCount((clientsRes.data ?? []) as any[])
          : (clientsRes.count ?? 0),
        projectCount: projectCountRes.count ?? 0,
        openTaskCount: openTasksRes.count ?? 0,
        activity: ((activityRes.data ?? []) as unknown as StageChangeRow[]).map(describeStageChange),
        recentProjects: (recentRes.data ?? []) as unknown as ExecutiveDashboardData['recentProjects'],
      };
    },
  });
}

export type EmployeeDashboardData = {
  tasks: {
    id: string;
    title: string;
    priority: TaskPriority;
    due_date: string | null;
    project_id: string;
    projects: { name: string } | { name: string }[] | null;
    department_stages:
      | { name: string; is_terminal: boolean }
      | { name: string; is_terminal: boolean }[]
      | null;
  }[];
  deliverables: {
    id: string;
    title: string;
    status: DeliverableStatus;
    updated_at: string;
    project_id: string;
    projects: { name: string } | { name: string }[] | null;
  }[];
};

export function useEmployeeDashboard(userId: string) {
  return useQuery({
    queryKey: qk.dashboardEmployee(userId),
    queryFn: async (): Promise<EmployeeDashboardData> => {
      const [tasksRes, deliverablesRes] = await Promise.all([
        // Note: unlike the executive open-task count, this query does NOT
        // filter terminal stages server-side. The screen filters them out
        // client-side, matching the web component.
        supabase
          .from('tasks')
          .select('id, title, priority, due_date, project_id, projects(name), department_stages!current_stage_id(name, is_terminal)')
          .eq('assigned_to', userId)
          .order('due_date', { ascending: true, nullsFirst: false }),
        supabase
          .from('deliverables')
          .select('id, title, status, updated_at, project_id, projects(name)')
          .eq('submitted_by', userId)
          .order('updated_at', { ascending: false })
          .limit(10),
      ]);
      if (tasksRes.error) throw tasksRes.error;
      if (deliverablesRes.error) throw deliverablesRes.error;
      return {
        tasks: (tasksRes.data ?? []) as unknown as EmployeeDashboardData['tasks'],
        deliverables: (deliverablesRes.data ?? []) as unknown as EmployeeDashboardData['deliverables'],
      };
    },
  });
}

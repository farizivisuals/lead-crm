import { useQuery } from '@tanstack/react-query';
import type { TaskPriority } from '@shared/types';
import { supabase } from '../supabase';
import { one } from '../data';
import { qk } from './keys';

export type TaskDetail = {
  id: string;
  project_id: string;
  department_id: string;
  current_stage_id: string;
  title: string;
  description: string | null;
  priority: TaskPriority;
  start_date: string | null;
  due_date: string | null;
  assigned_to: string | null;
  department_stages:
    | { id: string; name: string; is_terminal: boolean; color: string | null }
    | { id: string; name: string; is_terminal: boolean; color: string | null }[]
    | null;
  departments: { name: string } | { name: string }[] | null;
  employees: { profiles: { full_name: string } | null } | { profiles: { full_name: string } | null }[] | null;
  task_creatives: { profile_id: string }[] | null;
};

export function useTask(taskId: string) {
  return useQuery({
    queryKey: qk.task(taskId),
    queryFn: async (): Promise<TaskDetail> => {
      // Same select as the board's task query (porting brief §4), narrowed to
      // one row. The FK-disambiguated relation names are required verbatim.
      const { data, error } = await supabase
        .from('tasks')
        .select('*, department_stages(*), departments(name), employees!assigned_to(profiles(full_name)), task_creatives(profile_id, employees!task_creatives_profile_id_fkey(profiles(full_name)))')
        .eq('id', taskId)
        .single();
      if (error) throw error;
      if (!data) throw new Error('Task not found');
      return data as unknown as TaskDetail;
    },
  });
}

export type TaskPickers = {
  stages: { id: string; name: string; position: number; is_terminal: boolean; color: string | null }[];
  employees: { profile_id: string; full_name: string }[];
  projectCreatives: { profile_id: string; full_name: string }[];
};

/**
 * The board fetches stages and department members with `.in('department_id',
 * deptIds)` across every department on the project. A task belongs to exactly
 * one department, so this narrows the same two queries to `.eq(...)` — same
 * rows, one department's worth.
 */
export function useTaskPickers(projectId: string, departmentId: string | undefined) {
  return useQuery({
    queryKey: qk.taskPickers(projectId, departmentId ?? ''),
    enabled: !!departmentId,
    queryFn: async (): Promise<TaskPickers> => {
      const [stagesRes, employeesRes, creativesRes] = await Promise.all([
        supabase
          .from('department_stages')
          .select('*')
          .eq('department_id', departmentId!)
          .order('position'),
        supabase
          .from('employees')
          .select('profile_id, profiles(full_name), employee_departments!inner(department_id)')
          .eq('employee_departments.department_id', departmentId!),
        supabase
          .from('project_creatives')
          .select('profile_id, employees(profiles(full_name))')
          .eq('project_id', projectId),
      ]);
      if (stagesRes.error) throw stagesRes.error;
      if (employeesRes.error) throw employeesRes.error;
      if (creativesRes.error) throw creativesRes.error;

      return {
        stages: (stagesRes.data ?? []) as TaskPickers['stages'],
        employees: (employeesRes.data ?? []).map((row: any) => ({
          profile_id: row.profile_id as string,
          full_name: one(row.profiles)?.full_name ?? 'Unknown',
        })),
        projectCreatives: (creativesRes.data ?? []).map((row: any) => ({
          profile_id: row.profile_id as string,
          full_name: one(one(row.employees)?.profiles)?.full_name ?? 'Unknown',
        })),
      };
    },
  });
}

/**
 * Overlapping-date-range check, verbatim from NewTaskDialog/EditTaskDialog:
 * any other task for the same assignee whose [start_date, due_date] window
 * intersects this one's. `excludeTaskId` is the task being edited (the web
 * adds `.neq('id', task.id)`); pass null when creating.
 *
 * This is a HARD BLOCK on web despite its advisory styling — `canSubmit`
 * requires `conflicting.length === 0`. Keep it blocking.
 */
export function useAvailabilityConflicts({
  assignedTo,
  startDate,
  dueDate,
  excludeTaskId,
}: {
  assignedTo: string | null;
  startDate: string;
  dueDate: string;
  excludeTaskId: string | null;
}) {
  return useQuery({
    queryKey: qk.taskConflicts(assignedTo ?? '', startDate, dueDate, excludeTaskId),
    enabled: !!assignedTo && !!startDate && !!dueDate,
    queryFn: async () => {
      let query = supabase
        .from('tasks')
        .select('id, title')
        .eq('assigned_to', assignedTo!)
        .not('start_date', 'is', null)
        .not('due_date', 'is', null)
        .lte('start_date', dueDate)
        .gte('due_date', startDate);
      if (excludeTaskId) query = query.neq('id', excludeTaskId);
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as { id: string; title: string }[];
    },
  });
}

/**
 * KNOWN FRAGILITY, reproduced deliberately for parity: whether a task gets a
 * single "shoot date" instead of start+due is decided by a case-insensitive
 * match on the stage NAME, not by any schema flag. Renaming a department's
 * "Shoot" stage silently changes this behaviour on both clients. Do not
 * "improve" it to a column unless the web app changes at the same time, or the
 * two clients will disagree about which stage gets single-date treatment.
 */
export function isShootStage(stageName: string | null | undefined): boolean {
  return (stageName ?? '').toLowerCase() === 'shoot';
}

/** The stage move. One column, one row — identical to the web board's drop write. */
export async function moveTaskStage(taskId: string, stageId: string) {
  const { error } = await supabase
    .from('tasks')
    .update({ current_stage_id: stageId })
    .eq('id', taskId);
  if (error) throw error;
}

export type SaveTaskInput = {
  taskId: string;
  title: string;
  description: string;
  priority: TaskPriority;
  assigned_to: string | null;
  current_stage_id: string;
  start_date: string;
  due_date: string;
  isShoot: boolean;
  creativesToAdd: string[];
  creativesToRemove: string[];
};

/**
 * Web parity, including the order: the task row first, then creative ADDITIONS
 * before REMOVALS, so a failed insert never leaves the task stripped of its
 * existing collaborators.
 */
export async function saveTask(input: SaveTaskInput) {
  const { error } = await supabase
    .from('tasks')
    .update({
      title: input.title,
      description: input.description || null,
      priority: input.priority,
      assigned_to: input.assigned_to || null,
      current_stage_id: input.current_stage_id,
      start_date: input.start_date || null,
      due_date: input.isShoot ? input.start_date || null : input.due_date || null,
    })
    .eq('id', input.taskId);
  if (error) throw error;

  if (input.creativesToAdd.length > 0) {
    const { error: addError } = await supabase
      .from('task_creatives')
      .insert(input.creativesToAdd.map((profile_id) => ({ task_id: input.taskId, profile_id })));
    if (addError) throw addError;
  }
  if (input.creativesToRemove.length > 0) {
    const { error: removeError } = await supabase
      .from('task_creatives')
      .delete()
      .eq('task_id', input.taskId)
      .in('profile_id', input.creativesToRemove);
    if (removeError) throw removeError;
  }
}

export async function deleteTask(taskId: string) {
  const { error } = await supabase.from('tasks').delete().eq('id', taskId);
  if (error) throw error;
}

export type CreateTaskInput = {
  project_id: string;
  department_id: string;
  /** The department's lowest-position stage — new tasks always start there. */
  current_stage_id: string;
  title: string;
  description: string;
  priority: TaskPriority;
  start_date: string;
  due_date: string;
  isShoot: boolean;
  assigned_to: string | null;
  creativeProfileIds: string[];
  userId: string;
};

/**
 * No rollback here, matching the web: a failed `task_creatives` insert leaves
 * the task in place. That differs from `createProject`, which does roll
 * back — the difference is in the source, so this stays as-is. The web also
 * never checks that insert's error at all (NewTaskDialog just awaits it), so
 * a creatives failure here is deliberately swallowed too, for parity.
 */
export async function createTask(input: CreateTaskInput): Promise<string> {
  const { data, error } = await supabase
    .from('tasks')
    .insert({
      project_id: input.project_id,
      department_id: input.department_id,
      current_stage_id: input.current_stage_id,
      title: input.title,
      description: input.description || null,
      priority: input.priority,
      start_date: input.start_date,
      due_date: input.isShoot ? input.start_date : input.due_date,
      assigned_to: input.assigned_to || null,
      created_by: input.userId,
    })
    .select('id')
    .single();
  if (error) throw error;
  if (!data) throw new Error('Task insert returned no row');

  const taskId = data.id as string;
  if (input.creativeProfileIds.length > 0) {
    await supabase
      .from('task_creatives')
      .insert(input.creativeProfileIds.map((profile_id) => ({ task_id: taskId, profile_id })));
  }
  return taskId;
}

import { useQuery } from '@tanstack/react-query';
import { supabase } from '../supabase';
import { qk } from './keys';
import { one } from '../data';
import type { LaidOutEvent } from '../calendar-layout';
import { isMine, taskKinds, type TaskKind } from '@shared/task-filters';

/**
 * The calendar shows TASKS ONLY.
 *
 * It used to read the `calendar_events` view through get_calendar_events, which
 * unions tasks with project start/end spans and submitted deliverables. Project
 * bars ran 12-19 days and dominated the grid, so they are gone — and with two
 * thirds of that union discarded, going straight at `tasks` is both leaner and
 * gives us `assigned_to`, which the RPC never returned and the "Mine" filter
 * needs.
 *
 * No date range: `useAllTasks` already fetches every task unfiltered, so the
 * scale is proven. One cache entry means paging months and flipping All/Mine
 * are pure client-side work with no refetch.
 */

type ProfileName = { profiles: { full_name: string } | { full_name: string }[] | null };

export type CalendarTaskRow = {
  id: string;
  title: string;
  start_date: string | null;
  due_date: string | null;
  assigned_to: string | null;
  project_id: string;
  follows_task_id: string | null;
  department_id: string;
  department_stages:
    | { color: string | null; position?: number }
    | { color: string | null; position?: number }[]
    | null;
  employees: ProfileName | ProfileName[] | null;
  task_creatives: { profile_id: string; employees: ProfileName | ProfileName[] | null }[] | null;
};

export type CalendarTask = LaidOutEvent & {
  assignedTo: string | null;
  assigneeName: string | null;
  projectId: string;
  /** Creatives on the task — it is theirs as much as the assignee's. */
  creatives: { id: string; name: string }[];
  kind: TaskKind;
};

/** Calendar view: every task, only shoots, only edits, or project timelines. */
export type CalendarKind = 'tasks' | 'shoot' | 'edit' | 'projects';

const nameOf = (e: ProfileName | ProfileName[] | null) => one(one(e)?.profiles ?? null)?.full_name ?? null;

/** The view's fallback when a stage has no colour of its own. */
const DEFAULT_TASK_COLOR = '#6366f1';

/**
 * A task occupies [start_date, due_date]. Either may be null — the query keeps
 * a task with only one of them — so each falls back to the other, giving a
 * single-day bar rather than an unbounded or zero-width one.
 */
export function toCalendarTask(row: CalendarTaskRow, kind: TaskKind = 'other'): CalendarTask | null {
  const day = row.start_date ?? row.due_date;
  const endDay = row.due_date ?? row.start_date;
  if (!day || !endDay) return null;
  return {
    id: row.id,
    title: row.title,
    day,
    // A due date before the start date would give a negative span and break
    // the lane packer. Clamp rather than trust the row.
    endDay: endDay < day ? day : endDay,
    color: one(row.department_stages)?.color ?? DEFAULT_TASK_COLOR,
    assignedTo: row.assigned_to,
    assigneeName: nameOf(row.employees),
    projectId: row.project_id,
    creatives: (row.task_creatives ?? []).map((c) => ({ id: c.profile_id, name: nameOf(c.employees) ?? 'Unknown' })),
    kind,
  };
}

export function useCalendarTasks() {
  return useQuery({
    queryKey: qk.calendarTasks(),
    queryFn: async (): Promise<CalendarTask[]> => {
      // `department_stages!current_stage_id` names the FK because `tasks` has
      // more than one join path into that table. RLS scopes the rows.
      const [tasksRes, shootRes] = await Promise.all([
        supabase
          .from('tasks')
          .select(
            'id, title, start_date, due_date, assigned_to, project_id, follows_task_id, department_id, department_stages!current_stage_id(color, position), employees!assigned_to(profiles(full_name)), task_creatives(profile_id, employees(profiles(full_name)))'
          )
          .or('start_date.not.is.null,due_date.not.is.null'),
        // Each department's "Shoot" stage, to tell shoots from edits.
        supabase.from('department_stages').select('department_id, position').ilike('name', 'shoot'),
      ]);
      if (tasksRes.error) throw tasksRes.error;
      if (shootRes.error) throw shootRes.error;
      const rows = (tasksRes.data ?? []) as unknown as CalendarTaskRow[];
      const shootPositions: Record<string, number> = {};
      for (const s of (shootRes.data ?? []) as { department_id: string; position: number }[]) {
        shootPositions[s.department_id] ??= s.position;
      }
      // Classified across every row, so an edit task marks its shoot even when
      // only one of the pair is dated.
      const kinds = taskKinds(
        rows.map((r) => ({
          id: r.id,
          follows_task_id: r.follows_task_id,
          department_id: r.department_id,
          stage_position: one(r.department_stages)?.position ?? null,
        })),
        shootPositions
      );
      return rows
        .map((r) => toCalendarTask(r, kinds.get(r.id)))
        .filter((t): t is CalendarTask => t !== null);
    },
  });
}

/**
 * `all` keeps everything, `mine` resolves to the signed-in user, and any other
 * value is treated as the profile id of the person being viewed.
 */
export type CalendarScope = 'all' | 'mine' | (string & {});

export function filterByAssignee(
  tasks: CalendarTask[],
  scope: CalendarScope,
  userId: string | undefined
): CalendarTask[] {
  if (scope === 'all') return tasks;
  const target = scope === 'mine' ? userId : scope;
  // Fail closed. Showing everything when the target cannot be resolved would
  // put the whole agency's work under a filter naming one person.
  if (!target) return [];
  return tasks.filter((t) => isMine({ assignedTo: t.assignedTo, creativeIds: t.creatives.map((c) => c.id) }, target));
}

export function filterByKind(tasks: CalendarTask[], kind: CalendarKind): CalendarTask[] {
  if (kind === 'tasks' || kind === 'projects') return tasks;
  return tasks.filter((t) => t.kind === kind);
}

/**
 * People who actually hold a dated task, for the executive's person picker.
 * Derived from the rows already fetched rather than a second employees query —
 * and it means the picker never offers someone with an empty calendar.
 */
export function calendarAssignees(tasks: CalendarTask[]): { id: string; name: string }[] {
  const byId = new Map<string, string>();
  for (const t of tasks) {
    if (t.assignedTo && !byId.has(t.assignedTo)) {
      byId.set(t.assignedTo, t.assigneeName ?? 'Unknown');
    }
    for (const c of t.creatives) if (!byId.has(c.id)) byId.set(c.id, c.name);
  }
  return [...byId.entries()]
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

// ---------------------------------------------------------------------------
// Project timelines — their own view, never mixed into the task bars (12-19
// day project spans used to drown out the tasks; see the note at the top).

export type CalendarProjectRow = {
  id: string;
  name: string;
  start_date: string | null;
  target_end_date: string | null;
  project_creatives: { profile_id: string }[] | null;
};

export type CalendarProject = LaidOutEvent & { projectId: string; creativeIds: string[] };

const PROJECT_COLOR = '#a1a1aa';

export function toCalendarProject(row: CalendarProjectRow): CalendarProject | null {
  const day = row.start_date ?? row.target_end_date;
  const endDay = row.target_end_date ?? row.start_date;
  if (!day || !endDay) return null;
  return {
    id: row.id,
    projectId: row.id,
    title: row.name,
    day,
    endDay: endDay < day ? day : endDay,
    color: PROJECT_COLOR,
    creativeIds: (row.project_creatives ?? []).map((c) => c.profile_id),
  };
}

/**
 * A person's projects are the ones they are a creative on or hold a task in.
 * `tasks` is every calendar task (not the filtered set).
 */
export function filterProjects(
  projects: CalendarProject[],
  tasks: CalendarTask[],
  scope: CalendarScope,
  userId: string | undefined
): CalendarProject[] {
  if (scope === 'all') return projects;
  const target = scope === 'mine' ? userId : scope;
  if (!target) return [];
  const withTasks = new Set(filterByAssignee(tasks, target, undefined).map((t) => t.projectId));
  return projects.filter((p) => p.creativeIds.includes(target) || withTasks.has(p.projectId));
}

export function useCalendarProjects(enabled: boolean) {
  return useQuery({
    queryKey: qk.calendarProjects(),
    enabled,
    queryFn: async (): Promise<CalendarProject[]> => {
      const { data, error } = await supabase
        .from('projects')
        .select('id, name, start_date, target_end_date, project_creatives(profile_id)')
        .or('start_date.not.is.null,target_end_date.not.is.null');
      if (error) throw error;
      return ((data ?? []) as unknown as CalendarProjectRow[])
        .map(toCalendarProject)
        .filter((p): p is CalendarProject => p !== null);
    },
  });
}

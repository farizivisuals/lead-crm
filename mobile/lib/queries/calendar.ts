import { useQuery } from '@tanstack/react-query';
import { supabase } from '../supabase';
import { qk } from './keys';
import { one } from '../data';
import type { LaidOutEvent } from '../calendar-layout';

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

export type CalendarTaskRow = {
  id: string;
  title: string;
  start_date: string | null;
  due_date: string | null;
  assigned_to: string | null;
  project_id: string;
  department_stages: { color: string | null } | { color: string | null }[] | null;
};

export type CalendarTask = LaidOutEvent & {
  assignedTo: string | null;
  projectId: string;
};

/** The view's fallback when a stage has no colour of its own. */
const DEFAULT_TASK_COLOR = '#6366f1';

/**
 * A task occupies [start_date, due_date]. Either may be null — the query keeps
 * a task with only one of them — so each falls back to the other, giving a
 * single-day bar rather than an unbounded or zero-width one.
 */
export function toCalendarTask(row: CalendarTaskRow): CalendarTask | null {
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
    projectId: row.project_id,
  };
}

export function useCalendarTasks() {
  return useQuery({
    queryKey: qk.calendarTasks(),
    queryFn: async (): Promise<CalendarTask[]> => {
      // `department_stages!current_stage_id` names the FK because `tasks` has
      // more than one join path into that table. RLS scopes the rows.
      const { data, error } = await supabase
        .from('tasks')
        .select(
          'id, title, start_date, due_date, assigned_to, project_id, department_stages!current_stage_id(color)'
        )
        .or('start_date.not.is.null,due_date.not.is.null');
      if (error) throw error;
      return ((data ?? []) as unknown as CalendarTaskRow[])
        .map(toCalendarTask)
        .filter((t): t is CalendarTask => t !== null);
    },
  });
}

/** `mine` keeps only what is assigned to this user; `all` keeps everything. */
export function filterByAssignee(
  tasks: CalendarTask[],
  scope: 'all' | 'mine',
  userId: string | undefined
): CalendarTask[] {
  if (scope === 'all') return tasks;
  if (!userId) return [];
  return tasks.filter((t) => t.assignedTo === userId);
}

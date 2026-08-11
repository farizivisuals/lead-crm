import type { EmployeeRole } from '@shared/types';

/**
 * Supabase returns an embedded to-one relation as a bare object in some query
 * shapes and as a single-element array in others. The web app checks
 * `Array.isArray()` defensively at every such site (porting brief §3); this is
 * that check, once. Never index `[0]` directly and never assume an object.
 */
export function one<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

export type TaskProgressRow = {
  project_id: string;
  department_stages:
    | { is_terminal: boolean }
    | { is_terminal: boolean }[]
    | null;
};

export type Progress = { total: number; done: number };

/**
 * Reduce a flat, unfiltered task list into per-project { total, done }.
 * The source query deliberately has no project filter — RLS already scopes
 * `tasks` to the projects the caller can see, so every returned row belongs to
 * a project that is also in the projects list.
 */
export function taskProgress(rows: TaskProgressRow[]): Record<string, Progress> {
  const map: Record<string, Progress> = {};
  for (const row of rows) {
    const entry = (map[row.project_id] ??= { total: 0, done: 0 });
    entry.total += 1;
    if (one(row.department_stages)?.is_terminal) entry.done += 1;
  }
  return map;
}

/**
 * Web parity (`isTaskOverdue` in components/kanban/StageBoard.tsx): a task is
 * overdue when its due date is strictly in the past AND its current stage is
 * not terminal. ISO date strings compare lexicographically, so no Date object
 * and no timezone are involved.
 */
export function isTaskOverdue(
  dueDate: string | null,
  isTerminal: boolean,
  today: string = new Date().toISOString().slice(0, 10)
): boolean {
  if (!dueDate || isTerminal) return false;
  return dueDate.slice(0, 10) < today;
}

export type StageLike = {
  id: string;
  name: string;
  position: number;
  is_terminal: boolean;
  color: string | null;
};

/**
 * Stage chips: preserves the stages' incoming order (already `.order('position')`
 * from the query) and counts the tasks currently sitting in each one.
 */
export function countByStage<S extends StageLike>(
  stages: S[],
  tasks: { current_stage_id: string }[]
): { stage: S; count: number }[] {
  return stages.map((stage) => ({
    stage,
    count: tasks.filter((t) => t.current_stage_id === stage.id).length,
  }));
}

export type EmployeeDeptRow = {
  department_id: string;
  departments?: { slug: string } | null;
};

/**
 * Port of `isCreativeEmployee()` from lib/auth/guards.ts:63-68, kept
 * semantically identical. It is NOT imported from `@shared` because guards.ts
 * imports `next/navigation`, `react.cache` and the server Supabase client,
 * none of which resolve under Metro. Mirrors `is_creative()` in migration 0019.
 * Note an executive who sits in the creatives department is NOT "creative" by
 * this helper — executives get moodboard rights via isExecutive instead.
 */
export function isCreativeEmployee(
  employee:
    | { role: EmployeeRole; employee_departments?: EmployeeDeptRow[] }
    | null
    | undefined
): boolean {
  return (
    employee?.role === 'employee' &&
    (employee.employee_departments ?? []).some(
      (d) => d.departments?.slug === 'creatives'
    )
  );
}

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

/**
 * '2026-08-11' -> 'Aug 11'. Split into calendar parts by hand rather than
 * passed through `new Date()`, because `new Date('2026-08-11')` parses as
 * midnight UTC and renders as the previous day on any device west of GMT.
 * These columns are DATE, not TIMESTAMPTZ — they have no time zone to respect.
 */
export function shortDate(iso: string | null): string {
  if (!iso) return '—';
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  if (!y || !m || !d || m < 1 || m > 12) return '—';
  return `${MONTHS[m - 1]} ${d}`;
}

/** Activity feed timestamps. `created_at` IS a timestamptz, so Date is correct here. */
export function relativeTime(iso: string, now: number = Date.now()): string {
  const mins = Math.floor(Math.max(0, now - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return `${Math.floor(days / 7)}w ago`;
}

/** Web parity: task cards show the assignee's first name only. */
export function firstName(fullName: string | null | undefined): string {
  return (fullName ?? '').split(' ')[0] || '—';
}

export type AssigneeRow = {
  assigned_to: string | null;
  employees?:
    | { profiles?: { full_name: string } | null }
    | { profiles?: { full_name: string } | null }[]
    | null;
};

/**
 * My Tasks' assignee filter is populated from the assignees actually present
 * in the fetched rows, not from a separate employees query (web parity —
 * TasksList.tsx's useMemo). Unassigned rows are excluded; the screen adds its
 * own "Unassigned" option.
 */
export function distinctAssignees(rows: AssigneeRow[]): { id: string; name: string }[] {
  const map = new Map<string, string>();
  for (const row of rows) {
    if (!row.assigned_to || map.has(row.assigned_to)) continue;
    map.set(row.assigned_to, one(row.employees)?.profiles?.full_name ?? 'Unknown');
  }
  return [...map.entries()]
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Executive dashboard, department-filtered branch: counts DISTINCT clients
 * across the department's projects. A plain row count double-counts any client
 * with two or more projects in that department (porting brief §1A item 2).
 */
export function distinctClientCount(
  rows: { projects: { client_id: string } | { client_id: string }[] | null }[]
): number {
  const ids = new Set<string>();
  for (const row of rows) {
    const clientId = one(row.projects)?.client_id;
    if (clientId) ids.add(clientId);
  }
  return ids.size;
}

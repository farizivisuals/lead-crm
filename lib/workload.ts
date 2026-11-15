// Workload: how booked each employee is in a month, plus what's on their plate
// right now. Shared by the web Workload page and the mobile screen
// (@shared/workload), so it stays free of app imports.
// Design: docs/superpowers/specs/2026-11-15-workload-design.md

import type { EmployeeRole } from "./types";

type Db = { from(table: string): any };

export type WorkloadInput = {
  employees: { id: string; name: string; role: EmployeeRole }[];
  tasks: { id: string; assigned_to: string | null; start_date: string | null; due_date: string | null; client_id: string | null; open: boolean }[];
  creatives: { task_id: string; profile_id: string }[];
  /** Video phases: `current` = the video is at this phase now; `open` = its task isn't finished. */
  phases: { assigned_to: string | null; scheduled_date: string | null; client_id: string | null; current: boolean; open: boolean }[];
};

export type WorkloadRow = {
  id: string;
  name: string;
  role: EmployeeRole;
  /** Tasks + video phases on each working day of the month (0 = free). */
  perDay: number[];
  /** Days with at least one thing on. */
  bookedCount: number;
  /** Open tasks: assigned to them plus the ones they're a creative on. */
  tasks: number;
  /** Of `tasks`, how many are as a creative. */
  creativeTasks: number;
  videos: number;
  clients: number;
  overdue: number;
};

const iso = (d: Date) => d.toISOString().slice(0, 10);

/** Sunday–Thursday dates ("YYYY-MM-DD") of a month; `month` is 0-based. */
export function workingDays(year: number, month: number): string[] {
  const out: string[] = [];
  for (let d = new Date(Date.UTC(year, month, 1)); d.getUTCMonth() === month; d.setUTCDate(d.getUTCDate() + 1)) {
    if (d.getUTCDay() <= 4) out.push(iso(d));
  }
  return out;
}

/** Today in Kuwait, "YYYY-MM-DD". */
export const kuwaitToday = () => new Date(Date.now() + 3 * 3600_000).toISOString().slice(0, 10);

/** Bar colour: under half booked, up to 79%, or 80% and over. */
export function loadLevel(booked: number, total: number): "low" | "mid" | "high" {
  const pct = total ? booked / total : 0;
  return pct >= 0.8 ? "high" : pct >= 0.5 ? "mid" : "low";
}

export function computeWorkload(input: WorkloadInput, days: string[], today: string): WorkloadRow[] {
  const taskById = new Map(input.tasks.map((t) => [t.id, t]));
  const rows = input.employees.map((e): WorkloadRow => {
    const assigned = input.tasks.filter((t) => t.assigned_to === e.id);
    // A creative's shoots are their work too (finished ones still book past days).
    const asCreative = input.creatives
      .filter((c) => c.profile_id === e.id)
      .map((c) => taskById.get(c.task_id))
      .filter((t): t is NonNullable<typeof t> => !!t && t.assigned_to !== e.id);
    const all = [...assigned, ...asCreative];
    const open = assigned.filter((t) => t.open);
    const openCreative = asCreative.filter((t) => t.open);
    const phases = input.phases.filter((p) => p.assigned_to === e.id);
    const waiting = phases.filter((p) => p.current && p.open);

    const perDay = days.map(
      (day) =>
        all.filter((t) => {
          const s = t.start_date ?? t.due_date;
          const end = t.due_date ?? t.start_date;
          return !!s && !!end && s <= day && day <= end;
        }).length + phases.filter((p) => p.scheduled_date === day).length
    );
    const clients = new Set(
      [...open, ...openCreative, ...waiting].map((x) => x.client_id).filter((c): c is string => !!c)
    );
    return {
      id: e.id,
      name: e.name,
      role: e.role,
      perDay,
      bookedCount: perDay.filter((n) => n > 0).length,
      tasks: open.length + openCreative.length,
      creativeTasks: openCreative.length,
      videos: waiting.length,
      clients: clients.size,
      overdue: open.filter((t) => t.due_date && t.due_date < today).length,
    };
  });
  return rows
    .filter((r) => r.role === "employee" || r.role === "manager" || r.bookedCount + r.tasks + r.videos > 0)
    .sort((a, b) => b.bookedCount - a.bookedCount || b.tasks - a.tasks || a.name.localeCompare(b.name));
}

type Rel<T> = T | T[] | null;
const one = <T>(v: Rel<T>): T | null => (Array.isArray(v) ? v[0] ?? null : v);

/**
 * Loads everything computeWorkload needs. Executives can read all of it (RLS).
 * ponytail: fetches every task; filter by date if the table ever gets big.
 */
export async function loadWorkload(db: Db, year: number, month: number): Promise<{ rows: WorkloadRow[]; days: string[] }> {
  const [emps, tasks, creatives, phases] = await Promise.all([
    db.from("employees").select("profile_id, role, profiles(full_name)"),
    db.from("tasks").select("id, assigned_to, start_date, due_date, projects(client_id), department_stages!current_stage_id(is_terminal)"),
    db.from("task_creatives").select("task_id, profile_id"),
    db
      .from("task_deliverable_assignments")
      .select("assigned_to, scheduled_date, stage_id, task_deliverables!inner(current_stage_id, tasks!inner(projects(client_id), department_stages!current_stage_id(is_terminal)))"),
  ]);
  for (const r of [emps, tasks, creatives, phases]) if (r.error) throw r.error;

  const input: WorkloadInput = {
    employees: (emps.data ?? []).map((e: any) => ({
      id: e.profile_id,
      name: one<{ full_name: string }>(e.profiles)?.full_name?.trim() || "Unknown",
      role: e.role,
    })),
    tasks: (tasks.data ?? []).map((t: any) => ({
      id: t.id,
      assigned_to: t.assigned_to,
      start_date: t.start_date,
      due_date: t.due_date,
      client_id: one<{ client_id: string }>(t.projects)?.client_id ?? null,
      open: !one<{ is_terminal: boolean }>(t.department_stages)?.is_terminal,
    })),
    creatives: creatives.data ?? [],
    phases: (phases.data ?? []).map((p: any) => {
      const d = one<any>(p.task_deliverables);
      const t = one<any>(d?.tasks);
      return {
        assigned_to: p.assigned_to,
        scheduled_date: p.scheduled_date,
        client_id: one<{ client_id: string }>(t?.projects)?.client_id ?? null,
        current: d?.current_stage_id === p.stage_id,
        open: !one<{ is_terminal: boolean }>(t?.department_stages)?.is_terminal,
      };
    }),
  };
  const days = workingDays(year, month);
  return { rows: computeWorkload(input, days, kuwaitToday()), days };
}

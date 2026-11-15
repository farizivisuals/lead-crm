import { createClient } from "@/lib/supabase/server";
import CompanyCalendar from "@/components/calendar/CompanyCalendar";
import type { CalendarEvent } from "@/lib/types";
import { Calendar, Clock, ArrowUpRight } from "lucide-react";
import MineToggle from "@/components/filters/MineToggle";
import EmployeeFilter from "@/components/filters/EmployeeFilter";
import { isExecutive } from "@/lib/rbac";
import { requireEmployee } from "@/lib/auth/guards";
import { myTaskFilter, taskKinds, type TaskKind } from "@/lib/task-filters";
import Link from "next/link";

const KINDS = [
  { value: "tasks", label: "All" },
  { value: "shoot", label: "Shoots" },
  { value: "edit", label: "Edits" },
  { value: "projects", label: "Projects" },
] as const;
type Kind = (typeof KINDS)[number]["value"];

interface Props {
  searchParams: Promise<{ mine?: string; emp?: string; kind?: string }>;
}

export default async function CalendarPage({ searchParams }: Props) {
  const { mine, emp, kind: kindParam } = await searchParams;
  const isMine = mine === "1";
  const kind: Kind = KINDS.some((k) => k.value === kindParam) ? (kindParam as Kind) : "tasks";

  const [{ user, employee }, supabase] = await Promise.all([requireEmployee(), createClient()]);
  const isExec = isExecutive(employee?.role ?? "employee");
  // Whose calendar: an employee an executive picked, me, or everyone.
  const target = isExec && emp ? emp : isMine && user ? user.id : null;

  let tasksQuery = supabase
    .from("tasks")
    .select("id, title, start_date, due_date, department_id, project_id, priority, assigned_to, follows_task_id, department_stages!current_stage_id(color), departments(name), projects(clients(company_name))")
    .order("created_at");

  // Someone's tasks include the ones they are a creative on.
  if (target) tasksQuery = tasksQuery.or(await myTaskFilter(supabase, target));

  // Scheduled deliverable phases (e.g. "Video 1 Shoot") with a date set.
  let delivQuery = supabase
    .from("task_deliverable_assignments")
    .select(
      "deliverable_id, stage_id, scheduled_date, assigned_to, department_stages(name, color, position), task_deliverables!inner(title, tasks!inner(project_id, department_id, projects(clients(company_name))))"
    )
    .not("scheduled_date", "is", null);

  if (isExec && emp) {
    delivQuery = delivQuery.eq("assigned_to", emp);
  } else if (isMine && user) {
    delivQuery = delivQuery.eq("assigned_to", user.id);
  }

  const [{ data: tasks }, { data: delivRows }, { data: employees }, { data: stageRows }, { data: projectRows }] =
    await Promise.all([
      tasksQuery,
      delivQuery,
      // Executives can filter by a specific employee; everyone else only mine/all.
      isExec
        ? supabase.from("employees").select("profile_id, profiles(full_name)").order("role")
        : Promise.resolve({ data: [] as { profile_id: string; profiles: unknown }[] }),
      supabase
        .from("department_stages")
        .select("name, position, color, department_id, departments(name)")
        .order("position"),
      kind === "projects"
        ? supabase
            .from("projects")
            .select("id, name, start_date, target_end_date, project_creatives(profile_id), clients(company_name)")
            .or("start_date.not.is.null,target_end_date.not.is.null")
        : Promise.resolve({ data: [] as never[] }),
    ]);

  // Each department's "Shoot" stage, to tell shoots from edits.
  const shootPositions: Record<string, number> = {};
  for (const s of stageRows ?? []) {
    if (s.name.toLowerCase() === "shoot") shootPositions[s.department_id] ??= s.position;
  }
  const kinds = taskKinds(
    (tasks ?? []).map((t) => ({
      id: t.id,
      follows_task_id: t.follows_task_id,
      department_id: t.department_id,
    })),
    shootPositions
  );
  const keep = (k: TaskKind) => kind === "tasks" || kind === k;

  const empList = (employees ?? []).map((e) => ({
    id: e.profile_id,
    name: (e.profiles as unknown as { full_name: string } | null)?.full_name ?? "Unknown",
  }));

  const datedEvents: CalendarEvent[] = (tasks ?? [])
    .filter((t) => (t.start_date || t.due_date) && keep(kinds.get(t.id) ?? "other"))
    .map((t) => {
      const clientName = (t.projects as unknown as { clients?: { company_name: string } } | null)?.clients?.company_name;
      return {
        id: t.id,
        entity_id: t.id,
        entity_type: "task" as const,
        title: clientName ? `${t.title} - ${clientName}` : t.title,
        start: t.start_date ?? t.due_date ?? "",
        end: t.due_date ?? null,
        color: (t.department_stages as unknown as { color: string } | null)?.color ?? "#71717a",
        department_id: t.department_id,
        client_id: null,
        project_id: t.project_id,
      };
    });

  const deliverableEvents: CalendarEvent[] = (delivRows ?? [])
    .filter((r) => {
      // A deliverable's phase is a shoot up to the Shoot stage, an edit after.
      const pos = (r.department_stages as unknown as { position: number } | null)?.position;
      const deptId = (r.task_deliverables as unknown as { tasks: { department_id: string } }).tasks.department_id;
      const shootPos = shootPositions[deptId];
      return keep(shootPos == null || pos == null ? "other" : pos <= shootPos ? "shoot" : "edit");
    })
    .map((r) => {
    const stage = r.department_stages as unknown as { name: string; color: string | null } | null;
    const td = r.task_deliverables as unknown as {
      title: string;
      tasks: {
        project_id: string;
        department_id: string;
        projects: { clients?: { company_name: string } | null } | null;
      };
    };
    const clientName = td.tasks.projects?.clients?.company_name;
    const label = `${td.title} ${stage?.name ?? ""}`.trim();
    return {
      id: `${r.deliverable_id}-${r.stage_id}`,
      entity_id: `${r.deliverable_id}-${r.stage_id}`,
      entity_type: "task" as const,
      title: clientName ? `${clientName} · ${label}` : label,
      start: r.scheduled_date as string,
      end: null,
      color: stage?.color ?? "#71717a",
      department_id: td.tasks.department_id,
      client_id: null,
      project_id: td.tasks.project_id,
    };
  });

  // Project timelines: a person's projects are the ones they are a creative on
  // or hold a task in.
  const targetProjects = new Set((tasks ?? []).map((t) => t.project_id));
  const projectEvents: CalendarEvent[] = (projectRows ?? [])
    .filter(
      (p) =>
        !target ||
        targetProjects.has(p.id) ||
        ((p.project_creatives ?? []) as { profile_id: string }[]).some((c) => c.profile_id === target)
    )
    .map((p) => {
      const clientName = (p.clients as unknown as { company_name: string } | null)?.company_name;
      return {
        id: p.id,
        entity_id: p.id,
        entity_type: "project" as const,
        title: clientName ? `${p.name} - ${clientName}` : p.name,
        start: (p.start_date ?? p.target_end_date) as string,
        end: p.target_end_date ?? null,
        color: "#a1a1aa",
        department_id: null,
        client_id: null,
        project_id: p.id,
      };
    });

  const allEvents = kind === "projects" ? projectEvents : [...datedEvents, ...deliverableEvents];

  const undatedTasks =
    kind === "tasks" ? (tasks ?? []).filter((t) => !t.start_date && !t.due_date) : [];

  const kindHref = (k: Kind) => {
    const params = new URLSearchParams();
    if (isMine) params.set("mine", "1");
    if (emp) params.set("emp", emp);
    if (k !== "tasks") params.set("kind", k);
    const q = params.toString();
    return q ? `?${q}` : "?";
  };

  const PRIORITY_COLOR: Record<string, string> = {
    low: "bg-white/20",
    medium: "bg-blue-400",
    high: "bg-orange-400",
    urgent: "bg-red-400",
  };

  // Legend mirrors the real stage colours, grouped by department, so every hue
  // on the calendar is accounted for.
  const legend = new Map<string, { name: string; color: string }[]>();
  for (const s of stageRows ?? []) {
    const dept = (s.departments as unknown as { name: string } | null)?.name;
    if (!dept) continue;
    if (!legend.has(dept)) legend.set(dept, []);
    legend.get(dept)!.push({ name: s.name, color: s.color ?? "#71717a" });
  }

  return (
    <div className="space-y-6 animate-slide-up">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Calendar className="h-4 w-4 text-zinc-400" />
            <span className="text-xs text-zinc-400 font-medium uppercase tracking-widest">Schedule</span>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            {emp
              ? `${empList.find((e) => e.id === emp)?.name ?? "Employee"}'s Calendar`
              : isMine
              ? "My Calendar"
              : "Company Calendar"}
          </h1>
          <p className="text-white/40 text-sm mt-1">
            {emp
              ? "Tasks for this employee, including ones they're a creative on."
              : isMine
              ? "Your tasks, including ones you're a creative on."
              : "All tasks and deadlines across every client."}
          </p>
        </div>

        <div className="flex-shrink-0 mt-1">
          {isExec ? (
            <EmployeeFilter employees={empList} selected={emp ? emp : isMine ? "me" : "all"} />
          ) : (
            <MineToggle isMine={isMine} />
          )}
        </div>
      </div>

      {/* All / Shoots / Edits / Projects */}
      <div className="flex gap-2 flex-wrap">
        {KINDS.map((k) => (
          <Link
            key={k.value}
            href={kindHref(k.value)}
            className={`h-8 px-3 inline-flex items-center rounded-xl border text-xs font-medium transition-all duration-150 ${
              kind === k.value
                ? "bg-white/[0.1] border-white/[0.2] text-zinc-200"
                : "bg-white/[0.05] border-white/[0.09] text-white/50 hover:text-white/80 hover:bg-white/[0.08]"
            }`}
          >
            {k.label}
          </Link>
        ))}
      </div>

      {/* Legend — one row per department, one swatch per stage */}
      <div className="rounded-2xl bg-white/[0.03] border border-white/[0.07] px-4 py-3 space-y-2">
        {[...legend.entries()].map(([dept, stages]) => (
          <div key={dept} className="flex items-center gap-3 flex-wrap">
            <span className="text-xs font-semibold text-white/50 w-20 flex-shrink-0">
              {dept}
            </span>
            <div className="flex gap-3 flex-wrap">
              {stages.map((s) => (
                <div key={`${dept}-${s.name}`} className="flex items-center gap-1.5">
                  <span
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: s.color, boxShadow: `0 0 6px ${s.color}80` }}
                  />
                  <span className="text-xs text-white/40">{s.name}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Calendar */}
      <CompanyCalendar events={allEvents} />

      {/* Unscheduled tasks */}
      {undatedTasks.length > 0 && (
        <div className="rounded-2xl bg-white/[0.04] backdrop-blur-xl border border-white/[0.08] p-5">
          <div className="flex items-center gap-2.5 mb-1">
            <Clock className="h-4 w-4 text-amber-400" />
            <h2 className="font-semibold text-white/90">Unscheduled tasks</h2>
            <span className="text-xs text-white/30 bg-white/[0.07] border border-white/[0.08] px-2 py-0.5 rounded-full font-medium">
              {undatedTasks.length}
            </span>
          </div>
          <p className="text-xs text-white/30 mb-4 leading-relaxed">
            These tasks have no start or due date — open the task to schedule it and it will appear on the calendar.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {undatedTasks.map((task) => (
              <a
                key={task.id}
                href={`/admin/projects/${task.project_id}/tasks`}
                className="group flex items-center gap-3 px-3 py-2.5 rounded-xl border border-white/[0.07] bg-white/[0.02] hover:bg-white/[0.06] hover:border-white/[0.14] transition-all duration-150"
              >
                <span
                  className={`w-2 h-2 rounded-full flex-shrink-0 ${PRIORITY_COLOR[task.priority as string] ?? "bg-white/20"}`}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-white/70 group-hover:text-white truncate transition-colors">
                    {task.title}
                  </p>
                  <p className="text-xs text-white/30 truncate">
                    {(task.departments as unknown as { name: string } | null)?.name}
                  </p>
                </div>
                <ArrowUpRight className="h-3.5 w-3.5 text-white/20 group-hover:text-white/50 flex-shrink-0 transition-colors" />
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

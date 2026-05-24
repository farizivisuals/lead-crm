import { createClient } from "@/lib/supabase/server";
import CompanyCalendar from "@/components/calendar/CompanyCalendar";
import type { CalendarEvent } from "@/lib/types";
import { Calendar, Clock, ArrowUpRight } from "lucide-react";
import MineToggle from "@/components/filters/MineToggle";

interface Props {
  searchParams: Promise<{ mine?: string }>;
}

export default async function CalendarPage({ searchParams }: Props) {
  const { mine } = await searchParams;
  const isMine = mine === "1";

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let tasksQuery = supabase
    .from("tasks")
    .select("id, title, start_date, due_date, department_id, project_id, priority, assigned_to, department_stages!current_stage_id(color), departments(name)")
    .order("created_at");

  if (isMine && user) {
    tasksQuery = tasksQuery.eq("assigned_to", user.id);
  }

  const [{ data: tasks }, { data: projects }] = await Promise.all([
    tasksQuery,
    supabase
      .from("projects")
      .select("id, name, start_date, target_end_date, client_id")
      .or("start_date.not.is.null,target_end_date.not.is.null"),
  ]);

  const datedEvents: CalendarEvent[] = (tasks ?? [])
    .filter((t) => t.start_date || t.due_date)
    .map((t) => ({
      id: t.id,
      entity_id: t.id,
      entity_type: "task" as const,
      title: t.title,
      start: t.start_date ?? t.due_date ?? "",
      end: t.due_date ?? null,
      color: (t.department_stages as unknown as { color: string } | null)?.color ?? "#6366f1",
      department_id: t.department_id,
      client_id: null,
      project_id: t.project_id,
    }));

  const undatedTasks = (tasks ?? []).filter((t) => !t.start_date && !t.due_date);

  const projectEvents: CalendarEvent[] = (projects ?? [])
    .map((p) => ({
      id: p.id,
      entity_id: p.id,
      entity_type: "project" as const,
      title: `${p.name}`,
      start: p.start_date ?? p.target_end_date ?? "",
      end: p.target_end_date ?? null,
      color: "#10b981",
      department_id: null,
      client_id: p.client_id,
      project_id: p.id,
    }))
    .filter((e) => e.start);

  const PRIORITY_COLOR: Record<string, string> = {
    low: "bg-white/20",
    medium: "bg-blue-400",
    high: "bg-orange-400",
    urgent: "bg-red-400",
  };

  const legend = [
    { color: "#6366f1", label: "Video tasks" },
    { color: "#ec4899", label: "Photo tasks" },
    { color: "#f59e0b", label: "PR tasks" },
    { color: "#10b981", label: "Projects" },
  ];

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
            {isMine ? "My Calendar" : "Company Calendar"}
          </h1>
          <p className="text-white/40 text-sm mt-1">
            {isMine
              ? "Tasks assigned to you, plus all project milestones."
              : "All tasks, projects, and deadlines across every client."}
          </p>
        </div>

        <div className="flex-shrink-0 mt-1">
          <MineToggle isMine={isMine} />
        </div>
      </div>

      {/* Legend */}
      <div className="flex gap-4 flex-wrap">
        {legend.map(({ color, label }) => (
          <div key={label} className="flex items-center gap-2">
            <span
              className="w-2.5 h-2.5 rounded-full flex-shrink-0"
              style={{ backgroundColor: color, boxShadow: `0 0 6px ${color}80` }}
            />
            <span className="text-sm text-white/40">{label}</span>
          </div>
        ))}
      </div>

      {/* Calendar */}
      <CompanyCalendar events={[...datedEvents, ...projectEvents]} />

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

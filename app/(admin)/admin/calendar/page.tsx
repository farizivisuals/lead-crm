import { createClient } from "@/lib/supabase/server";
import CompanyCalendar from "@/components/calendar/CompanyCalendar";
import type { CalendarEvent } from "@/lib/types";
import { Clock } from "lucide-react";

export default async function CalendarPage() {
  const supabase = await createClient();

  // Fetch ALL tasks (no date filter — we'll split them client-side)
  const [{ data: tasks }, { data: projects }] = await Promise.all([
    supabase
      .from("tasks")
      .select("id, title, start_date, due_date, department_id, project_id, priority, department_stages!current_stage_id(color), departments(name)")
      .order("created_at"),
    supabase
      .from("projects")
      .select("id, name, start_date, target_end_date, client_id")
      .or("start_date.not.is.null,target_end_date.not.is.null"),
  ]);

  // Tasks WITH at least one date → calendar events
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

  // Tasks WITHOUT any dates → unscheduled list
  const undatedTasks = (tasks ?? []).filter((t) => !t.start_date && !t.due_date);

  const projectEvents: CalendarEvent[] = (projects ?? []).map((p) => ({
    id: p.id,
    entity_id: p.id,
    entity_type: "project" as const,
    title: `📁 ${p.name}`,
    start: p.start_date ?? p.target_end_date ?? "",
    end: p.target_end_date ?? null,
    color: "#10b981",
    department_id: null,
    client_id: p.client_id,
    project_id: p.id,
  })).filter((e) => e.start);

  const PRIORITY_DOT: Record<string, string> = {
    low: "bg-gray-300",
    medium: "bg-blue-400",
    high: "bg-orange-400",
    urgent: "bg-red-500",
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Company Calendar</h1>
        <p className="text-gray-500 text-sm mt-1">All tasks, projects, and deadlines across every client</p>
      </div>

      {/* Legend */}
      <div className="flex gap-4 flex-wrap text-sm">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-indigo-500" />
          <span className="text-gray-600">Video tasks</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-pink-500" />
          <span className="text-gray-600">Photo tasks</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-amber-500" />
          <span className="text-gray-600">PR tasks</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-emerald-500" />
          <span className="text-gray-600">Projects</span>
        </div>
      </div>

      <CompanyCalendar events={[...datedEvents, ...projectEvents]} />

      {/* Unscheduled tasks panel */}
      {undatedTasks.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Clock className="h-4 w-4 text-gray-400" />
            <h2 className="font-semibold text-gray-800">Unscheduled tasks</h2>
            <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
              {undatedTasks.length}
            </span>
          </div>
          <p className="text-xs text-gray-400 mb-4">
            These tasks have no start or due date — open the task to add one and it will appear on the calendar.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {undatedTasks.map((task) => (
              <a
                key={task.id}
                href={`/admin/projects/${task.project_id}/tasks`}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-gray-100 hover:border-gray-300 hover:bg-gray-50 transition-colors group"
              >
                <span
                  className={`w-2 h-2 rounded-full flex-shrink-0 ${PRIORITY_DOT[task.priority as string] ?? "bg-gray-300"}`}
                />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate group-hover:text-blue-600">
                    {task.title}
                  </p>
                  <p className="text-xs text-gray-400">
                    {(task.departments as unknown as { name: string } | null)?.name}
                  </p>
                </div>
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

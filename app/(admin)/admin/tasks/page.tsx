import { createClient } from "@/lib/supabase/server";
import { ListTodo } from "lucide-react";
import { requireEmployee } from "@/lib/auth/guards";
import { isExecutive } from "@/lib/rbac";
import TasksList, { type TaskRow } from "./TasksList";

export default async function TasksPage() {
  const { employee } = await requireEmployee();
  const canFilter = isExecutive(employee?.role ?? "employee");
  const supabase = await createClient();

  // RLS scopes this automatically: team members get only their assigned tasks,
  // executives/creatives get every task in projects they can see.
  const { data: tasks } = await supabase
    .from("tasks")
    .select(
      "id, title, priority, due_date, project_id, assigned_to, projects(name), departments(name), department_stages(name, is_terminal), employees!assigned_to(profiles(full_name))"
    )
    .order("due_date", { ascending: true, nullsFirst: false });

  const rows: TaskRow[] = (tasks ?? []).map((t) => {
    const stage = t.department_stages as unknown as { name: string; is_terminal: boolean } | null;
    return {
      id: t.id as string,
      title: t.title as string,
      priority: t.priority as TaskRow["priority"],
      due_date: t.due_date as string | null,
      project_id: t.project_id as string,
      project_name: (t.projects as unknown as { name: string } | null)?.name ?? "—",
      dept_name: (t.departments as unknown as { name: string } | null)?.name ?? "—",
      stage_name: stage?.name ?? "—",
      is_terminal: stage?.is_terminal ?? false,
      assignee_id: t.assigned_to as string | null,
      assignee_name:
        (t.employees as unknown as { profiles?: { full_name: string } } | null)?.profiles?.full_name ?? null,
    };
  });

  return (
    <div className="space-y-8 animate-slide-up">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <ListTodo className="h-4 w-4 text-zinc-400" />
          <span className="text-xs text-zinc-400 font-medium uppercase tracking-widest">Tasks</span>
        </div>
        <h1 className="text-xl lg:text-2xl font-bold text-white tracking-tight">
          {canFilter ? "All Tasks" : "My Tasks"}
        </h1>
        <p className="text-white/40 text-sm mt-1">{rows.length} tasks</p>
      </div>

      <TasksList rows={rows} canFilter={canFilter} />
    </div>
  );
}

import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import {
  Building2, FolderOpen, CheckSquare, Clock,
  ArrowUpRight, Activity, Layers, TrendingUp, ListTodo, FileCheck,
} from "lucide-react";
import { formatRelative } from "@/lib/utils";
import Link from "next/link";
import DeptFilter from "@/components/filters/DeptFilter";
import { isExecutive, DELIVERABLE_STATUS_LABELS, PRIORITY_LABELS } from "@/lib/rbac";

interface Props {
  searchParams: Promise<{ dept_id?: string }>;
}

export default async function DashboardPage({ searchParams }: Props) {
  const { dept_id } = await searchParams;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  const { data: employee } = await supabase
    .from("employees")
    .select("role, department_id, departments(name)")
    .eq("profile_id", user!.id)
    .single();

  const isExec = isExecutive(employee?.role ?? "employee");

  // Plain employees get a focused view: their tasks + approval status of what they submitted.
  if (!isExec) {
    return <EmployeeDashboard userId={user!.id} />;
  }

  const myDeptId = employee?.department_id as string | null;
  const myDeptName = (employee?.departments as unknown as { name: string } | null)?.name;
  const filterDeptId = isExec ? (dept_id ?? null) : myDeptId;

  const { data: departments } = isExec
    ? await supabase.from("departments").select("id, name").order("name")
    : { data: null };

  const [
    { count: clientCount },
    { count: projectCount },
    { count: taskCount },
    { data: recentActivity },
    { data: recentProjects },
  ] = await Promise.all([
    filterDeptId && isExec
      ? supabase
          .from("project_departments")
          .select("projects!inner(client_id)", { count: "exact", head: true })
          .eq("department_id", filterDeptId)
      : supabase.from("clients").select("*", { count: "exact", head: true }),

    filterDeptId && isExec
      ? supabase
          .from("project_departments")
          .select("*", { count: "exact", head: true })
          .eq("department_id", filterDeptId)
      : supabase.from("projects").select("*", { count: "exact", head: true }),

    filterDeptId
      ? supabase
          .from("tasks")
          .select("*", { count: "exact", head: true })
          .eq("department_id", filterDeptId)
      : supabase.from("tasks").select("*", { count: "exact", head: true }),

    supabase
      .from("activity_log")
      .select("*, profiles(full_name)")
      .order("created_at", { ascending: false })
      .limit(8),

    filterDeptId && isExec
      ? supabase
          .from("projects")
          .select("*, clients(company_name), project_departments!inner(department_id)")
          .eq("project_departments.department_id", filterDeptId)
          .order("updated_at", { ascending: false })
          .limit(5)
      : supabase
          .from("projects")
          .select("*, clients(company_name)")
          .order("updated_at", { ascending: false })
          .limit(5),
  ]);

  const stats = [
    {
      label: isExec && filterDeptId ? "Dept Clients" : "Total Clients",
      value: clientCount ?? 0,
      icon: Building2,
      href: "/admin/clients",
      description: "Active client accounts",
    },
    {
      label: isExec && filterDeptId ? "Dept Projects" : "Active Projects",
      value: projectCount ?? 0,
      icon: FolderOpen,
      href: "/admin/projects",
      description: "Projects in progress",
    },
    {
      label: "Open Tasks",
      value: taskCount ?? 0,
      icon: CheckSquare,
      href: "/admin/projects",
      description: "Tasks across all projects",
    },
  ];

  const statusColors: Record<string, "default" | "secondary" | "success" | "warning" | "destructive"> = {
    planning: "secondary",
    active: "default",
    on_hold: "warning",
    completed: "success",
    cancelled: "destructive",
  };

  return (
    <div className="space-y-8 animate-slide-up">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold text-white/25 uppercase tracking-[0.12em] mb-2">Overview</p>
          <h1 className="text-2xl font-bold text-white tracking-tight">Dashboard</h1>
          <p className="text-white/35 text-sm mt-1">
            {isExec ? "Agency-wide metrics across all departments." : `Your department at a glance.`}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0 mt-1">
          {!isExec && myDeptName && (
            <div className="flex items-center gap-1.5 h-8 px-3 rounded-xl bg-white/[0.06] border border-white/[0.1]">
              <Layers className="h-3.5 w-3.5 text-white/40" />
              <span className="text-xs font-medium text-white/60">{myDeptName}</span>
            </div>
          )}
          {isExec && (
            <DeptFilter departments={departments ?? []} currentDeptId={dept_id} />
          )}
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {stats.map(({ label, value, icon: Icon, href, description }, i) => (
          <Link key={label} href={href}>
            <div
              className="group relative rounded-2xl bg-white/[0.04] border border-white/[0.07] p-5 hover:bg-white/[0.07] hover:border-white/[0.12] hover:-translate-y-0.5 hover:shadow-xl hover:shadow-black/30 transition-all duration-300 overflow-hidden cursor-pointer"
              style={{ animationDelay: `${i * 80}ms` }}
            >
              {/* Subtle top highlight */}
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/[0.12] to-transparent" />

              <div className="flex items-start justify-between mb-4">
                <div className="p-2 rounded-xl bg-white/[0.06] border border-white/[0.08] group-hover:bg-white/[0.1] transition-colors">
                  <Icon className="h-4 w-4 text-zinc-300" />
                </div>
                <TrendingUp className="h-3.5 w-3.5 text-white/15 group-hover:text-white/30 transition-colors" />
              </div>

              <div className="space-y-0.5">
                <p className="text-3xl font-bold text-white tracking-tight tabular-nums">{value}</p>
                <p className="text-sm font-medium text-white/50">{label}</p>
              </div>

              <div className="mt-4 pt-3 border-t border-white/[0.05] flex items-center justify-between">
                <p className="text-xs text-white/25">{description}</p>
                <ArrowUpRight className="h-3 w-3 text-white/20 group-hover:text-white/50 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all duration-200" />
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Lower panels */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Recent Projects — wider */}
        <div className="lg:col-span-3 rounded-2xl bg-white/[0.04] border border-white/[0.07] overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 rounded-lg bg-white/[0.06] border border-white/[0.08]">
                <FolderOpen className="h-3.5 w-3.5 text-zinc-300" />
              </div>
              <span className="text-sm font-semibold text-white">Recent Projects</span>
            </div>
            <Link
              href="/admin/projects"
              className="text-xs text-white/25 hover:text-white/60 transition-colors flex items-center gap-1 group"
            >
              View all
              <ArrowUpRight className="h-3 w-3 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
            </Link>
          </div>

          {!recentProjects?.length ? (
            <div className="px-5 py-12 text-center">
              <FolderOpen className="h-8 w-8 text-white/[0.08] mx-auto mb-3" />
              <p className="text-sm text-white/25">No projects yet</p>
            </div>
          ) : (
            <ul className="divide-y divide-white/[0.04]">
              {recentProjects.map((project) => (
                <li key={project.id}>
                  <Link
                    href={`/admin/projects/${project.id}`}
                    className="flex items-center justify-between px-5 py-3.5 hover:bg-white/[0.03] transition-colors group"
                  >
                    <div className="min-w-0 mr-4">
                      <p className="text-sm font-medium text-white/75 group-hover:text-white transition-colors truncate">
                        {project.name}
                      </p>
                      <p className="text-xs text-white/30 mt-0.5 truncate">
                        {(project.clients as { company_name: string })?.company_name}
                      </p>
                    </div>
                    <Badge variant={statusColors[project.status] ?? "secondary"} className="flex-shrink-0 text-[10px]">
                      {project.status.replace("_", " ")}
                    </Badge>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Recent Activity — narrower */}
        <div className="lg:col-span-2 rounded-2xl bg-white/[0.04] border border-white/[0.07] overflow-hidden">
          <div className="flex items-center gap-2.5 px-5 py-4 border-b border-white/[0.06]">
            <div className="p-1.5 rounded-lg bg-white/[0.06] border border-white/[0.08]">
              <Activity className="h-3.5 w-3.5 text-zinc-300" />
            </div>
            <span className="text-sm font-semibold text-white">Activity</span>
          </div>

          {!recentActivity?.length ? (
            <div className="px-5 py-12 text-center">
              <Clock className="h-8 w-8 text-white/[0.08] mx-auto mb-3" />
              <p className="text-sm text-white/25">No activity yet</p>
            </div>
          ) : (
            <ul className="divide-y divide-white/[0.04]">
              {recentActivity.map((log) => (
                <li key={log.id} className="px-5 py-3">
                  <div className="flex items-start gap-3">
                    <div className="w-1.5 h-1.5 rounded-full bg-white/20 mt-[7px] flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-white/55 leading-snug">
                        <span className="font-semibold text-white/80">
                          {(log.profiles as { full_name: string })?.full_name}
                        </span>{" "}
                        {log.action}
                      </p>
                      <p className="text-[10px] text-white/25 mt-0.5">{formatRelative(log.created_at)}</p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

const priorityVariants: Record<string, "secondary" | "warning" | "destructive"> = {
  low: "secondary",
  medium: "secondary",
  high: "warning",
  urgent: "destructive",
};

const approvalVariants: Record<string, "secondary" | "purple" | "warning" | "success" | "destructive"> = {
  draft: "secondary",
  internal_review: "purple",
  client_review: "warning",
  approved: "success",
  revision_requested: "destructive",
};

async function EmployeeDashboard({ userId }: { userId: string }) {
  const supabase = await createClient();

  const [{ data: tasks }, { data: deliverables }] = await Promise.all([
    supabase
      .from("tasks")
      .select("id, title, priority, due_date, project_id, projects(name), department_stages!current_stage_id(name, is_terminal)")
      .eq("assigned_to", userId)
      .order("due_date", { ascending: true, nullsFirst: false }),
    // Approval status of deliverables this employee submitted.
    supabase
      .from("deliverables")
      .select("id, title, status, updated_at, project_id, projects(name)")
      .eq("submitted_by", userId)
      .order("updated_at", { ascending: false })
      .limit(10),
  ]);

  const openTasks = (tasks ?? []).filter(
    (t) => !(t.department_stages as unknown as { is_terminal: boolean } | null)?.is_terminal
  );

  return (
    <div className="space-y-8 animate-slide-up">
      <div>
        <p className="text-[11px] font-semibold text-white/25 uppercase tracking-[0.12em] mb-2">Overview</p>
        <h1 className="text-2xl font-bold text-white tracking-tight">My Work</h1>
        <p className="text-white/35 text-sm mt-1">Your assigned tasks and client approval status.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* My Tasks */}
        <div className="lg:col-span-3 rounded-2xl bg-white/[0.04] border border-white/[0.07] overflow-hidden">
          <div className="flex items-center gap-2.5 px-5 py-4 border-b border-white/[0.06]">
            <div className="p-1.5 rounded-lg bg-white/[0.06] border border-white/[0.08]">
              <ListTodo className="h-3.5 w-3.5 text-zinc-300" />
            </div>
            <span className="text-sm font-semibold text-white">My Tasks</span>
            <Badge variant="secondary" className="ml-auto text-[10px]">{openTasks.length} open</Badge>
          </div>

          {!openTasks.length ? (
            <div className="px-5 py-12 text-center">
              <CheckSquare className="h-8 w-8 text-white/[0.08] mx-auto mb-3" />
              <p className="text-sm text-white/25">No open tasks assigned to you</p>
            </div>
          ) : (
            <ul className="divide-y divide-white/[0.04]">
              {openTasks.map((task) => (
                <li key={task.id}>
                  <Link
                    href={`/admin/projects/${task.project_id}/tasks`}
                    className="flex items-center justify-between px-5 py-3.5 hover:bg-white/[0.03] transition-colors group gap-4"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-white/75 group-hover:text-white transition-colors truncate">
                        {task.title}
                      </p>
                      <p className="text-xs text-white/30 mt-0.5 truncate">
                        {(task.projects as unknown as { name: string })?.name}
                        {" · "}
                        {(task.department_stages as unknown as { name: string } | null)?.name}
                        {task.due_date ? ` · due ${task.due_date}` : ""}
                      </p>
                    </div>
                    <Badge variant={priorityVariants[task.priority] ?? "secondary"} className="flex-shrink-0 text-[10px]">
                      {PRIORITY_LABELS[task.priority as keyof typeof PRIORITY_LABELS]}
                    </Badge>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Client Approval Status */}
        <div className="lg:col-span-2 rounded-2xl bg-white/[0.04] border border-white/[0.07] overflow-hidden">
          <div className="flex items-center gap-2.5 px-5 py-4 border-b border-white/[0.06]">
            <div className="p-1.5 rounded-lg bg-white/[0.06] border border-white/[0.08]">
              <FileCheck className="h-3.5 w-3.5 text-zinc-300" />
            </div>
            <span className="text-sm font-semibold text-white">Approval Status</span>
          </div>

          {!deliverables?.length ? (
            <div className="px-5 py-12 text-center">
              <Clock className="h-8 w-8 text-white/[0.08] mx-auto mb-3" />
              <p className="text-sm text-white/25">Nothing submitted yet</p>
            </div>
          ) : (
            <ul className="divide-y divide-white/[0.04]">
              {deliverables.map((d) => (
                <li key={d.id}>
                  <Link
                    href={`/admin/projects/${d.project_id}/deliverables`}
                    className="flex items-center justify-between px-5 py-3 hover:bg-white/[0.03] transition-colors group gap-3"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-white/75 group-hover:text-white transition-colors truncate">
                        {d.title}
                      </p>
                      <p className="text-[10px] text-white/25 mt-0.5">{formatRelative(d.updated_at)}</p>
                    </div>
                    <Badge variant={approvalVariants[d.status] ?? "secondary"} className="flex-shrink-0 text-[10px]">
                      {DELIVERABLE_STATUS_LABELS[d.status as keyof typeof DELIVERABLE_STATUS_LABELS]}
                    </Badge>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

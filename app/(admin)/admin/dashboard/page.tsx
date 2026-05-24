import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import {
  Building2, FolderOpen, CheckSquare, Clock,
  ArrowUpRight, Sparkles, Activity, Layers,
} from "lucide-react";
import { formatRelative } from "@/lib/utils";
import Link from "next/link";
import DeptFilter from "@/components/filters/DeptFilter";

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

  const isExec = ["root", "ceo", "cfo"].includes(employee?.role ?? "");
  const myDeptId = employee?.department_id as string | null;
  const myDeptName = (employee?.departments as unknown as { name: string } | null)?.name;

  // For exec dept filtering: resolve which dept_id to apply to queries
  const filterDeptId = isExec ? (dept_id ?? null) : myDeptId;

  // Fetch all departments for the filter dropdown (exec only)
  const { data: departments } = isExec
    ? await supabase.from("departments").select("id, name").order("name")
    : { data: null };

  // Build counts — RLS already scopes non-execs to their dept
  const [
    { count: clientCount },
    { count: projectCount },
    { count: taskCount },
    { data: recentActivity },
    { data: recentProjects },
  ] = await Promise.all([
    filterDeptId && isExec
      // Count clients that have projects in this dept (via project_departments)
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
      color: "from-white/[0.08] to-white/[0.02]",
      iconColor: "text-zinc-300",
      border: "border-white/[0.12]",
      href: "/admin/clients",
    },
    {
      label: isExec && filterDeptId ? "Dept Projects" : "Active Projects",
      value: projectCount ?? 0,
      icon: FolderOpen,
      color: "from-white/[0.08] to-white/[0.02]",
      iconColor: "text-zinc-300",
      border: "border-white/[0.12]",
      href: "/admin/projects",
    },
    {
      label: "Open Tasks",
      value: taskCount ?? 0,
      icon: CheckSquare,
      color: "from-white/[0.08] to-white/[0.02]",
      iconColor: "text-zinc-300",
      border: "border-white/[0.12]",
      href: "/admin/projects",
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
    <div className="space-y-6 animate-slide-up">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="h-3.5 w-3.5 text-zinc-400" />
            <span className="text-xs text-zinc-400 font-medium uppercase tracking-widest">Overview</span>
          </div>
          <h1 className="text-xl lg:text-2xl font-bold text-white tracking-tight">Dashboard</h1>
          <p className="text-white/40 text-sm mt-1">
            {isExec
              ? "Agency-wide metrics across all departments."
              : `Showing data for your department.`}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0 mt-1">
          {/* Non-exec dept badge */}
          {!isExec && myDeptName && (
            <div className="flex items-center gap-1.5 h-8 px-3 rounded-xl bg-white/[0.07] border border-white/[0.12]">
              <Layers className="h-3.5 w-3.5 text-zinc-400" />
              <span className="text-xs font-medium text-zinc-300">{myDeptName}</span>
            </div>
          )}
          {/* Exec dept filter */}
          {isExec && (
            <DeptFilter
              departments={departments ?? []}
              currentDeptId={dept_id}
            />
          )}
        </div>
      </div>

      {/* Stats — 1 col mobile, 3 col sm+ */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 lg:gap-4">
        {stats.map(({ label, value, icon: Icon, color, iconColor, border, href }, i) => (
          <Link key={label} href={href}>
            <div
              className={`group relative rounded-2xl bg-gradient-to-br ${color} border ${border} p-5 lg:p-6 shadow-xl backdrop-blur-xl hover:scale-[1.02] transition-all duration-300 overflow-hidden cursor-pointer`}
              style={{ animationDelay: `${i * 80}ms` }}
            >
              <div className="absolute -top-8 -right-8 w-24 h-24 rounded-full blur-2xl bg-white/5 group-hover:bg-white/10 transition-all duration-500" />
              <div className="relative flex items-start justify-between">
                <div>
                  <p className="text-2xl lg:text-3xl font-bold text-white tracking-tight tabular-nums">{value}</p>
                  <p className="text-sm text-white/50 mt-1 font-medium">{label}</p>
                </div>
                <div className={`p-2.5 rounded-xl bg-white/[0.07] border border-white/[0.08] ${iconColor}`}>
                  <Icon className="h-4 w-4 lg:h-5 lg:w-5" />
                </div>
              </div>
              <div className="relative mt-3 flex items-center gap-1.5 text-xs text-white/30 group-hover:text-white/50 transition-colors">
                <span>View all</span>
                <ArrowUpRight className="h-3 w-3 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Recent panels — 1 col mobile, 2 col lg+ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
        {/* Recent Projects */}
        <div className="rounded-2xl bg-white/[0.04] backdrop-blur-xl border border-white/[0.08] overflow-hidden">
          <div className="flex items-center justify-between px-4 lg:px-5 py-4 border-b border-white/[0.07]">
            <div className="flex items-center gap-2">
              <FolderOpen className="h-4 w-4 text-zinc-300" />
              <span className="text-sm font-semibold text-white">Recent Projects</span>
            </div>
            <Link href="/admin/projects" className="text-xs text-white/30 hover:text-zinc-200 transition-colors flex items-center gap-1">
              View all <ArrowUpRight className="h-3 w-3" />
            </Link>
          </div>
          {!recentProjects?.length ? (
            <div className="px-5 py-10 text-center">
              <FolderOpen className="h-8 w-8 text-white/10 mx-auto mb-2" />
              <p className="text-sm text-white/30">No projects yet</p>
            </div>
          ) : (
            <ul>
              {recentProjects?.map((project) => (
                <li key={project.id}>
                  <Link
                    href={`/admin/projects/${project.id}`}
                    className="flex items-center justify-between px-4 lg:px-5 py-3.5 hover:bg-white/[0.04] transition-colors border-b border-white/[0.04] last:border-0 group"
                  >
                    <div className="min-w-0 mr-3">
                      <p className="text-sm font-medium text-white/80 group-hover:text-white transition-colors truncate">
                        {project.name}
                      </p>
                      <p className="text-xs text-white/30 mt-0.5 truncate">
                        {(project.clients as { company_name: string })?.company_name}
                      </p>
                    </div>
                    <Badge variant={statusColors[project.status] ?? "secondary"} className="flex-shrink-0">
                      {project.status.replace("_", " ")}
                    </Badge>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Recent Activity */}
        <div className="rounded-2xl bg-white/[0.04] backdrop-blur-xl border border-white/[0.08] overflow-hidden">
          <div className="flex items-center gap-2 px-4 lg:px-5 py-4 border-b border-white/[0.07]">
            <Activity className="h-4 w-4 text-zinc-300" />
            <span className="text-sm font-semibold text-white">Recent Activity</span>
          </div>
          {!recentActivity?.length ? (
            <div className="px-5 py-10 text-center">
              <Clock className="h-8 w-8 text-white/10 mx-auto mb-2" />
              <p className="text-sm text-white/30">No activity yet</p>
            </div>
          ) : (
            <ul>
              {recentActivity?.map((log) => (
                <li key={log.id} className="px-4 lg:px-5 py-3 border-b border-white/[0.04] last:border-0">
                  <div className="flex items-start gap-3">
                    <div className="w-1.5 h-1.5 rounded-full bg-white/30 mt-2 flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm text-white/70 leading-snug">
                        <span className="font-medium text-white/90">
                          {(log.profiles as { full_name: string })?.full_name}
                        </span>{" "}
                        {log.action}
                      </p>
                      <p className="text-xs text-white/30 mt-0.5">{formatRelative(log.created_at)}</p>
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

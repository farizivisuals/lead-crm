import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { FolderOpen, ArrowUpRight, Calendar } from "lucide-react";
import { formatDate } from "@/lib/utils";
import NewProjectDialog from "./NewProjectDialog";
import { requireEmployee } from "@/lib/auth/guards";
import { isExecutive } from "@/lib/rbac";

export default async function ProjectsPage() {
  const { employee } = await requireEmployee();
  const canManage = isExecutive(employee?.role ?? "employee");
  const supabase = await createClient();

  const [{ data: projects }, { data: clients }, { data: departments }, { data: creativeRows }] = await Promise.all([
    supabase
      .from("projects")
      .select("*, clients(company_name), project_departments(*, departments(name, slug))")
      .order("updated_at", { ascending: false }),
    supabase.from("clients").select("id, company_name").order("company_name"),
    supabase.from("departments").select("*").order("name"),
    supabase
      .from("employees")
      .select("profile_id, profiles(full_name), departments!inner(slug)")
      .eq("departments.slug", "creatives"),
  ]);

  const creatives = (creativeRows ?? []).map((c) => ({
    profile_id: c.profile_id as string,
    full_name: (c.profiles as unknown as { full_name: string } | null)?.full_name ?? "Unknown",
  }));

  // Fetch task progress for all projects in one query
  const projectIds = (projects ?? []).map((p) => p.id);
  const { data: taskRows } = projectIds.length
    ? await supabase
        .from("tasks")
        .select("project_id, department_stages(is_terminal)")
        .in("project_id", projectIds)
    : { data: [] };

  type Progress = { total: number; done: number };
  const progressByProject = (taskRows ?? []).reduce<Record<string, Progress>>((acc, t) => {
    const pid = t.project_id as string;
    acc[pid] ??= { total: 0, done: 0 };
    acc[pid]!.total++;
    // Supabase returns the join as an array; check the first element.
    const stage = Array.isArray(t.department_stages)
      ? (t.department_stages as { is_terminal: boolean }[])[0]
      : (t.department_stages as { is_terminal: boolean } | null);
    if (stage?.is_terminal) acc[pid]!.done++;
    return acc;
  }, {});

  const statusColors: Record<string, "default" | "secondary" | "success" | "warning" | "destructive"> = {
    planning: "secondary",
    active: "default",
    on_hold: "warning",
    completed: "success",
    cancelled: "destructive",
    delivered: "success",
  };

  return (
    <div className="space-y-8 animate-slide-up">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <FolderOpen className="h-4 w-4 text-zinc-400" />
            <span className="text-xs text-zinc-400 font-medium uppercase tracking-widest">Projects</span>
          </div>
          <h1 className="text-xl lg:text-2xl font-bold text-white tracking-tight">All Projects</h1>
          <p className="text-white/40 text-sm mt-1">{projects?.length ?? 0} projects</p>
        </div>
        {canManage && (
          <NewProjectDialog clients={clients ?? []} departments={departments ?? []} creatives={creatives} />
        )}
      </div>

      {projects?.length === 0 ? (
        <div className="rounded-2xl bg-white/[0.04] backdrop-blur-xl border border-white/[0.08] py-20 text-center">
          <div className="w-14 h-14 rounded-2xl bg-white/[0.06] border border-white/[0.08] flex items-center justify-center mx-auto mb-4">
            <FolderOpen className="h-7 w-7 text-white/20" />
          </div>
          <p className="text-white/60 font-medium">No projects yet</p>
          <p className="text-sm text-white/30 mt-1">Create your first project to get started</p>
        </div>
      ) : (
        <div className="space-y-2">
          {projects?.map((project) => {
            const depts = (project.project_departments as { departments?: { name: string; slug: string } }[]) ?? [];
            const progress = progressByProject[project.id];
            const pct = progress && progress.total > 0
              ? Math.round((progress.done / progress.total) * 100)
              : null;

            return (
              <Link key={project.id} href={`/admin/projects/${project.id}`}>
                <div className="group rounded-2xl bg-white/[0.04] backdrop-blur-xl border border-white/[0.08] p-5 hover:bg-white/[0.07] hover:border-white/[0.14] hover:shadow-xl hover:shadow-black/20 hover:-translate-y-px transition-all duration-200 cursor-pointer">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-start gap-4 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-white/[0.07] border border-white/[0.12] flex items-center justify-center flex-shrink-0">
                        <FolderOpen className="h-[18px] w-[18px] text-zinc-300" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-white/90 group-hover:text-white transition-colors leading-tight">
                          {project.name}
                        </p>
                        <p className="text-sm text-white/35 mt-0.5">
                          {(project.clients as { company_name: string })?.company_name}
                        </p>
                        {project.description && (
                          <p className="text-sm text-white/30 mt-1 line-clamp-1">{project.description}</p>
                        )}
                        {depts.length > 0 && (
                          <div className="flex gap-1.5 mt-2 flex-wrap">
                            {depts.map((pd) => (
                              <span
                                key={pd.departments?.slug}
                                className="text-xs bg-white/[0.07] text-zinc-300 border border-white/[0.12] px-2 py-0.5 rounded-full font-medium"
                              >
                                {pd.departments?.name}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2 flex-shrink-0">
                      <Badge variant={statusColors[project.status] ?? "secondary"}>
                        {project.status.replace("_", " ")}
                      </Badge>
                      {project.target_end_date && (
                        <span className="flex items-center gap-1 text-xs text-white/30">
                          <Calendar className="h-3 w-3" />
                          {formatDate(project.target_end_date)}
                        </span>
                      )}
                      <ArrowUpRight className="h-4 w-4 text-white/20 group-hover:text-white/50 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all duration-200" />
                    </div>
                  </div>

                  {/* Task progress bar */}
                  {progress && progress.total > 0 && (
                    <div className="mt-4 pl-14">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[11px] text-white/30">
                          {progress.done} / {progress.total} tasks done
                        </span>
                        <span className="text-[11px] text-white/30 tabular-nums">{pct}%</span>
                      </div>
                      <div className="h-1 rounded-full bg-white/[0.06] overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-zinc-400 to-zinc-300 transition-all duration-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft, CheckSquare, Package, Calendar, Activity, ArrowUpRight } from "lucide-react";
import { formatDate } from "@/lib/utils";
import ProjectStatusSelect from "./ProjectStatusSelect";
import type { ProjectStatus } from "@/lib/types";


export default async function ProjectDetailPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const supabase = await createClient();

  const { data: project } = await supabase
    .from("projects")
    .select("*, clients(company_name), project_departments(*, departments(name, slug))")
    .eq("id", projectId)
    .single();

  if (!project) notFound();

  const [{ data: taskRows }, { count: deliverableCount }] = await Promise.all([
    supabase
      .from("tasks")
      .select("department_stages(is_terminal)")
      .eq("project_id", projectId),
    supabase.from("deliverables").select("*", { count: "exact", head: true }).eq("project_id", projectId),
  ]);
  const taskCount = taskRows?.length ?? 0;
  // Supabase returns the join as an array; take the first element.
  const taskDone = (taskRows ?? []).filter((t) => {
    const stage = Array.isArray(t.department_stages)
      ? (t.department_stages as { is_terminal: boolean }[])[0]
      : (t.department_stages as { is_terminal: boolean } | null);
    return stage?.is_terminal === true;
  }).length;

  const depts = (project.project_departments as { departments?: { name: string; slug: string } }[]) ?? [];

  const navItems = [
    {
      href: `/admin/projects/${projectId}/tasks`,
      label: "Tasks",
      icon: CheckSquare,
      count: taskCount,
      done: taskDone,
      color: "from-white/[0.08] to-white/[0.02]",
      border: "border-white/[0.12]",
      iconColor: "text-zinc-300",
    },
    {
      href: `/admin/projects/${projectId}/deliverables`,
      label: "Deliverables",
      icon: Package,
      count: deliverableCount ?? 0,
      done: undefined as number | undefined,
      color: "from-white/[0.08] to-white/[0.02]",
      border: "border-white/[0.12]",
      iconColor: "text-zinc-300",
    },
    {
      href: `/admin/projects/${projectId}/activity`,
      label: "Activity",
      icon: Activity,
      count: undefined as number | undefined,
      done: undefined as number | undefined,
      color: "from-white/[0.08] to-white/[0.02]",
      border: "border-white/[0.12]",
      iconColor: "text-zinc-300",
    },
  ];

  return (
    <div className="space-y-6 animate-slide-up">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 flex-wrap">
        <Link href="/admin/projects">
          <Button variant="ghost" size="sm" className="gap-1.5">
            <ArrowLeft className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Projects</span>
          </Button>
        </Link>
        <span className="text-white/20">/</span>
        <span className="text-sm text-white/40 truncate max-w-[160px] sm:max-w-none">
          {(project.clients as { company_name: string })?.company_name}
        </span>
      </div>

      {/* Project header */}
      <div className="relative z-10 rounded-2xl bg-white/[0.04] backdrop-blur-xl border border-white/[0.08] p-4 lg:p-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-xl lg:text-2xl font-bold text-white tracking-tight">{project.name}</h1>
            {project.description && (
              <p className="text-white/50 mt-2 text-sm leading-relaxed">{project.description}</p>
            )}
            <div className="flex flex-wrap gap-2 mt-3">
              <ProjectStatusSelect projectId={projectId} currentStatus={project.status as ProjectStatus} />
              {depts.map((pd) => (
                <span
                  key={pd.departments?.slug}
                  className="text-xs bg-white/[0.07] text-zinc-300 border border-white/[0.12] px-2.5 py-0.5 rounded-full font-medium"
                >
                  {pd.departments?.name}
                </span>
              ))}
            </div>
          </div>
          <div className="flex sm:flex-col items-center sm:items-end gap-3 sm:gap-2 text-xs text-white/40 flex-shrink-0">
            {project.start_date && (
              <span className="flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-white/30" />
                Start: {formatDate(project.start_date)}
              </span>
            )}
            {project.target_end_date && (
              <span className="flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-white/30" />
                Due: {formatDate(project.target_end_date)}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Sub-nav — 1 col on mobile, 3 col on sm+ */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {navItems.map(({ href, label, icon: Icon, count, done, color, border, iconColor }) => {
          const pct = done !== undefined && count !== undefined && count > 0
            ? Math.round((done / count) * 100)
            : null;
          return (
            <Link key={href} href={href}>
              <div className={`group relative rounded-2xl bg-gradient-to-br ${color} border ${border} p-4 lg:p-5 hover:scale-[1.02] hover:shadow-xl hover:shadow-black/20 transition-all duration-300 overflow-hidden cursor-pointer`}>
                <div className="absolute top-0 right-0 w-20 h-20 rounded-full blur-2xl bg-white/5 group-hover:bg-white/10 transition-all" />
                <div className="relative flex items-center justify-between">
                  <div className={`p-2 rounded-xl bg-white/[0.08] border border-white/[0.1] ${iconColor}`}>
                    <Icon className="h-[18px] w-[18px]" />
                  </div>
                  <ArrowUpRight className="h-4 w-4 text-white/20 group-hover:text-white/50 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
                </div>
                <div className="relative mt-3">
                  <p className="font-semibold text-white/90 group-hover:text-white transition-colors">{label}</p>
                  {count !== undefined && pct === null && (
                    <p className="text-sm text-white/40 mt-0.5">{count} items</p>
                  )}
                  {/* Progress bar (Tasks card only) */}
                  {pct !== null && count !== undefined && done !== undefined && (
                    <div className="mt-2">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-white/40">{done} / {count} done</span>
                        <span className="text-xs text-white/40 tabular-nums">{pct}%</span>
                      </div>
                      <div className="h-1 rounded-full bg-white/[0.1] overflow-hidden">
                        <div
                          className="h-full rounded-full bg-white/50 transition-all duration-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  )}
                  {pct !== null && count === 0 && (
                    <p className="text-sm text-white/40 mt-0.5">0 tasks</p>
                  )}
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

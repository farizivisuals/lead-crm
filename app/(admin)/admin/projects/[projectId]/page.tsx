import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, CheckSquare, Package, Calendar, Activity, ArrowUpRight } from "lucide-react";
import { formatDate } from "@/lib/utils";

const statusColors: Record<string, "default" | "secondary" | "success" | "warning" | "destructive"> = {
  planning: "secondary",
  active: "default",
  on_hold: "warning",
  completed: "success",
  cancelled: "destructive",
};

export default async function ProjectDetailPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const supabase = await createClient();

  const { data: project } = await supabase
    .from("projects")
    .select("*, clients(company_name), project_departments(*, departments(name, slug))")
    .eq("id", projectId)
    .single();

  if (!project) notFound();

  const [{ count: taskCount }, { count: deliverableCount }] = await Promise.all([
    supabase.from("tasks").select("*", { count: "exact", head: true }).eq("project_id", projectId),
    supabase.from("deliverables").select("*", { count: "exact", head: true }).eq("project_id", projectId),
  ]);

  const depts = (project.project_departments as { departments?: { name: string; slug: string } }[]) ?? [];

  const navItems = [
    {
      href: `/admin/projects/${projectId}/tasks`,
      label: "Tasks",
      icon: CheckSquare,
      count: taskCount ?? 0,
      color: "from-indigo-500/20 to-indigo-600/5",
      border: "border-indigo-500/20",
      iconColor: "text-indigo-400",
    },
    {
      href: `/admin/projects/${projectId}/deliverables`,
      label: "Deliverables",
      icon: Package,
      count: deliverableCount ?? 0,
      color: "from-violet-500/20 to-violet-600/5",
      border: "border-violet-500/20",
      iconColor: "text-violet-400",
    },
    {
      href: `/admin/projects/${projectId}/activity`,
      label: "Activity",
      icon: Activity,
      count: undefined,
      color: "from-cyan-500/20 to-cyan-600/5",
      border: "border-cyan-500/20",
      iconColor: "text-cyan-400",
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
      <div className="rounded-2xl bg-white/[0.04] backdrop-blur-xl border border-white/[0.08] p-4 lg:p-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-xl lg:text-2xl font-bold text-white tracking-tight">{project.name}</h1>
            {project.description && (
              <p className="text-white/50 mt-2 text-sm leading-relaxed">{project.description}</p>
            )}
            <div className="flex flex-wrap gap-2 mt-3">
              <Badge variant={statusColors[project.status] ?? "secondary"}>
                {project.status.replace("_", " ")}
              </Badge>
              {depts.map((pd) => (
                <span
                  key={pd.departments?.slug}
                  className="text-xs bg-indigo-500/15 text-indigo-400 border border-indigo-500/20 px-2.5 py-0.5 rounded-full font-medium"
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
        {navItems.map(({ href, label, icon: Icon, count, color, border, iconColor }) => (
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
                {count !== undefined && (
                  <p className="text-sm text-white/40 mt-0.5">{count} items</p>
                )}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, CheckSquare, Package, Calendar, Activity } from "lucide-react";
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
    { href: `/admin/projects/${projectId}/tasks`, label: "Tasks", icon: CheckSquare, count: taskCount ?? 0 },
    { href: `/admin/projects/${projectId}/deliverables`, label: "Deliverables", icon: Package, count: deliverableCount ?? 0 },
    { href: `/admin/projects/${projectId}/activity`, label: "Activity", icon: Activity },
  ];

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center gap-3">
        <Link href="/admin/projects">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4" />
            Projects
          </Button>
        </Link>
        <span className="text-gray-300">/</span>
        <span className="text-sm text-gray-500">
          {(project.clients as { company_name: string })?.company_name}
        </span>
      </div>

      {/* Project header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{project.name}</h1>
          {project.description && (
            <p className="text-gray-500 mt-1">{project.description}</p>
          )}
          <div className="flex flex-wrap gap-2 mt-3">
            <Badge variant={statusColors[project.status] ?? "secondary"}>
              {project.status.replace("_", " ")}
            </Badge>
            {depts.map((pd) => (
              <span
                key={pd.departments?.slug}
                className="text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full font-medium"
              >
                {pd.departments?.name}
              </span>
            ))}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1 text-sm text-gray-500">
          {project.start_date && <span>Start: {formatDate(project.start_date)}</span>}
          {project.target_end_date && <span>Due: {formatDate(project.target_end_date)}</span>}
        </div>
      </div>

      {/* Sub-nav cards */}
      <div className="grid grid-cols-3 gap-4">
        {navItems.map(({ href, label, icon: Icon, count }) => (
          <Link key={href} href={href}>
            <Card className="hover:shadow-md transition-shadow cursor-pointer">
              <CardContent className="p-5">
                <div className="flex items-center gap-3">
                  <Icon className="h-5 w-5 text-blue-600" />
                  <div>
                    <p className="font-medium text-gray-900">{label}</p>
                    {count !== undefined && (
                      <p className="text-sm text-gray-400">{count} items</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}

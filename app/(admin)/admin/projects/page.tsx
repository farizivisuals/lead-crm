import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, FolderOpen } from "lucide-react";
import { formatDate } from "@/lib/utils";
import NewProjectDialog from "./NewProjectDialog";

export default async function ProjectsPage() {
  const supabase = await createClient();

  const [{ data: projects }, { data: clients }, { data: departments }] = await Promise.all([
    supabase
      .from("projects")
      .select("*, clients(company_name), project_departments(*, departments(name, slug))")
      .order("updated_at", { ascending: false }),
    supabase.from("clients").select("id, company_name").order("company_name"),
    supabase.from("departments").select("*").order("name"),
  ]);

  const statusColors: Record<string, "default" | "secondary" | "success" | "warning" | "destructive"> = {
    planning: "secondary",
    active: "default",
    on_hold: "warning",
    completed: "success",
    cancelled: "destructive",
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Projects</h1>
          <p className="text-gray-500 text-sm mt-1">{projects?.length ?? 0} projects</p>
        </div>
        <NewProjectDialog clients={clients ?? []} departments={departments ?? []} />
      </div>

      {projects?.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FolderOpen className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 font-medium">No projects yet</p>
            <p className="text-sm text-gray-400 mt-1">Create your first project to get started</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {projects?.map((project) => {
            const depts = (project.project_departments as { departments?: { name: string; slug: string } }[]) ?? [];
            return (
              <Link key={project.id} href={`/admin/projects/${project.id}`}>
                <Card className="hover:shadow-md transition-shadow cursor-pointer">
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="font-semibold text-gray-900">{project.name}</p>
                        <p className="text-sm text-gray-400 mt-0.5">
                          {(project.clients as { company_name: string })?.company_name}
                        </p>
                        {project.description && (
                          <p className="text-sm text-gray-500 mt-1 line-clamp-1">{project.description}</p>
                        )}
                        <div className="flex gap-2 mt-2 flex-wrap">
                          {depts.map((pd) => (
                            <span
                              key={pd.departments?.slug}
                              className="text-xs bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full font-medium"
                            >
                              {pd.departments?.name}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2 flex-shrink-0">
                        <Badge variant={statusColors[project.status] ?? "secondary"}>
                          {project.status.replace("_", " ")}
                        </Badge>
                        {project.target_end_date && (
                          <span className="text-xs text-gray-400">
                            Due {formatDate(project.target_end_date)}
                          </span>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

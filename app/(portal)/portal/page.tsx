import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FolderOpen } from "lucide-react";
import { formatDate } from "@/lib/utils";

const statusColors: Record<string, "default" | "secondary" | "success" | "warning" | "destructive"> = {
  planning: "secondary",
  active: "default",
  on_hold: "warning",
  completed: "success",
  cancelled: "destructive",
};

export default async function PortalHomePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Get client_id for this contact
  const { data: contact } = await supabase
    .from("client_contacts")
    .select("client_id, clients(company_name)")
    .eq("profile_id", user.id)
    .single();

  if (!contact) redirect("/login");

  const { data: projects } = await supabase
    .from("projects")
    .select("*, project_departments(*, departments(name, slug))")
    .eq("client_id", contact.client_id)
    .order("updated_at", { ascending: false });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Your Projects</h1>
        <p className="text-gray-500 text-sm mt-1">
          {(contact.clients as unknown as { company_name: string })?.company_name}
        </p>
      </div>

      {projects?.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FolderOpen className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 font-medium">No projects yet</p>
            <p className="text-sm text-gray-400 mt-1">Your projects will appear here once they&apos;re created</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {projects?.map((project) => {
            const depts = (project.project_departments as { departments?: { name: string } }[]) ?? [];
            return (
              <Link key={project.id} href={`/portal/projects/${project.id}`}>
                <Card className="hover:shadow-md transition-shadow cursor-pointer">
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="font-semibold text-gray-900">{project.name}</p>
                        {project.description && (
                          <p className="text-sm text-gray-500 mt-0.5 line-clamp-2">{project.description}</p>
                        )}
                        <div className="flex gap-2 mt-2 flex-wrap">
                          {depts.map((pd, i) => (
                            <span key={i} className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">
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
                          <span className="text-xs text-gray-400">Due {formatDate(project.target_end_date)}</span>
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

import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Phone, Plus, FolderOpen } from "lucide-react";
import { formatDate } from "@/lib/utils";

export default async function ClientDetailPage({ params }: { params: Promise<{ clientId: string }> }) {
  const { clientId } = await params;
  const supabase = await createClient();

  const { data: client } = await supabase
    .from("clients")
    .select("*, profiles:primary_contact_profile_id(full_name, avatar_url)")
    .eq("id", clientId)
    .single();

  if (!client) notFound();

  const { data: projects } = await supabase
    .from("projects")
    .select("*, project_departments(*, departments(name, slug))")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false });

  const statusColors: Record<string, "default" | "secondary" | "success" | "warning" | "destructive"> = {
    planning: "secondary",
    active: "default",
    on_hold: "warning",
    completed: "success",
    cancelled: "destructive",
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-4">
        <Link href="/admin/clients">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4" />
            Clients
          </Button>
        </Link>
      </div>

      {/* Client Info */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-xl">{client.company_name}</CardTitle>
              <p className="text-gray-500 text-sm mt-1">
                Primary contact: {(client.profiles as { full_name: string })?.full_name}
              </p>
            </div>
          </div>
        </CardHeader>
        {(client.phone || client.notes) && (
          <CardContent className="pt-0 space-y-2">
            {client.phone && (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Phone className="h-4 w-4" />
                {client.phone}
              </div>
            )}
            {client.notes && (
              <p className="text-sm text-gray-600 bg-gray-50 rounded-lg p-3">{client.notes}</p>
            )}
          </CardContent>
        )}
      </Card>

      {/* Projects */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Projects</h2>
        <Link href={`/admin/projects?client=${clientId}`}>
          <Button size="sm">
            <Plus className="h-4 w-4" />
            New Project
          </Button>
        </Link>
      </div>

      {projects?.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center">
            <FolderOpen className="h-10 w-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No projects yet for this client</p>
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
                        {project.description && (
                          <p className="text-sm text-gray-500 mt-0.5 line-clamp-1">{project.description}</p>
                        )}
                        <div className="flex gap-2 mt-2 flex-wrap">
                          {depts.map((pd) => (
                            <span
                              key={pd.departments?.slug}
                              className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full"
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

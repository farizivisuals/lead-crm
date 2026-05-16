import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, ExternalLink, Package } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { DELIVERABLE_STATUS_LABELS, DELIVERABLE_TYPE_LABELS } from "@/lib/rbac";
import NewDeliverableDialog from "./NewDeliverableDialog";

const statusVariants: Record<string, "default" | "secondary" | "success" | "warning" | "destructive" | "purple"> = {
  draft: "secondary",
  internal_review: "purple",
  client_review: "warning",
  approved: "success",
  revision_requested: "destructive",
};

export default async function DeliverablesPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const supabase = await createClient();

  const { data: project } = await supabase
    .from("projects")
    .select("name, project_departments(department_id, departments(name))")
    .eq("id", projectId)
    .single();

  if (!project) notFound();

  const { data: deliverables } = await supabase
    .from("deliverables")
    .select("*, profiles:submitted_by(full_name), deliverable_revisions(action, note, created_at, profiles:actor_profile_id(full_name))")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });

  const { data: tasks } = await supabase
    .from("tasks")
    .select("id, title")
    .eq("project_id", projectId);

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href={`/admin/projects/${projectId}`}>
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4" />
              {project.name}
            </Button>
          </Link>
          <span className="text-gray-400">/</span>
          <h1 className="text-xl font-bold text-gray-900">Deliverables</h1>
        </div>
        <NewDeliverableDialog projectId={projectId} tasks={tasks ?? []} />
      </div>

      {deliverables?.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Package className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 font-medium">No deliverables yet</p>
            <p className="text-sm text-gray-400 mt-1">Add a Dropbox link to submit your first deliverable</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {deliverables?.map((d) => {
            const revisions = (d.deliverable_revisions as { action: string; note: string | null; created_at: string; profiles: { full_name: string } }[]) ?? [];
            const latestRevision = revisions[0];
            return (
              <Card key={d.id}>
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-medium">
                          {DELIVERABLE_TYPE_LABELS[d.type as keyof typeof DELIVERABLE_TYPE_LABELS]}
                        </span>
                        <span className="text-xs text-gray-400">v{d.version}</span>
                      </div>
                      <p className="font-semibold text-gray-900 mt-1">{d.title}</p>
                      <div className="flex items-center gap-3 mt-2 text-sm text-gray-500">
                        <span>By {(d.profiles as { full_name: string })?.full_name}</span>
                        <span>•</span>
                        <span>{formatDate(d.submitted_at)}</span>
                      </div>

                      {latestRevision && (
                        <div className="mt-3 text-sm bg-gray-50 rounded-lg px-3 py-2">
                          <span className="font-medium text-gray-700">
                            {latestRevision.action === "approve" ? "✓ Approved" : "↩ Revision requested"}
                          </span>
                          {latestRevision.note && (
                            <p className="text-gray-500 mt-0.5">{latestRevision.note}</p>
                          )}
                          <p className="text-xs text-gray-400 mt-1">
                            by {latestRevision.profiles?.full_name} · {formatDate(latestRevision.created_at)}
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col items-end gap-2 flex-shrink-0">
                      <Badge variant={statusVariants[d.status] ?? "secondary"}>
                        {DELIVERABLE_STATUS_LABELS[d.status as keyof typeof DELIVERABLE_STATUS_LABELS]}
                      </Badge>
                      <a
                        href={d.dropbox_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-sm text-blue-600 hover:underline"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        Open in Dropbox
                      </a>
                    </div>
                  </div>

                  {/* Move to client review button */}
                  {d.status === "internal_review" && (
                    <SendToClientButton deliverableId={d.id} />
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Server-compatible inline component using a form action
function SendToClientButton({ deliverableId }: { deliverableId: string }) {
  return (
    <form action={`/api/deliverables/${deliverableId}/send-to-client`} method="POST" className="mt-3">
      <button
        type="submit"
        className="text-sm text-blue-600 hover:underline"
      >
        Send to client for review →
      </button>
    </form>
  );
}

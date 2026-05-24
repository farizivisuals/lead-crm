import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, ExternalLink, Package, ArrowRight } from "lucide-react";
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
    <div className="space-y-6 animate-slide-up max-w-4xl">
      {/* Breadcrumb */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <Link href={`/admin/projects/${projectId}`}>
            <Button variant="ghost" size="sm" className="gap-1.5">
              <ArrowLeft className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{project.name}</span>
            </Button>
          </Link>
          <span className="text-white/20">/</span>
          <h1 className="text-lg lg:text-xl font-bold text-white">Deliverables</h1>
        </div>
        <NewDeliverableDialog projectId={projectId} tasks={tasks ?? []} />
      </div>

      {/* Empty state */}
      {deliverables?.length === 0 ? (
        <div className="rounded-2xl bg-white/[0.04] backdrop-blur-xl border border-white/[0.08] py-20 text-center">
          <div className="w-14 h-14 rounded-2xl bg-white/[0.06] border border-white/[0.08] flex items-center justify-center mx-auto mb-4">
            <Package className="h-7 w-7 text-white/20" />
          </div>
          <p className="text-white/60 font-medium">No deliverables yet</p>
          <p className="text-sm text-white/30 mt-1">Add a Dropbox link to submit your first deliverable</p>
        </div>
      ) : (
        <div className="space-y-3">
          {deliverables?.map((d) => {
            const revisions = (d.deliverable_revisions as {
              action: string;
              note: string | null;
              created_at: string;
              profiles: { full_name: string };
            }[]) ?? [];
            const latestRevision = revisions[0];

            return (
              <div key={d.id} className="rounded-2xl bg-white/[0.04] backdrop-blur-xl border border-white/[0.08] p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    {/* Type + version */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs bg-white/[0.07] text-zinc-300 border border-white/[0.12] px-2 py-0.5 rounded-full font-medium">
                        {DELIVERABLE_TYPE_LABELS[d.type as keyof typeof DELIVERABLE_TYPE_LABELS]}
                      </span>
                      <span className="text-xs text-white/25 font-medium">v{d.version}</span>
                    </div>

                    <p className="font-semibold text-white/90 mt-2">{d.title}</p>

                    <div className="flex items-center gap-2 mt-1.5 text-xs text-white/35 flex-wrap">
                      <span>By {(d.profiles as { full_name: string })?.full_name}</span>
                      <span className="text-white/15">·</span>
                      <span>{formatDate(d.submitted_at)}</span>
                    </div>

                    {/* Latest revision feedback */}
                    {latestRevision && (
                      <div className="mt-3 rounded-xl bg-white/[0.04] border border-white/[0.07] px-3.5 py-2.5">
                        <span className={`text-xs font-semibold ${latestRevision.action === "approve" ? "text-emerald-400" : "text-orange-400"}`}>
                          {latestRevision.action === "approve" ? "✓ Approved" : "↩ Revision requested"}
                        </span>
                        {latestRevision.note && (
                          <p className="text-sm text-white/50 mt-1 leading-relaxed">{latestRevision.note}</p>
                        )}
                        <p className="text-xs text-white/25 mt-1.5">
                          by {latestRevision.profiles?.full_name} · {formatDate(latestRevision.created_at)}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Right side: badge + link */}
                  <div className="flex flex-col items-end gap-2.5 flex-shrink-0">
                    <Badge variant={statusVariants[d.status] ?? "secondary"}>
                      {DELIVERABLE_STATUS_LABELS[d.status as keyof typeof DELIVERABLE_STATUS_LABELS]}
                    </Badge>
                    <a
                      href={d.dropbox_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      Open in Dropbox
                    </a>
                  </div>
                </div>

                {/* Send to client */}
                {d.status === "internal_review" && (
                  <SendToClientButton deliverableId={d.id} />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function SendToClientButton({ deliverableId }: { deliverableId: string }) {
  return (
    <form action={`/api/deliverables/${deliverableId}/send-to-client`} method="POST" className="mt-4 pt-4 border-t border-white/[0.07]">
      <button
        type="submit"
        className="flex items-center gap-1.5 text-sm font-medium text-zinc-400 hover:text-zinc-200 transition-colors"
      >
        Send to client for review
        <ArrowRight className="h-3.5 w-3.5" />
      </button>
    </form>
  );
}

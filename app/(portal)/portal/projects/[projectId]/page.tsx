import { createClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, ExternalLink, Package, CheckCircle, RotateCcw } from "lucide-react";
import { formatDate, formatRelative } from "@/lib/utils";
import { DELIVERABLE_STATUS_LABELS, DELIVERABLE_TYPE_LABELS, PRIORITY_LABELS } from "@/lib/rbac";
import ClientRevisionForm from "./ClientRevisionForm";

const statusVariants: Record<string, "default" | "secondary" | "success" | "warning" | "destructive" | "purple"> = {
  draft: "secondary",
  internal_review: "purple",
  client_review: "warning",
  approved: "success",
  revision_requested: "destructive",
};

export default async function PortalProjectPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Verify access
  const { data: contact } = await supabase
    .from("client_contacts")
    .select("client_id")
    .eq("profile_id", user.id)
    .single();
  if (!contact) redirect("/portal");

  const { data: project } = await supabase
    .from("projects")
    .select("*, project_departments(departments(name))")
    .eq("id", projectId)
    .eq("client_id", contact.client_id)
    .single();

  if (!project) notFound();

  const { data: tasks } = await supabase
    .from("tasks")
    .select("id, title, priority, due_date, department_stages(name, color, is_terminal), departments(name)")
    .eq("project_id", projectId)
    .order("due_date", { ascending: true });

  const { data: deliverables } = await supabase
    .from("deliverables")
    .select("*, deliverable_revisions(action, note, created_at, profiles:actor_profile_id(full_name))")
    .eq("project_id", projectId)
    .in("status", ["client_review", "approved", "revision_requested"])
    .order("submitted_at", { ascending: false });

  const { data: comments } = await supabase
    .from("comments")
    .select("*, profiles:author_profile_id(full_name)")
    .eq("entity_type", "project")
    .eq("entity_id", projectId)
    .eq("is_client_visible", true)
    .order("created_at", { ascending: false });

  const depts = (project.project_departments as { departments?: { name: string } }[]) ?? [];
  const statusColors: Record<string, "default" | "secondary" | "success" | "warning" | "destructive"> = {
    planning: "secondary",
    active: "default",
    on_hold: "warning",
    completed: "success",
    cancelled: "destructive",
  };

  return (
    <div className="space-y-6">
      <Link href="/portal">
        <Button variant="ghost" size="sm">
          <ArrowLeft className="h-4 w-4" />
          Projects
        </Button>
      </Link>

      {/* Project header */}
      <div>
        <h1 className="text-2xl font-bold text-white">{project.name}</h1>
        {project.description && <p className="text-white/50 mt-1">{project.description}</p>}
        <div className="flex gap-2 mt-3 flex-wrap">
          <Badge variant={statusColors[project.status] ?? "secondary"}>
            {project.status.replace("_", " ")}
          </Badge>
          {depts.map((pd, i) => (
            <span key={i} className="text-xs bg-indigo-500/15 text-indigo-400 border border-indigo-500/20 px-2 py-0.5 rounded-full font-medium">
              {pd.departments?.name}
            </span>
          ))}
        </div>
        {project.target_end_date && (
          <p className="text-sm text-white/30 mt-2">Target completion: {formatDate(project.target_end_date)}</p>
        )}
      </div>

      {/* Task progress */}
      {tasks && tasks.length > 0 && (() => {
        type TaskRow = {
          id: string;
          title: string;
          priority: string;
          due_date: string | null;
          department_stages: { name: string; color: string | null; is_terminal: boolean }[] | null;
          departments: { name: string }[] | null;
        };

        const byDept: Record<string, TaskRow[]> = {};
        for (const t of tasks as TaskRow[]) {
          const dept = t.departments?.[0]?.name ?? "General";
          (byDept[dept] ??= []).push(t);
        }

        const priorityDot: Record<string, string> = {
          low: "bg-white/20",
          medium: "bg-blue-400",
          high: "bg-orange-400",
          urgent: "bg-red-500",
        };

        return (
          <div>
            <h2 className="text-lg font-semibold text-white mb-3">Tasks</h2>
            <div className="space-y-4">
              {Object.entries(byDept).map(([dept, deptTasks]) => (
                <Card key={dept}>
                  <CardHeader className="pb-2 pt-4 px-5">
                    <CardTitle className="text-xs font-semibold text-white/40 uppercase tracking-widest">{dept}</CardTitle>
                  </CardHeader>
                  <CardContent className="p-0 pb-2">
                    <ul className="divide-y divide-white/[0.05]">
                      {deptTasks.map((t) => {
                        const stage = t.department_stages?.[0] ?? null;
                        const done = stage?.is_terminal ?? false;
                        return (
                          <li key={t.id} className="flex items-center gap-3 px-5 py-3">
                            {done
                              ? <CheckCircle className="h-4 w-4 text-green-400 shrink-0" />
                              : <span className="h-4 w-4 rounded-full border-2 border-white/25 shrink-0" />
                            }
                            <span className={`flex-1 text-sm font-medium ${done ? "text-white/30 line-through" : "text-white/85"}`}>
                              {t.title}
                            </span>
                            {stage && (
                              <span
                                className="text-xs font-medium px-2 py-0.5 rounded-full shrink-0"
                                style={{
                                  backgroundColor: stage.color ? `${stage.color}30` : "rgba(255,255,255,0.08)",
                                  color: stage.color ?? "rgba(255,255,255,0.5)",
                                  border: `1px solid ${stage.color ? `${stage.color}60` : "rgba(255,255,255,0.12)"}`,
                                }}
                              >
                                {stage.name}
                              </span>
                            )}
                            <span className={`h-2 w-2 rounded-full shrink-0 ${priorityDot[t.priority] ?? "bg-white/20"}`} title={PRIORITY_LABELS[t.priority as keyof typeof PRIORITY_LABELS]} />
                            {t.due_date && (
                              <span className="text-xs text-white/30 shrink-0">{formatDate(t.due_date)}</span>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        );
      })()}

      {/* Deliverables for review */}
      <div>
        <h2 className="text-lg font-semibold text-white mb-3">Deliverables</h2>
        {deliverables?.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center">
              <Package className="h-10 w-10 text-white/20 mx-auto mb-3" />
              <p className="text-white/40">No deliverables ready for review yet</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {deliverables?.map((d) => {
              const revisions = (d.deliverable_revisions as { action: string; note: string | null; created_at: string; profiles: { full_name: string } }[]) ?? [];
              const latest = revisions[0];
              const canAct = d.status === "client_review";

              return (
                <Card key={d.id}>
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs bg-white/[0.08] text-white/60 px-2 py-0.5 rounded-full">
                            {DELIVERABLE_TYPE_LABELS[d.type as keyof typeof DELIVERABLE_TYPE_LABELS]}
                          </span>
                          <span className="text-xs text-white/30">v{d.version}</span>
                        </div>
                        <p className="font-semibold text-white/90">{d.title}</p>
                        <p className="text-xs text-white/30 mt-0.5">{formatDate(d.submitted_at)}</p>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <Badge variant={statusVariants[d.status] ?? "secondary"}>
                          {DELIVERABLE_STATUS_LABELS[d.status as keyof typeof DELIVERABLE_STATUS_LABELS]}
                        </Badge>
                        <a
                          href={d.dropbox_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-sm text-indigo-400 hover:text-indigo-300"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                          View file
                        </a>
                      </div>
                    </div>

                    {latest && (
                      <div className="text-sm bg-white/[0.05] rounded-lg px-3 py-2 mb-3">
                        <span className="font-medium text-white/80">
                          {latest.action === "approve" ? "✓ You approved this" : "↩ You requested changes"}
                        </span>
                        {latest.note && <p className="text-white/50 mt-0.5 text-sm">{latest.note}</p>}
                        <p className="text-xs text-white/30 mt-1">{formatRelative(latest.created_at)}</p>
                      </div>
                    )}

                    {canAct && (
                      <ClientRevisionForm deliverableId={d.id} actorProfileId={user.id} />
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Comments from agency */}
      {comments && comments.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-white mb-3">Updates from your team</h2>
          <Card>
            <CardContent className="p-0 divide-y divide-white/[0.06]">
              {comments.map((c) => (
                <div key={c.id} className="px-5 py-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-white/80">
                      {(c.profiles as { full_name: string })?.full_name}
                    </span>
                    <span className="text-xs text-white/30">{formatRelative(c.created_at)}</span>
                  </div>
                  <p className="text-sm text-white/60">{c.body}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

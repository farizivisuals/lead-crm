import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Clock } from "lucide-react";
import { formatRelative } from "@/lib/utils";

export default async function ActivityPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const supabase = await createClient();

  const { data: project } = await supabase
    .from("projects")
    .select("name")
    .eq("id", projectId)
    .single();

  if (!project) notFound();

  const { data: history } = await supabase
    .from("task_stage_history")
    .select("*, tasks(title), from_stage:from_stage_id(name), to_stage:to_stage_id(name), profiles:moved_by(full_name)")
    .eq("tasks.project_id", projectId)
    .order("moved_at", { ascending: false })
    .limit(50);

  const { data: comments } = await supabase
    .from("comments")
    .select("*, profiles:author_profile_id(full_name)")
    .eq("entity_type", "project")
    .eq("entity_id", projectId)
    .order("created_at", { ascending: false })
    .limit(20);

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <Link href={`/admin/projects/${projectId}`}>
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4" />
            {project.name}
          </Button>
        </Link>
        <span className="text-gray-400">/</span>
        <h1 className="text-xl font-bold text-gray-900">Activity</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Stage Changes</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {!history?.length ? (
            <p className="px-6 pb-6 text-sm text-gray-400">No stage changes yet</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {history.map((h) => (
                <li key={h.id} className="px-6 py-3 flex items-start gap-3">
                  <Clock className="h-4 w-4 text-gray-300 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm text-gray-700">
                      <span className="font-medium">{(h.profiles as { full_name: string })?.full_name}</span>
                      {" moved "}
                      <span className="font-medium">{(h.tasks as { title: string })?.title}</span>
                      {h.from_stage && (
                        <> from <span className="text-gray-500">{(h.from_stage as { name: string })?.name}</span></>
                      )}
                      {" → "}
                      <span className="text-blue-600">{(h.to_stage as { name: string })?.name}</span>
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">{formatRelative(h.moved_at)}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {comments && comments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Comments</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ul className="divide-y divide-gray-100">
              {comments.map((c) => (
                <li key={c.id} className="px-6 py-3">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium text-gray-800">
                      {(c.profiles as { full_name: string })?.full_name}
                    </span>
                    {!c.is_client_visible && (
                      <span className="text-xs bg-yellow-50 text-yellow-700 px-1.5 py-0.5 rounded">Internal</span>
                    )}
                    <span className="text-xs text-gray-400 ml-auto">{formatRelative(c.created_at)}</span>
                  </div>
                  <p className="text-sm text-gray-600">{c.body}</p>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

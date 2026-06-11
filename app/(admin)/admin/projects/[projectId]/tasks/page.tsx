import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import StageBoard from "@/components/kanban/StageBoard";
import NewTaskDialog from "./NewTaskDialog";

export default async function TasksPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const supabase = await createClient();

  const { data: project } = await supabase
    .from("projects")
    .select("name, project_departments(department_id, is_primary, departments(id, name, slug))")
    .eq("id", projectId)
    .single();

  if (!project) notFound();

  const depts = (project.project_departments as unknown as {
    department_id: string;
    is_primary: boolean;
    departments: { id: string; name: string; slug: string };
  }[]);

  const deptIds = depts.map((d) => d.department_id);

  const [{ data: stages }, { data: tasks }, { data: employees }, { data: creativeRows }] = await Promise.all([
    supabase
      .from("department_stages")
      .select("*")
      .in("department_id", deptIds)
      .order("position"),
    supabase
      .from("tasks")
      .select("*, department_stages(*), departments(name), employees(profiles(full_name)), task_creatives(profile_id, employees(profiles(full_name)))")
      .eq("project_id", projectId)
      .order("created_at"),
    supabase
      .from("employees")
      .select("profile_id, profiles(full_name), department_id")
      .in("department_id", deptIds),
    supabase
      .from("project_creatives")
      .select("profile_id, employees(profiles(full_name))")
      .eq("project_id", projectId),
  ]);

  const projectCreatives = (creativeRows ?? []).map((c) => ({
    profile_id: c.profile_id as string,
    full_name:
      (c.employees as unknown as { profiles?: { full_name: string } } | null)?.profiles?.full_name ?? "Unknown",
  }));

  const stagesByDept = depts.reduce<
    Record<string, { stages: typeof stages; dept: { id: string; name: string; slug: string } }>
  >((acc, pd) => {
    acc[pd.department_id] = {
      dept: pd.departments,
      stages: (stages ?? []).filter((s) => s.department_id === pd.department_id),
    };
    return acc;
  }, {});

  return (
    <div className="space-y-6 animate-slide-up">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <Link href={`/admin/projects/${projectId}`}>
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline">{project.name}</span>
            </Button>
          </Link>
          <span className="text-white/20">/</span>
          <h1 className="text-lg lg:text-xl font-bold text-white">Tasks</h1>
        </div>
        <NewTaskDialog
          projectId={projectId}
          departments={depts.map((d) => d.departments)}
          stages={stages ?? []}
          employees={(employees ?? []) as unknown as { profile_id: string; profiles?: { full_name: string } | null; department_id: string | null }[]}
          creatives={projectCreatives}
        />
      </div>

      {/* Kanban boards per department */}
      <div className="space-y-8">
        {Object.values(stagesByDept).map(({ dept, stages: deptStages }) => {
          const deptTasks = (tasks ?? []).filter((t) => t.department_id === dept.id);
          return (
            <div key={dept.id}>
              <StageBoard
                stages={deptStages ?? []}
                tasks={deptTasks}
                employees={(employees ?? []).filter(
                  (e) => (e as unknown as { department_id: string | null }).department_id === dept.id
                ) as unknown as { profile_id: string; profiles?: { full_name: string } | null; department_id: string | null }[]}
                creatives={projectCreatives}
                deptName={dept.name}
                deptSlug={dept.slug}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

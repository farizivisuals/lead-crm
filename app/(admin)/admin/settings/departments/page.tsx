import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import StagesEditor from "./StagesEditor";
import { requireExecutive } from "@/lib/auth/guards";

export default async function DepartmentsSettingsPage() {
  await requireExecutive();
  const supabase = await createClient();

  const [{ data: departments }, { data: stages }] = await Promise.all([
    supabase.from("departments").select("*").order("name"),
    supabase.from("department_stages").select("*").order("position"),
  ]);

  const stagesByDept = (departments ?? []).reduce<Record<string, typeof stages>>((acc, dept) => {
    acc[dept.id] = (stages ?? []).filter((s) => s.department_id === dept.id);
    return acc;
  }, {});

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Department Stages</h1>
        <p className="text-gray-500 text-sm mt-1">
          Customize the workflow stages for each department. These define the Kanban columns.
        </p>
      </div>

      {departments?.map((dept) => (
        <Card key={dept.id}>
          <CardHeader>
            <CardTitle className="text-base">{dept.name}</CardTitle>
          </CardHeader>
          <CardContent>
            <StagesEditor
              departmentId={dept.id}
              departmentName={dept.name}
              initialStages={stagesByDept[dept.id] ?? []}
            />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

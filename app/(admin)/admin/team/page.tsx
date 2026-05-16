import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ROLE_LABELS } from "@/lib/rbac";
import AddEmployeeDialog from "./AddEmployeeDialog";

export default async function TeamPage() {
  const supabase = await createClient();

  // Only root can manage team
  const { data: { user } } = await supabase.auth.getUser();
  const { data: emp } = await supabase.from("employees").select("role").eq("profile_id", user!.id).single();
  if (emp?.role !== "root") redirect("/admin/dashboard");

  const [{ data: employees }, { data: departments }] = await Promise.all([
    supabase
      .from("employees")
      .select("*, profiles(*), departments(name)")
      .order("role"),
    supabase.from("departments").select("*").order("name"),
  ]);

  type EmpArr = NonNullable<typeof employees>;
  const byDept: Record<string, EmpArr> = {};
  const noDept: EmpArr = [];

  (employees ?? []).forEach((e) => {
    if (e.department_id) {
      byDept[e.department_id] = byDept[e.department_id] ?? [];
      byDept[e.department_id]!.push(e);
    } else {
      noDept.push(e);
    }
  });

  const roleVariants: Record<string, "default" | "secondary" | "warning" | "success"> = {
    root: "default",
    ceo: "default",
    cfo: "warning",
    manager: "success",
    employee: "secondary",
  };

  type EmpRecord = NonNullable<typeof employees>[number];
  function EmployeeCard({ e }: { e: EmpRecord }) {
    const name = (e.profiles as unknown as { full_name: string; avatar_url: string | null })?.full_name ?? "";
    const initials = name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2);
    return (
      <div className="flex items-center gap-3 py-2">
        <Avatar className="h-8 w-8">
          <AvatarImage src={(e.profiles as unknown as { avatar_url: string | null })?.avatar_url ?? undefined} />
          <AvatarFallback className="text-xs">{initials}</AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900 truncate">{name}</p>
          {e.title && <p className="text-xs text-gray-400 truncate">{e.title}</p>}
        </div>
        <Badge variant={roleVariants[e.role as string] ?? "secondary"} className="text-xs">
          {ROLE_LABELS[e.role as keyof typeof ROLE_LABELS]}
        </Badge>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Team</h1>
          <p className="text-gray-500 text-sm mt-1">{employees?.length ?? 0} members</p>
        </div>
        <AddEmployeeDialog departments={departments ?? []} />
      </div>

      {/* Executives (no dept) */}
      {noDept.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Executive Team</CardTitle>
          </CardHeader>
          <CardContent className="divide-y divide-gray-100">
            {noDept.map((e) => <EmployeeCard key={e.profile_id} e={e} />)}
          </CardContent>
        </Card>
      )}

      {/* By department */}
      {departments?.map((dept) => {
        const members = byDept[dept.id] ?? [];
        if (members.length === 0) return null;
        return (
          <Card key={dept.id}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{dept.name}</CardTitle>
            </CardHeader>
            <CardContent className="divide-y divide-gray-100">
              {members.map((e) => <EmployeeCard key={e.profile_id} e={e} />)}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

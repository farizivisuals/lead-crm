import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ROLE_LABELS } from "@/lib/rbac";
import type { EmployeeRole } from "@/lib/types";
import AddEmployeeDialog from "./AddEmployeeDialog";
import EditEmployeeDialog from "./EditEmployeeDialog";
import { resetEmployeePassword } from "./actions";
import CredentialsPopover from "@/components/ui/InviteLinkPopover";
import { Users } from "lucide-react";

export default async function TeamPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  const { data: emp } = await supabase.from("employees").select("role").eq("profile_id", user!.id).single();
  if (emp?.role !== "root") redirect("/admin/dashboard");

  const [{ data: employees }, { data: departments }] = await Promise.all([
    supabase.from("employees").select("*, profiles(*), departments(name)").order("role"),
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
  function EmployeeRow({ e }: { e: EmpRecord }) {
    const name = (e.profiles as unknown as { full_name: string; avatar_url: string | null })?.full_name ?? "";
    const initials = name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2);
    return (
      <div className="flex items-center gap-3 py-3 border-b border-white/[0.05] last:border-0">
        <Avatar className="h-8 w-8 flex-shrink-0 ring-1 ring-white/10">
          <AvatarImage src={(e.profiles as unknown as { avatar_url: string | null })?.avatar_url ?? undefined} />
          <AvatarFallback className="text-xs bg-white/[0.1] text-zinc-300 font-semibold">{initials}</AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-white/90 truncate">{name}</p>
          {e.title && <p className="text-xs text-white/40 truncate">{e.title}</p>}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <EditEmployeeDialog
            profileId={e.profile_id}
            initialData={{
              full_name: name,
              role: e.role as EmployeeRole,
              department_id: e.department_id,
              title: e.title,
            }}
            departments={departments ?? []}
          />
          <CredentialsPopover getCredentials={resetEmployeePassword.bind(null, e.profile_id)} />
          <Badge variant={roleVariants[e.role as string] ?? "secondary"} className="text-xs">
            {ROLE_LABELS[e.role as keyof typeof ROLE_LABELS]}
          </Badge>
        </div>
      </div>
    );
  }

  function Section({ title, members }: { title: string; members: EmpArr }) {
    if (!members.length) return null;
    return (
      <div className="rounded-2xl bg-white/[0.04] backdrop-blur-xl border border-white/[0.08] overflow-hidden">
        <div className="px-4 lg:px-5 py-3.5 border-b border-white/[0.07]">
          <p className="text-sm font-semibold text-white/80">{title}</p>
          <p className="text-xs text-white/30 mt-0.5">{members.length} member{members.length !== 1 ? "s" : ""}</p>
        </div>
        <div className="px-4 lg:px-5">
          {members.map((e) => <EmployeeRow key={e.profile_id} e={e} />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-slide-up max-w-3xl">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Users className="h-3.5 w-3.5 text-zinc-400" />
            <span className="text-xs text-zinc-400 font-medium uppercase tracking-widest">Team</span>
          </div>
          <h1 className="text-xl lg:text-2xl font-bold text-white tracking-tight">Team Members</h1>
          <p className="text-white/40 text-sm mt-1">{employees?.length ?? 0} members across all departments</p>
        </div>
        <AddEmployeeDialog departments={departments ?? []} />
      </div>

      <Section title="Executive Team" members={noDept} />

      {departments?.map((dept) => (
        <Section key={dept.id} title={dept.name} members={byDept[dept.id] ?? []} />
      ))}
    </div>
  );
}

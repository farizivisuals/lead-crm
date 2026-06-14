import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Plus, Building2, Phone, ArrowUpRight, Users, Layers } from "lucide-react";
import DeptFilter from "@/components/filters/DeptFilter";
import CredentialsPopover from "@/components/ui/InviteLinkPopover";
import { resetClientPassword } from "./new/actions";
import EditClientDialog from "./EditClientDialog";
import { isExecutive } from "@/lib/rbac";

interface Props {
  searchParams: Promise<{ dept_id?: string }>;
}

export default async function ClientsPage({ searchParams }: Props) {
  const { dept_id } = await searchParams;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  const { data: employee } = await supabase
    .from("employees")
    .select("role, department_id, departments(name)")
    .eq("profile_id", user!.id)
    .single();

  const isExec = isExecutive(employee?.role ?? "employee");
  const isRoot = employee?.role === "root";
  const myDeptName = (employee?.departments as unknown as { name: string } | null)?.name;

  const { data: departments } = isExec
    ? await supabase.from("departments").select("id, name").order("name")
    : { data: null };

  let clientsQuery = supabase
    .from("clients")
    .select("*, profiles:primary_contact_profile_id(full_name)")
    .order("created_at", { ascending: false });

  if (isExec && dept_id) {
    const { data: projectDepts } = await supabase
      .from("project_departments")
      .select("project_id")
      .eq("department_id", dept_id);

    const projectIds = (projectDepts ?? []).map((p) => p.project_id);

    if (projectIds.length > 0) {
      const { data: projectRows } = await supabase
        .from("projects")
        .select("client_id")
        .in("id", projectIds);

      const clientIds = [...new Set((projectRows ?? []).map((p) => p.client_id as string))];

      if (clientIds.length > 0) {
        clientsQuery = clientsQuery.in("id", clientIds) as typeof clientsQuery;
      } else {
        clientsQuery = clientsQuery.in("id", ["00000000-0000-0000-0000-000000000000"]) as typeof clientsQuery;
      }
    } else {
      clientsQuery = clientsQuery.in("id", ["00000000-0000-0000-0000-000000000000"]) as typeof clientsQuery;
    }
  }

  const { data: clients } = await clientsQuery;

  return (
    <div className="space-y-8 animate-slide-up">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold text-white/25 uppercase tracking-[0.12em] mb-2">Clients</p>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            {isExec && dept_id
              ? `${(departments ?? []).find((d) => d.id === dept_id)?.name ?? "Dept"} Clients`
              : "Your Clients"}
          </h1>
          <p className="text-white/35 text-sm mt-1">
            {clients?.length ?? 0} client{(clients?.length ?? 0) !== 1 ? "s" : ""}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0 mt-1">
          {!isExec && myDeptName && (
            <div className="flex items-center gap-1.5 h-8 px-3 rounded-xl bg-white/[0.06] border border-white/[0.1]">
              <Layers className="h-3.5 w-3.5 text-white/40" />
              <span className="text-xs font-medium text-white/60">{myDeptName}</span>
            </div>
          )}
          {isExec && (
            <DeptFilter departments={departments ?? []} currentDeptId={dept_id} />
          )}
          <Link href="/admin/clients/new">
            <Button size="sm">
              <Plus className="h-4 w-4" />
              Add Client
            </Button>
          </Link>
        </div>
      </div>

      {/* Empty state */}
      {clients?.length === 0 ? (
        <div className="rounded-2xl bg-white/[0.03] border border-white/[0.07] py-20 text-center">
          <div className="w-14 h-14 rounded-2xl bg-white/[0.05] border border-white/[0.08] flex items-center justify-center mx-auto mb-4">
            <Building2 className="h-6 w-6 text-white/20" />
          </div>
          <p className="text-white/50 font-medium text-sm">No clients yet</p>
          <p className="text-xs text-white/25 mt-1 mb-6">
            {isExec && dept_id ? "No clients linked to this department." : "Add your first client to get started."}
          </p>
          {(!isExec || !dept_id) && (
            <Link href="/admin/clients/new">
              <Button size="sm">
                <Plus className="h-4 w-4" />
                Add Client
              </Button>
            </Link>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {clients?.map((client) => (
            <div
              key={client.id}
              className="group relative rounded-2xl bg-white/[0.03] border border-white/[0.07] hover:bg-white/[0.06] hover:border-white/[0.12] hover:-translate-y-0.5 hover:shadow-xl hover:shadow-black/30 transition-all duration-300 overflow-hidden"
            >
              {/* Top highlight line */}
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/[0.1] to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

              <Link href={`/admin/clients/${client.id}`} className="flex items-start gap-4 p-5 pb-4">
                <div className="w-10 h-10 rounded-xl bg-white/[0.06] border border-white/[0.1] flex items-center justify-center flex-shrink-0 group-hover:bg-white/[0.1] transition-colors">
                  <Building2 className="h-4.5 w-4.5 text-zinc-300 h-[18px] w-[18px]" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-white/80 group-hover:text-white transition-colors truncate text-sm">
                    {client.company_name}
                  </p>
                  <div className="flex items-center gap-1.5 mt-1">
                    <Users className="h-3 w-3 text-white/25 flex-shrink-0" />
                    <p className="text-xs text-white/35 truncate">
                      {(client.profiles as { full_name: string })?.full_name}
                    </p>
                  </div>
                  {client.phone && (
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <Phone className="h-3 w-3 text-white/25 flex-shrink-0" />
                      <p className="text-xs text-white/35">{client.phone}</p>
                    </div>
                  )}
                </div>
                <ArrowUpRight className="h-4 w-4 text-white/15 group-hover:text-white/40 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all duration-200 flex-shrink-0 mt-0.5" />
              </Link>

              {/* Footer actions */}
              <div className="px-5 pb-4 flex items-center justify-end gap-2 pt-1 border-t border-white/[0.05]">
                {isRoot && (
                  <EditClientDialog
                    clientId={client.id}
                    initialData={{
                      company_name: client.company_name,
                      phone: client.phone,
                      notes: client.notes,
                      contact_name: (client.profiles as { full_name: string })?.full_name ?? "",
                    }}
                  />
                )}
                <CredentialsPopover
                  getCredentials={resetClientPassword.bind(null, client.id)}
                  label="Reset password"
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

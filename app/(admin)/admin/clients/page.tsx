import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Plus, Building2, Phone, ArrowUpRight, Users, Layers } from "lucide-react";
import DeptFilter from "@/components/filters/DeptFilter";
import InviteLinkPopover from "@/components/ui/InviteLinkPopover";
import { regenerateClientLink } from "./new/actions";

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

  const isExec = ["root", "ceo", "cfo"].includes(employee?.role ?? "");
  const myDeptName = (employee?.departments as unknown as { name: string } | null)?.name;

  const { data: departments } = isExec
    ? await supabase.from("departments").select("id, name").order("name")
    : { data: null };

  let clientsQuery = supabase
    .from("clients")
    .select("*, profiles:primary_contact_profile_id(full_name)")
    .order("created_at", { ascending: false });

  // Exec dept filter: find clients whose projects involve this dept
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
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Building2 className="h-4 w-4 text-indigo-400" />
            <span className="text-xs text-indigo-400 font-medium uppercase tracking-widest">Clients</span>
          </div>
          <h1 className="text-xl lg:text-2xl font-bold text-white tracking-tight">
            {isExec && dept_id
              ? `${(departments ?? []).find((d) => d.id === dept_id)?.name ?? "Dept"} Clients`
              : "Your Clients"}
          </h1>
          <p className="text-white/40 text-sm mt-1">{clients?.length ?? 0} client{(clients?.length ?? 0) !== 1 ? "s" : ""}</p>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0 mt-1">
          {!isExec && myDeptName && (
            <div className="flex items-center gap-1.5 h-8 px-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20">
              <Layers className="h-3.5 w-3.5 text-indigo-400" />
              <span className="text-xs font-medium text-indigo-300">{myDeptName}</span>
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

      {clients?.length === 0 ? (
        <div className="rounded-2xl bg-white/[0.04] backdrop-blur-xl border border-white/[0.08] py-20 text-center">
          <div className="w-14 h-14 rounded-2xl bg-white/[0.06] border border-white/[0.08] flex items-center justify-center mx-auto mb-4">
            <Building2 className="h-7 w-7 text-white/20" />
          </div>
          <p className="text-white/60 font-medium">No clients yet</p>
          <p className="text-sm text-white/30 mt-1 mb-5">
            {isExec && dept_id ? "No clients are linked to this department." : "Add your first client to get started."}
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
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {clients?.map((client) => (
            <div key={client.id} className="group relative rounded-2xl bg-white/[0.04] backdrop-blur-xl border border-white/[0.08] hover:bg-white/[0.07] hover:border-white/[0.14] hover:shadow-xl hover:shadow-black/30 hover:-translate-y-0.5 transition-all duration-300 overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 rounded-full blur-3xl bg-indigo-500/5 group-hover:bg-indigo-500/10 transition-all duration-500" />

              <Link href={`/admin/clients/${client.id}`} className="relative flex items-start gap-4 p-5 pb-3">
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-indigo-500/20 to-violet-500/10 border border-indigo-500/20 flex items-center justify-center flex-shrink-0">
                  <Building2 className="h-5 w-5 text-indigo-400" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-white/90 group-hover:text-white transition-colors truncate">
                    {client.company_name}
                  </p>
                  <div className="flex items-center gap-1.5 mt-1">
                    <Users className="h-3 w-3 text-white/30" />
                    <p className="text-sm text-white/40 truncate">
                      {(client.profiles as { full_name: string })?.full_name}
                    </p>
                  </div>
                  {client.phone && (
                    <div className="flex items-center gap-1.5 mt-1">
                      <Phone className="h-3 w-3 text-white/30" />
                      <p className="text-sm text-white/40">{client.phone}</p>
                    </div>
                  )}
                </div>
                <ArrowUpRight className="h-4 w-4 text-white/20 group-hover:text-white/50 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all duration-200 flex-shrink-0" />
              </Link>

              {/* Footer with portal link action */}
              <div className="relative px-5 pb-3.5 flex items-center justify-end">
                <InviteLinkPopover
                  getLink={regenerateClientLink.bind(null, client.id)}
                  label="Portal link"
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

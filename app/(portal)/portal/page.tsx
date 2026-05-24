import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { FolderOpen, ArrowUpRight, Calendar } from "lucide-react";
import { formatDate } from "@/lib/utils";

const statusColors: Record<string, "default" | "secondary" | "success" | "warning" | "destructive"> = {
  planning: "secondary",
  active: "default",
  on_hold: "warning",
  completed: "success",
  cancelled: "destructive",
  delivered: "success",
};

export default async function PortalHomePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: contact } = await supabase
    .from("client_contacts")
    .select("client_id, clients(company_name)")
    .eq("profile_id", user.id)
    .single();

  if (!contact) redirect("/login");

  const { data: projects } = await supabase
    .from("projects")
    .select("*, project_departments(*, departments(name, slug))")
    .eq("client_id", contact.client_id)
    .order("updated_at", { ascending: false });

  return (
    <div className="space-y-8 animate-slide-up">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <FolderOpen className="h-4 w-4 text-zinc-400" />
          <span className="text-xs text-zinc-400 font-medium uppercase tracking-widest">Your Projects</span>
        </div>
        <h1 className="text-2xl font-bold text-white tracking-tight">
          {(contact.clients as unknown as { company_name: string })?.company_name}
        </h1>
        <p className="text-white/40 text-sm mt-1">{projects?.length ?? 0} active projects</p>
      </div>

      {projects?.length === 0 ? (
        <div className="rounded-2xl bg-white/[0.04] backdrop-blur-xl border border-white/[0.08] py-20 text-center">
          <div className="w-14 h-14 rounded-2xl bg-white/[0.06] border border-white/[0.08] flex items-center justify-center mx-auto mb-4">
            <FolderOpen className="h-7 w-7 text-white/20" />
          </div>
          <p className="text-white/60 font-medium">No projects yet</p>
          <p className="text-sm text-white/30 mt-1">Your projects will appear here once they&apos;re created</p>
        </div>
      ) : (
        <div className="space-y-3">
          {projects?.map((project) => {
            const depts = (project.project_departments as { departments?: { name: string } }[]) ?? [];
            return (
              <Link key={project.id} href={`/portal/projects/${project.id}`}>
                <div className="group flex items-center justify-between gap-4 rounded-2xl bg-white/[0.04] backdrop-blur-xl border border-white/[0.08] p-5 hover:bg-white/[0.07] hover:border-white/[0.14] hover:shadow-xl hover:shadow-black/20 hover:-translate-y-px transition-all duration-200 cursor-pointer">
                  <div className="min-w-0">
                    <p className="font-semibold text-white/90 group-hover:text-white transition-colors">
                      {project.name}
                    </p>
                    {project.description && (
                      <p className="text-sm text-white/40 mt-0.5 line-clamp-1">{project.description}</p>
                    )}
                    {depts.length > 0 && (
                      <div className="flex gap-1.5 mt-2 flex-wrap">
                        {depts.map((pd, i) => (
                          <span
                            key={i}
                            className="text-xs bg-white/[0.07] text-zinc-300 border border-white/[0.12] px-2 py-0.5 rounded-full font-medium"
                          >
                            {pd.departments?.name}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-2 flex-shrink-0">
                    <Badge variant={statusColors[project.status] ?? "secondary"}>
                      {project.status.replace("_", " ")}
                    </Badge>
                    {project.target_end_date && (
                      <span className="flex items-center gap-1 text-xs text-white/30">
                        <Calendar className="h-3 w-3" />
                        {formatDate(project.target_end_date)}
                      </span>
                    )}
                    <ArrowUpRight className="h-4 w-4 text-white/20 group-hover:text-white/50 transition-all" />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

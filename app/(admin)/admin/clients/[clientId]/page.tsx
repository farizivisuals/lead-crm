import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft, ArrowUpRight, Building2, Calendar,
  FolderOpen, Phone, FileText, Plus, User,
} from "lucide-react";
import { formatDate } from "@/lib/utils";
import QuoteDialog from "./QuoteDialog";

export default async function ClientDetailPage({ params }: { params: Promise<{ clientId: string }> }) {
  const { clientId } = await params;
  const supabase = await createClient();

  const { data: client } = await supabase
    .from("clients")
    .select("*, profiles:primary_contact_profile_id(full_name, avatar_url)")
    .eq("id", clientId)
    .single();

  if (!client) notFound();

  const { data: projects } = await supabase
    .from("projects")
    .select("*, project_departments(*, departments(name, slug))")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false });

  const statusColors: Record<string, "default" | "secondary" | "success" | "warning" | "destructive"> = {
    planning: "secondary",
    active: "default",
    on_hold: "warning",
    completed: "success",
    cancelled: "destructive",
    delivered: "success",
  };

  const primaryContact = client.profiles as { full_name: string } | null;

  return (
    <div className="space-y-6 animate-slide-up max-w-4xl">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 flex-wrap">
        <Link href="/admin/clients">
          <Button variant="ghost" size="sm" className="gap-1.5">
            <ArrowLeft className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Clients</span>
          </Button>
        </Link>
        <span className="text-white/20">/</span>
        <span className="text-sm text-white/40 truncate max-w-[200px]">{client.company_name}</span>
      </div>

      {/* Client info card */}
      <div className="rounded-2xl bg-white/[0.04] backdrop-blur-xl border border-white/[0.08] p-5 lg:p-6">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-white/[0.07] border border-white/[0.12] flex items-center justify-center flex-shrink-0">
            <Building2 className="h-5 w-5 text-zinc-300" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3">
              <h1 className="text-xl lg:text-2xl font-bold text-white tracking-tight">{client.company_name}</h1>
              <QuoteDialog clientId={client.id} clientName={client.company_name} />
            </div>
            {primaryContact && (
              <div className="flex items-center gap-1.5 mt-1.5 text-sm text-white/40">
                <User className="h-3.5 w-3.5" />
                <span>{primaryContact.full_name}</span>
              </div>
            )}
          </div>
        </div>

        {(client.phone || client.notes) && (
          <div className="mt-4 pt-4 border-t border-white/[0.07] space-y-3">
            {client.phone && (
              <div className="flex items-center gap-2 text-sm text-white/50">
                <Phone className="h-3.5 w-3.5 text-white/30" />
                {client.phone}
              </div>
            )}
            {client.notes && (
              <div className="flex items-start gap-2 text-sm text-white/50">
                <FileText className="h-3.5 w-3.5 text-white/30 mt-0.5 flex-shrink-0" />
                <p className="leading-relaxed">{client.notes}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Projects header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <FolderOpen className="h-3.5 w-3.5 text-zinc-400" />
            <span className="text-xs text-zinc-400 font-medium uppercase tracking-widest">Projects</span>
          </div>
          <p className="text-white/40 text-sm">{projects?.length ?? 0} projects</p>
        </div>
        <Link href="/admin/projects">
          <Button size="sm">
            <Plus className="h-4 w-4" />
            New Project
          </Button>
        </Link>
      </div>

      {/* Projects list */}
      {projects?.length === 0 ? (
        <div className="rounded-2xl bg-white/[0.04] backdrop-blur-xl border border-white/[0.08] py-16 text-center">
          <div className="w-12 h-12 rounded-2xl bg-white/[0.06] border border-white/[0.08] flex items-center justify-center mx-auto mb-3">
            <FolderOpen className="h-6 w-6 text-white/20" />
          </div>
          <p className="text-white/50 font-medium">No projects yet</p>
          <p className="text-sm text-white/30 mt-1">Projects for this client will appear here</p>
        </div>
      ) : (
        <div className="space-y-2">
          {projects?.map((project) => {
            const depts = (project.project_departments as { departments?: { name: string; slug: string } }[]) ?? [];
            return (
              <Link key={project.id} href={`/admin/projects/${project.id}`}>
                <div className="group flex items-center justify-between gap-4 rounded-2xl bg-white/[0.04] backdrop-blur-xl border border-white/[0.08] p-5 hover:bg-white/[0.07] hover:border-white/[0.14] hover:shadow-xl hover:shadow-black/20 hover:-translate-y-px transition-all duration-200 cursor-pointer">
                  <div className="min-w-0">
                    <p className="font-semibold text-white/90 group-hover:text-white transition-colors">
                      {project.name}
                    </p>
                    {project.description && (
                      <p className="text-sm text-white/30 mt-0.5 line-clamp-1">{project.description}</p>
                    )}
                    {depts.length > 0 && (
                      <div className="flex gap-1.5 mt-2 flex-wrap">
                        {depts.map((pd) => (
                          <span
                            key={pd.departments?.slug}
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
                    <ArrowUpRight className="h-4 w-4 text-white/20 group-hover:text-white/50 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all duration-200" />
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

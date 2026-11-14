"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Layers, X } from "lucide-react";

export interface AssignedDepartment {
  department_id: string;
  name: string;
  slug: string;
  is_primary: boolean;
}

interface Props {
  projectId: string;
  assigned: AssignedDepartment[];
  allDepartments: { id: string; name: string; slug: string }[];
}

export default function ProjectDepartments({ projectId, assigned, allDepartments }: Props) {
  const router = useRouter();
  const [supabase] = useState(() => createClient());
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const available = allDepartments.filter(
    (d) => !assigned.some((a) => a.department_id === d.id)
  );

  async function addDepartment(department_id: string) {
    setError(null);
    setBusy(true);
    const { error: err } = await supabase
      .from("project_departments")
      .insert({ project_id: projectId, department_id, is_primary: assigned.length === 0 });
    setBusy(false);
    if (err) { setError(err.message); return; }
    router.refresh();
  }

  async function removeDepartment(dept: AssignedDepartment) {
    setError(null);
    if (assigned.length === 1) { setError("A project needs at least one department."); return; }
    setBusy(true);

    // Tasks belong to a department; dropping it would hide them from the board.
    const { count, error: countErr } = await supabase
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .eq("project_id", projectId)
      .eq("department_id", dept.department_id);
    if (countErr) { setError(countErr.message); setBusy(false); return; }
    if (count) {
      setError(`${dept.name} still has ${count} task${count === 1 ? "" : "s"} on this project. Move or delete them first.`);
      setBusy(false);
      return;
    }

    const { error: delErr } = await supabase
      .from("project_departments")
      .delete()
      .eq("project_id", projectId)
      .eq("department_id", dept.department_id);
    if (delErr) { setError(delErr.message); setBusy(false); return; }

    if (dept.is_primary) {
      const next = assigned.find((a) => a.department_id !== dept.department_id)!;
      await supabase
        .from("project_departments")
        .update({ is_primary: true })
        .eq("project_id", projectId)
        .eq("department_id", next.department_id);
    }
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="mt-4 pt-4 border-t border-white/[0.08]">
      <div className="flex items-center gap-1.5 mb-2">
        <Layers className="h-3.5 w-3.5 text-white/30" />
        <span className="text-xs font-medium uppercase tracking-widest text-white/40">Departments</span>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        {assigned.map((d) => (
          <span
            key={d.department_id}
            className="flex items-center gap-1.5 text-xs bg-white/[0.07] text-zinc-300 border border-white/[0.12] pl-2.5 pr-1.5 py-0.5 rounded-full font-medium"
          >
            {d.name}
            {d.is_primary && <span className="text-white/30">· primary</span>}
            <button
              onClick={() => removeDepartment(d)}
              disabled={busy}
              className="text-white/25 hover:text-red-400 transition-colors disabled:opacity-40"
              title={`Remove ${d.name}`}
              aria-label={`Remove ${d.name}`}
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        {available.length > 0 && (
          <Select value="" onValueChange={addDepartment} disabled={busy}>
            <SelectTrigger className="h-6 w-auto rounded-full border-dashed text-xs px-2.5 py-0">
              <SelectValue placeholder="+ Add" />
            </SelectTrigger>
            <SelectContent>
              {available.map((d) => (
                <SelectItem key={d.id} value={d.id}>
                  {d.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>
      {error && <p className="text-xs text-red-400 mt-1.5">{error}</p>}
    </div>
  );
}

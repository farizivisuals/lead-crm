"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/browser";
import type { Task, TaskDeliverable, DepartmentStage } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, Users } from "lucide-react";

interface Employee {
  profile_id: string;
  profiles?: { full_name: string } | null;
}

interface Props {
  task: Task;
  stage: DepartmentStage;
  stages: DepartmentStage[];
  employees: Employee[];
  open: boolean;
  onClose: () => void;
  onSaved: (deliverables: TaskDeliverable[]) => void;
}

const NONE = "_none";

export default function AssignDeliverablesDialog({
  task,
  stage,
  stages,
  employees,
  open,
  onClose,
  onSaved,
}: Props) {
  const [supabase] = useState(() => createClient());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const deliverables = [...(task.task_deliverables ?? [])].sort(
    (a, b) => a.position - b.position
  );

  // Draft assignee per deliverable, seeded from this stage's assignment rows.
  const [draft, setDraft] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      deliverables.map((d) => [
        d.id,
        d.task_deliverable_assignments?.find((a) => a.stage_id === stage.id)
          ?.assigned_to ?? NONE,
      ])
    )
  );

  const employeeName = (id: string) =>
    employees.find((e) => e.profile_id === id)?.profiles?.full_name ?? "?";

  // Earlier-stage assignees, e.g. "Shoot: Sarah", for handoff context.
  function priorContext(d: TaskDeliverable): string[] {
    const earlier = stages.filter((s) => s.position < stage.position);
    return earlier
      .map((s) => {
        const a = d.task_deliverable_assignments?.find(
          (x) => x.stage_id === s.id
        );
        if (!a) return null;
        const name =
          a.employees?.profiles?.full_name ?? employeeName(a.assigned_to);
        return `${s.name}: ${name.split(" ")[0]}`;
      })
      .filter((x): x is string => x !== null);
  }

  function assignAll(profileId: string) {
    setDraft(Object.fromEntries(deliverables.map((d) => [d.id, profileId])));
  }

  async function handleSave() {
    setLoading(true);
    setError(null);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const toUpsert = deliverables
      .filter((d) => draft[d.id] && draft[d.id] !== NONE)
      .map((d) => ({
        deliverable_id: d.id,
        stage_id: stage.id,
        assigned_to: draft[d.id]!,
        assigned_by: user?.id ?? null,
      }));
    const toClear = deliverables
      .filter(
        (d) =>
          (!draft[d.id] || draft[d.id] === NONE) &&
          d.task_deliverable_assignments?.some((a) => a.stage_id === stage.id)
      )
      .map((d) => d.id);

    let err: { message: string } | null = null;
    if (toUpsert.length > 0) {
      ({ error: err } = await supabase
        .from("task_deliverable_assignments")
        .upsert(toUpsert, { onConflict: "deliverable_id,stage_id" }));
    }
    if (!err && toClear.length > 0) {
      ({ error: err } = await supabase
        .from("task_deliverable_assignments")
        .delete()
        .eq("stage_id", stage.id)
        .in("deliverable_id", toClear));
    }

    setLoading(false);
    if (err) {
      setError(err.message);
      return;
    }

    // Synthesize updated assignment rows so the list re-renders without refetch.
    const updated = deliverables.map((d) => {
      const others = (d.task_deliverable_assignments ?? []).filter(
        (a) => a.stage_id !== stage.id
      );
      const assignee = draft[d.id];
      const rows =
        assignee && assignee !== NONE
          ? [
              ...others,
              {
                deliverable_id: d.id,
                stage_id: stage.id,
                assigned_to: assignee,
                assigned_by: user?.id ?? null,
                assigned_at: new Date().toISOString(),
                employees: { profiles: { full_name: employeeName(assignee) } },
              },
            ]
          : others;
      return { ...d, task_deliverable_assignments: rows };
    });

    onSaved(updated);
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Assign deliverables — {stage.name}
          </DialogTitle>
        </DialogHeader>

        <p className="text-sm text-white/40 -mt-2">{task.title}</p>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Assign all to…</Label>
            <Select value="" onValueChange={assignAll}>
              <SelectTrigger>
                <SelectValue placeholder="Pick one person for everything" />
              </SelectTrigger>
              <SelectContent>
                {employees.map((emp) => (
                  <SelectItem key={emp.profile_id} value={emp.profile_id}>
                    {emp.profiles?.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-3">
            {deliverables.map((d) => {
              const context = priorContext(d);
              return (
                <div key={d.id} className="space-y-1">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-medium text-white/80 flex-1 truncate">
                      {d.title}
                    </span>
                    <Select
                      value={draft[d.id] ?? NONE}
                      onValueChange={(v) =>
                        setDraft((prev) => ({ ...prev, [d.id]: v }))
                      }
                    >
                      <SelectTrigger className="w-44">
                        <SelectValue placeholder="Unassigned" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE}>Unassigned</SelectItem>
                        {employees.map((emp) => (
                          <SelectItem key={emp.profile_id} value={emp.profile_id}>
                            {emp.profiles?.full_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {context.length > 0 && (
                    <p className="text-[11px] text-white/30 pl-0.5">
                      {context.join(" · ")}
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex gap-2 pt-1">
            <Button onClick={handleSave} disabled={loading} className="flex-1">
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Save assignments
            </Button>
            <Button type="button" variant="outline" onClick={onClose}>
              Later
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

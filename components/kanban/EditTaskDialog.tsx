"use client";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/browser";
import type { Task, DepartmentStage } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { Loader2, Trash2, AlertTriangle } from "lucide-react";

interface Employee {
  profile_id: string;
  profiles?: { full_name: string } | null;
  department_id: string | null;
}

interface Props {
  task: Task;
  stages: DepartmentStage[];
  employees: Employee[];
  creatives?: { profile_id: string; full_name: string }[];
  open: boolean;
  onClose: () => void;
  onSaved: (updated: Partial<Task>) => void;
  onDeleted: (taskId: string) => void;
}

export default function EditTaskDialog({
  task,
  stages,
  employees,
  creatives = [],
  open,
  onClose,
  onSaved,
  onDeleted,
}: Props) {
  const supabase = createClient();
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conflicting, setConflicting] = useState<{ id: string; title: string }[]>([]);
  const [selectedCreatives, setSelectedCreatives] = useState<string[]>(
    (task.task_creatives ?? []).map((tc) => tc.profile_id)
  );

  const [form, setForm] = useState({
    title: task.title,
    description: task.description ?? "",
    priority: task.priority,
    assigned_to: task.assigned_to ?? "",
    current_stage_id: task.current_stage_id,
    start_date: task.start_date?.slice(0, 10) ?? "",
    due_date: task.due_date?.slice(0, 10) ?? "",
  });

  function field<K extends keyof typeof form>(key: K, value: typeof form[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  // Real-time availability check — exclude the task being edited
  useEffect(() => {
    if (!form.assigned_to || !form.start_date || !form.due_date) {
      setConflicting([]);
      return;
    }
    let cancelled = false;
    supabase
      .from("tasks")
      .select("id, title")
      .eq("assigned_to", form.assigned_to)
      .neq("id", task.id)
      .not("start_date", "is", null)
      .not("due_date", "is", null)
      .lte("start_date", form.due_date)
      .gte("due_date", form.start_date)
      .then(({ data }) => {
        if (!cancelled) setConflicting(data ?? []);
      });
    return () => { cancelled = true; };
  }, [form.assigned_to, form.start_date, form.due_date]);

  function toggleCreative(id: string) {
    setSelectedCreatives((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (conflicting.length > 0) return;
    setLoading(true);
    setError(null);

    const patch = {
      title: form.title,
      description: form.description || null,
      priority: form.priority,
      assigned_to: form.assigned_to || null,
      current_stage_id: form.current_stage_id,
      start_date: form.start_date || null,
      due_date: form.due_date || null,
    };

    const { error: err } = await supabase
      .from("tasks")
      .update(patch)
      .eq("id", task.id);

    if (err) { setLoading(false); setError(err.message); return; }

    // Replace the task's creatives with the current selection
    let { error: cErr } = await supabase
      .from("task_creatives")
      .delete()
      .eq("task_id", task.id);
    if (!cErr && selectedCreatives.length > 0) {
      ({ error: cErr } = await supabase.from("task_creatives").insert(
        selectedCreatives.map((profile_id) => ({ task_id: task.id, profile_id }))
      ));
    }

    setLoading(false);
    if (cErr) { setError(cErr.message); return; }

    const task_creatives = selectedCreatives.map((profile_id) => ({
      task_id: task.id,
      profile_id,
      added_at: new Date().toISOString(),
      employees: {
        profiles: {
          full_name: creatives.find((c) => c.profile_id === profile_id)?.full_name ?? "?",
        },
      },
    }));
    onSaved({ ...patch, task_creatives });
    onClose();
  }

  async function handleDelete() {
    if (!confirm("Delete this task? This cannot be undone.")) return;
    setDeleting(true);
    const { error: err } = await supabase.from("tasks").delete().eq("id", task.id);
    setDeleting(false);
    if (err) { setError(err.message); return; }
    onDeleted(task.id);
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Task</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSave} className="space-y-4">
          <div className="space-y-2">
            <Label>Title *</Label>
            <Input
              value={form.title}
              onChange={(e) => field("title", e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea
              value={form.description}
              onChange={(e) => field("description", e.target.value)}
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Priority</Label>
              <Select
                value={form.priority}
                onValueChange={(v) => field("priority", v as Task["priority"])}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["low", "medium", "high", "urgent"].map((p) => (
                    <SelectItem key={p} value={p}>{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Stage</Label>
              <Select
                value={form.current_stage_id}
                onValueChange={(v) => field("current_stage_id", v)}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {stages.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Assign to</Label>
            <Select
              value={form.assigned_to || "_none"}
              onValueChange={(v) => field("assigned_to", v === "_none" ? "" : v)}
            >
              <SelectTrigger><SelectValue placeholder="Unassigned" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="_none">Unassigned</SelectItem>
                {employees.map((emp) => (
                  <SelectItem key={emp.profile_id} value={emp.profile_id}>
                    {(emp.profiles as { full_name: string })?.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {creatives.length > 0 && (
            <div className="space-y-2">
              <Label>Creatives</Label>
              <div className="flex gap-2 flex-wrap">
                {creatives.map((c) => (
                  <button
                    key={c.profile_id}
                    type="button"
                    onClick={() => toggleCreative(c.profile_id)}
                    className={`px-3 py-1 rounded-full text-sm font-medium border transition-colors ${
                      selectedCreatives.includes(c.profile_id)
                        ? "bg-blue-600 text-white border-blue-600"
                        : "bg-white text-gray-600 border-gray-300 hover:border-blue-400"
                    }`}
                  >
                    {c.full_name}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Start date *</Label>
              <Input
                type="date"
                value={form.start_date}
                onChange={(e) => field("start_date", e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Due date *</Label>
              <Input
                type="date"
                value={form.due_date}
                onChange={(e) => field("due_date", e.target.value)}
                required
              />
            </div>
          </div>

          {/* Availability conflict warning */}
          {conflicting.length > 0 && form.assigned_to && (
            <div className="flex gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
              <AlertTriangle className="h-4 w-4 text-amber-400 flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-amber-300">
                  {(employees.find((e) => e.profile_id === form.assigned_to)?.profiles as { full_name: string } | null)?.full_name ?? "Assignee"} is already assigned during this period
                </p>
                <ul className="mt-1 space-y-0.5 text-amber-400/80">
                  {conflicting.map((t) => (
                    <li key={t.id}>· {t.title}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex gap-2 pt-1">
            <Button type="submit" disabled={loading || !form.title || !form.start_date || !form.due_date || conflicting.length > 0} className="flex-1">
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Save changes
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={handleDelete}
              disabled={deleting}
              className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
            >
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            </Button>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

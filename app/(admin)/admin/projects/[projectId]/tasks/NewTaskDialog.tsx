"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Loader2, AlertTriangle } from "lucide-react";
import { createClient } from "@/lib/supabase/browser";
import type { DepartmentStage } from "@/lib/types";

interface Props {
  projectId: string;
  departments: { id: string; name: string; slug: string }[];
  stages: DepartmentStage[];
  employees: { profile_id: string; profiles?: { full_name: string } | null; department_id: string | null }[];
  creatives: { profile_id: string; full_name: string }[];
}

export default function NewTaskDialog({ projectId, departments, stages, employees, creatives }: Props) {
  const router = useRouter();
  const supabase = createClient();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedDeptId, setSelectedDeptId] = useState("");
  const [selectedCreatives, setSelectedCreatives] = useState<string[]>([]);
  const [conflicting, setConflicting] = useState<{ id: string; title: string }[]>([]);

  const [form, setForm] = useState({
    title: "",
    description: "",
    priority: "medium",
    start_date: "",
    due_date: "",
    assigned_to: "",
  });

  const deptStages = stages.filter((s) => s.department_id === selectedDeptId);
  const firstStage = deptStages[0];
  const isShootStage = firstStage?.name.toLowerCase() === "shoot";

  const deptEmployees = employees.filter(
    (e) => !selectedDeptId || e.department_id === selectedDeptId
  );

  // Real-time availability check
  useEffect(() => {
    const dueDate = isShootStage ? form.start_date : form.due_date;
    if (!form.assigned_to || !form.start_date || !dueDate) {
      setConflicting([]);
      return;
    }
    let cancelled = false;
    supabase
      .from("tasks")
      .select("id, title")
      .eq("assigned_to", form.assigned_to)
      .not("start_date", "is", null)
      .not("due_date", "is", null)
      .lte("start_date", dueDate)
      .gte("due_date", form.start_date)
      .then(({ data }) => {
        if (!cancelled) setConflicting(data ?? []);
      });
    return () => { cancelled = true; };
  }, [form.assigned_to, form.start_date, form.due_date, isShootStage]);

  function toggleCreative(id: string) {
    setSelectedCreatives((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!firstStage) { setError("Department stages not configured"); return; }
    if (conflicting.length > 0) return;
    setLoading(true);
    setError(null);

    const { data: { user } } = await supabase.auth.getUser();

    const { data: task, error: tErr } = await supabase.from("tasks").insert({
      project_id: projectId,
      department_id: selectedDeptId,
      current_stage_id: firstStage.id,
      title: form.title,
      description: form.description || null,
      priority: form.priority,
      start_date: form.start_date,
      due_date: isShootStage ? form.start_date : form.due_date,
      assigned_to: form.assigned_to || null,
      created_by: user?.id,
    }).select("id").single();

    if (tErr) { setError(tErr.message); setLoading(false); return; }

    if (selectedCreatives.length > 0) {
      await supabase.from("task_creatives").insert(
        selectedCreatives.map((profile_id) => ({ task_id: task.id, profile_id }))
      );
    }

    setOpen(false);
    router.refresh();
  }

  const assigneeName = form.assigned_to
    ? (deptEmployees.find((e) => e.profile_id === form.assigned_to)?.profiles as { full_name: string } | null)?.full_name
    : null;

  const canSubmit =
    !loading &&
    !!form.title &&
    !!selectedDeptId &&
    !!form.start_date &&
    (isShootStage || !!form.due_date) &&
    conflicting.length === 0;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4" />
          Add Task
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>New Task</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Department *</Label>
            <Select value={selectedDeptId} onValueChange={setSelectedDeptId}>
              <SelectTrigger><SelectValue placeholder="Select department" /></SelectTrigger>
              <SelectContent>
                {departments.map((d) => (
                  <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Title *</Label>
            <Input
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="Shoot storyboard review"
              required
            />
          </div>

          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              rows={2}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Priority</Label>
              <Select value={form.priority} onValueChange={(v) => setForm((f) => ({ ...f, priority: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["low", "medium", "high", "urgent"].map((p) => (
                    <SelectItem key={p} value={p}>{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Assign to</Label>
              <Select value={form.assigned_to} onValueChange={(v) => setForm((f) => ({ ...f, assigned_to: v }))}>
                <SelectTrigger><SelectValue placeholder="Unassigned" /></SelectTrigger>
                <SelectContent>
                  {deptEmployees.map((emp) => (
                    <SelectItem key={emp.profile_id} value={emp.profile_id}>
                      {(emp.profiles as { full_name: string })?.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
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

          {/* Date fields: single shoot date vs start+due range */}
          {isShootStage ? (
            <div className="space-y-2">
              <Label>Shoot date *</Label>
              <Input
                type="date"
                value={form.start_date}
                onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))}
                required
              />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Start date *</Label>
                <Input
                  type="date"
                  value={form.start_date}
                  onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Due date *</Label>
                <Input
                  type="date"
                  value={form.due_date}
                  onChange={(e) => setForm((f) => ({ ...f, due_date: e.target.value }))}
                  required
                />
              </div>
            </div>
          )}

          {/* Availability conflict warning */}
          {conflicting.length > 0 && assigneeName && (
            <div className="flex gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
              <AlertTriangle className="h-4 w-4 text-amber-400 flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-amber-300">
                  {assigneeName} is already assigned during this period
                </p>
                <ul className="mt-1 space-y-0.5 text-amber-400/80">
                  {conflicting.map((t) => (
                    <li key={t.id}>· {t.title}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {firstStage && (
            <p className="text-xs text-gray-400">
              Task will start in: <span className="font-medium text-gray-600">{firstStage.name}</span>
            </p>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex gap-2">
            <Button type="submit" disabled={!canSubmit} className="flex-1">
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Create task
            </Button>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

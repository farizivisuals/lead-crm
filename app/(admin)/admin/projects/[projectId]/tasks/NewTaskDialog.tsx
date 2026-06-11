"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Loader2 } from "lucide-react";
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
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedDeptId, setSelectedDeptId] = useState("");
  const [selectedCreatives, setSelectedCreatives] = useState<string[]>([]);

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
  const deptEmployees = employees.filter(
    (e) => !selectedDeptId || e.department_id === selectedDeptId
  );

  function toggleCreative(id: string) {
    setSelectedCreatives((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!firstStage) { setError("Department stages not configured"); return; }
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    const { data: task, error: tErr } = await supabase.from("tasks").insert({
      project_id: projectId,
      department_id: selectedDeptId,
      current_stage_id: firstStage.id,
      title: form.title,
      description: form.description || null,
      priority: form.priority,
      start_date: form.start_date || null,
      due_date: form.due_date || null,
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

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Start date</Label>
              <Input type="date" value={form.start_date} onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Due date</Label>
              <Input type="date" value={form.due_date} onChange={(e) => setForm((f) => ({ ...f, due_date: e.target.value }))} />
            </div>
          </div>

          {firstStage && (
            <p className="text-xs text-gray-400">
              Task will start in: <span className="font-medium text-gray-600">{firstStage.name}</span>
            </p>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex gap-2">
            <Button type="submit" disabled={loading || !form.title || !selectedDeptId} className="flex-1">
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

"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Loader2, X } from "lucide-react";
import { createClient } from "@/lib/supabase/browser";
import type { DepartmentStage } from "@/lib/types";
import { createShootWithEdits, editStageAfterShoot, shootEditClashes, shootEditErrors, type EditBlock } from "@/lib/shoot-edit";
import { bookingClashes, timeErrors, type Clash } from "@/lib/task-time";
import { BusyWarning, TaskTimeFields } from "@/components/tasks/TaskTimeFields";

const emptyBlock = (): EditBlock => ({ editorId: "", editorName: "", startDate: "", dueDate: "", videos: [] });

interface Props {
  projectId: string;
  departments: { id: string; name: string; slug: string }[];
  stages: DepartmentStage[];
  employees: { profile_id: string; profiles?: { full_name: string } | null; department_ids: string[] }[];
  creatives: { profile_id: string; full_name: string }[];
}

export default function NewTaskDialog({ projectId, departments, stages, employees, creatives }: Props) {
  const router = useRouter();
  const supabase = createClient();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedDeptId, setSelectedDeptId] = useState("");
  // The project's creatives are on every new task by default — they should
  // get the shoot and the edits. Untick to leave someone off.
  const allCreativeIds = creatives.map((c) => c.profile_id);
  const [selectedCreatives, setSelectedCreatives] = useState<string[]>(allCreativeIds);
  const [deliverables, setDeliverables] = useState<string[]>([]);
  const [deliverableInput, setDeliverableInput] = useState("");
  const [conflicting, setConflicting] = useState<Clash[]>([]);

  const [form, setForm] = useState({
    title: "",
    description: "",
    priority: "medium",
    start_date: "",
    due_date: "",
    start_time: "",
    end_time: "",
    assigned_to: "",
  });

  // Shoot → edit handoff: book the shoot and plan one edit task per editor.
  const [planEdit, setPlanEdit] = useState(false);
  const [blocks, setBlocks] = useState<EditBlock[]>([emptyBlock()]);
  const [videoInputs, setVideoInputs] = useState<string[]>([""]);

  function resetEditBlocks() {
    setBlocks([emptyBlock()]);
    setVideoInputs([""]);
  }

  /** After a save, so reopening the dialog can't resubmit the same booking. */
  function resetAll() {
    setForm({ title: "", description: "", priority: "medium", start_date: "", due_date: "", start_time: "", end_time: "", assigned_to: "" });
    setSelectedCreatives(allCreativeIds);
    setDeliverables([]);
    setDeliverableInput("");
    setPlanEdit(false);
    resetEditBlocks();
  }

  const deptStages = stages.filter((s) => s.department_id === selectedDeptId);
  const firstStage = deptStages[0];
  const canPlanEdit = !!editStageAfterShoot(deptStages);
  const editing = planEdit && canPlanEdit;
  // A planned-edit booking has one shoot date, like a task that starts in Shoot.
  const isShootStage = firstStage?.name.toLowerCase() === "shoot" || editing;

  const deptEmployees = employees.filter(
    (e) => !selectedDeptId || e.department_ids.includes(selectedDeptId)
  );
  const employeeName = (id: string) =>
    (deptEmployees.find((e) => e.profile_id === id)?.profiles as { full_name: string } | null)?.full_name ?? "";

  function updateBlock(i: number, patch: Partial<EditBlock>) {
    setBlocks((bs) => bs.map((b, j) => (j === i ? { ...b, ...patch } : b)));
  }
  function addVideo(i: number) {
    const title = videoInputs[i]?.trim();
    if (!title) return;
    updateBlock(i, { videos: [...blocks[i]!.videos, title] });
    setVideoInputs((vs) => vs.map((v, j) => (j === i ? "" : v)));
  }

  const slot = {
    start_date: form.start_date,
    due_date: isShootStage ? form.start_date : form.due_date,
    start_time: form.start_time || null,
    end_time: form.end_time || null,
  };

  // Real-time availability check — a warning, never a block.
  useEffect(() => {
    if (!form.assigned_to || !slot.start_date || !slot.due_date) {
      setConflicting([]);
      return;
    }
    let cancelled = false;
    bookingClashes(supabase, form.assigned_to, slot, null)
      .then((c) => { if (!cancelled) setConflicting(c); })
      .catch(() => { if (!cancelled) setConflicting([]); });
    return () => { cancelled = true; };
  }, [form.assigned_to, slot.start_date, slot.due_date, slot.start_time, slot.end_time]);

  function toggleCreative(id: string) {
    setSelectedCreatives((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!firstStage) { setError("Department stages not configured"); return; }
    const timeProblem = timeErrors(slot);
    if (timeProblem) { setError(timeProblem); return; }
    setLoading(true);
    setError(null);

    const { data: { user } } = await supabase.auth.getUser();

    if (editing) {
      const input = {
        projectId,
        departmentId: selectedDeptId,
        stages: deptStages,
        title: form.title,
        description: form.description,
        priority: form.priority as "low" | "medium" | "high" | "urgent",
        shootDate: form.start_date,
        shootStart: slot.start_time,
        shootEnd: slot.end_time,
        shooterId: form.assigned_to || null,
        creativeIds: selectedCreatives,
        edits: blocks,
        userId: user?.id ?? "",
      };
      const problem = shootEditErrors(input);
      if (problem) { setError(problem); setLoading(false); return; }
      try {
        const busy = await shootEditClashes(supabase, input);
        if (busy.length && !window.confirm(`${busy.join("\n")}\n\nCreate anyway?`)) {
          setLoading(false);
          return;
        }
        await createShootWithEdits(supabase, input);
      } catch (err) {
        setError((err as Error).message);
        setLoading(false);
        return;
      }
      setLoading(false);
      setOpen(false);
      resetAll();
      router.refresh();
      return;
    }

    const { data: task, error: tErr } = await supabase.from("tasks").insert({
      project_id: projectId,
      department_id: selectedDeptId,
      current_stage_id: firstStage.id,
      title: form.title,
      description: form.description || null,
      priority: form.priority,
      start_date: slot.start_date,
      due_date: slot.due_date,
      start_time: slot.start_time,
      end_time: slot.end_time,
      assigned_to: form.assigned_to || null,
      created_by: user?.id,
    }).select("id").single();

    if (tErr) { setError(tErr.message); setLoading(false); return; }

    if (selectedCreatives.length > 0) {
      await supabase.from("task_creatives").insert(
        selectedCreatives.map((profile_id) => ({ task_id: task.id, profile_id }))
      );
    }

    if (deliverables.length > 0) {
      await supabase.from("task_deliverables").insert(
        deliverables.map((title, i) => ({
          task_id: task.id,
          title,
          position: i,
          current_stage_id: firstStage.id,
        }))
      );
    }

    setOpen(false);
    setLoading(false);
    resetAll();
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
    (isShootStage || !!form.due_date);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4" />
          Add Task
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New Task</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Department *</Label>
            <Select
              value={selectedDeptId}
              onValueChange={(v) => {
                setSelectedDeptId(v);
                resetEditBlocks(); // editors are per department
              }}
            >
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
              <Label>{editing ? "Shooter" : "Assign to"}</Label>
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

          {!editing && <div className="space-y-2">
            <Label>Deliverables</Label>
            <div className="flex gap-2">
              <Input
                value={deliverableInput}
                onChange={(e) => setDeliverableInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    const title = deliverableInput.trim();
                    if (title) {
                      setDeliverables((prev) => [...prev, title]);
                      setDeliverableInput("");
                    }
                  }
                }}
                placeholder="Video 1"
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  const title = deliverableInput.trim();
                  if (title) {
                    setDeliverables((prev) => [...prev, title]);
                    setDeliverableInput("");
                  }
                }}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            {deliverables.length > 0 && (
              <div className="flex gap-2 flex-wrap">
                {deliverables.map((title, i) => (
                  <span
                    key={`${title}-${i}`}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-full text-sm bg-white/[0.06] border border-white/[0.12] text-white/70"
                  >
                    {title}
                    <button
                      type="button"
                      onClick={() => setDeliverables((prev) => prev.filter((_, j) => j !== i))}
                      className="text-white/30 hover:text-white/70 transition-colors"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>}

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

          <TaskTimeFields
            start={form.start_time}
            end={form.end_time}
            onChange={(patch) => setForm((f) => ({ ...f, ...patch }))}
          />

          {canPlanEdit && (
            <label className="flex items-center gap-2 text-sm text-white/80 cursor-pointer">
              <input
                type="checkbox"
                checked={planEdit}
                onChange={(e) => setPlanEdit(e.target.checked)}
                className="h-4 w-4 accent-white"
              />
              Plan the edit
              <span className="text-white/30 text-xs">(one edit task per editor)</span>
            </label>
          )}

          {editing && (
            <div className="space-y-3">
              {blocks.map((b, i) => (
                <div key={i} className="rounded-xl border border-white/[0.1] bg-white/[0.03] p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Edit {i + 1}</Label>
                    {blocks.length > 1 && (
                      <button
                        type="button"
                        onClick={() => {
                          setBlocks((bs) => bs.filter((_, j) => j !== i));
                          setVideoInputs((vs) => vs.filter((_, j) => j !== i));
                        }}
                        className="text-white/30 hover:text-white/70"
                        aria-label={`Remove edit ${i + 1}`}
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                  <Select
                    value={b.editorId}
                    onValueChange={(v) => updateBlock(i, { editorId: v, editorName: employeeName(v) })}
                  >
                    <SelectTrigger><SelectValue placeholder="Editor" /></SelectTrigger>
                    <SelectContent>
                      {deptEmployees.map((emp) => (
                        <SelectItem key={emp.profile_id} value={emp.profile_id}>
                          {(emp.profiles as { full_name: string })?.full_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      type="date"
                      aria-label={`Edit ${i + 1} start date`}
                      value={b.startDate}
                      onChange={(e) => updateBlock(i, { startDate: e.target.value })}
                    />
                    <Input
                      type="date"
                      aria-label={`Edit ${i + 1} due date`}
                      value={b.dueDate}
                      onChange={(e) => updateBlock(i, { dueDate: e.target.value })}
                    />
                  </div>
                  <div className="flex gap-2">
                    <Input
                      value={videoInputs[i] ?? ""}
                      onChange={(e) => setVideoInputs((vs) => vs.map((v, j) => (j === i ? e.target.value : v)))}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addVideo(i); } }}
                      placeholder="Video 1"
                    />
                    <Button type="button" variant="outline" onClick={() => addVideo(i)} aria-label="Add video">
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  {b.videos.length > 0 && (
                    <div className="flex gap-2 flex-wrap">
                      {b.videos.map((title, k) => (
                        <span
                          key={`${title}-${k}`}
                          className="flex items-center gap-1 px-2.5 py-1 rounded-full text-sm bg-white/[0.06] border border-white/[0.12] text-white/70"
                        >
                          {title}
                          <button
                            type="button"
                            onClick={() => updateBlock(i, { videos: b.videos.filter((_, j) => j !== k) })}
                            className="text-white/30 hover:text-white/70"
                            aria-label={`Remove ${title}`}
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setBlocks((bs) => [...bs, emptyBlock()]);
                  setVideoInputs((vs) => [...vs, ""]);
                }}
              >
                <Plus className="h-4 w-4" />
                Add editor
              </Button>
            </div>
          )}

          {assigneeName && <BusyWarning name={assigneeName} clashes={conflicting} />}

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

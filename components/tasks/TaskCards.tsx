"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/browser";
import type { Task, TaskDeliverable, DepartmentStage } from "@/lib/types";
import {
  AlertCircle,
  Calendar,
  User,
  Users,
  Pencil,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Clapperboard,
} from "lucide-react";
import { formatDate, cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import EditTaskDialog from "./EditTaskDialog";

/** Returns true when a task is past its due date and not yet fully delivered. */
function isTaskOverdue(task: Task, stages: DepartmentStage[]): boolean {
  if (!task.due_date) return false;
  const stage = stages.find((s) => s.id === task.current_stage_id);
  if (stage?.is_terminal) return false;
  // Compare ISO date strings lexicographically — safe and timezone-agnostic.
  const today = new Date().toISOString().split("T")[0]!;
  return task.due_date < today;
}

interface Employee {
  profile_id: string;
  profiles?: { full_name: string } | null;
}

interface Props {
  stages: DepartmentStage[];
  tasks: Task[];
  employees: Employee[];
  creatives?: { profile_id: string; full_name: string }[];
  deptName: string;
}

const PRIORITY_STYLES: Record<string, string> = {
  low: "text-white/30 bg-white/[0.04] border-white/[0.06]",
  medium: "text-blue-400 bg-blue-500/10 border-blue-500/20",
  high: "text-orange-400 bg-orange-500/10 border-orange-500/20",
  urgent: "text-red-400 bg-red-500/10 border-red-500/20",
};

const NONE = "_none";

export default function TaskCards({ stages, tasks, employees, creatives = [], deptName }: Props) {
  const [localTasks, setLocalTasks] = useState<Task[]>(tasks);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [supabase] = useState(() => createClient());

  // Re-sync when the server sends fresh data (e.g. after router.refresh()),
  // otherwise newly created tasks never show up until a full page reload.
  const [prevTasks, setPrevTasks] = useState(tasks);
  if (prevTasks !== tasks) {
    setPrevTasks(tasks);
    setLocalTasks(tasks);
  }

  const ordered = [...stages].sort((a, b) => a.position - b.position);
  const stageById = (id: string | null | undefined) =>
    ordered.find((s) => s.id === id);

  const deliverableStage = (d: TaskDeliverable, task: Task) =>
    stageById(d.current_stage_id ?? task.current_stage_id);

  function patchTask(taskId: string, patch: Partial<Task>) {
    setLocalTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, ...patch } : t)));
  }

  function patchDeliverable(taskId: string, deliverableId: string, patch: Partial<TaskDeliverable>) {
    setLocalTasks((prev) =>
      prev.map((t) =>
        t.id === taskId
          ? {
              ...t,
              task_deliverables: (t.task_deliverables ?? []).map((d) =>
                d.id === deliverableId ? { ...d, ...patch } : d
              ),
            }
          : t
      )
    );
  }

  /** Keep the task's own stage at its least-advanced deliverable so
   *  dashboards and "tasks done" counts stay correct. */
  async function syncTaskStage(task: Task, deliverables: TaskDeliverable[]) {
    const positions = deliverables.map(
      (d) => deliverableStage(d, task)?.position ?? 0
    );
    const minPos = Math.min(...positions);
    const target = ordered.find((s) => s.position === minPos);
    if (!target || target.id === task.current_stage_id) return;
    patchTask(task.id, { current_stage_id: target.id });
    await supabase.from("tasks").update({ current_stage_id: target.id }).eq("id", task.id);
  }

  async function moveDeliverable(task: Task, d: TaskDeliverable, dir: 1 | -1) {
    const current = deliverableStage(d, task);
    if (!current) return;
    const idx = ordered.findIndex((s) => s.id === current.id);
    const target = ordered[idx + dir];
    if (!target) return;

    patchDeliverable(task.id, d.id, { current_stage_id: target.id });
    const { error } = await supabase
      .from("task_deliverables")
      .update({ current_stage_id: target.id })
      .eq("id", d.id);
    if (error) {
      patchDeliverable(task.id, d.id, { current_stage_id: current.id });
      return;
    }

    const updated = (task.task_deliverables ?? []).map((x) =>
      x.id === d.id ? { ...x, current_stage_id: target.id } : x
    );
    await syncTaskStage(task, updated);
  }

  /** Move a task without deliverables through its own stages. */
  async function moveTask(task: Task, dir: 1 | -1) {
    const idx = ordered.findIndex((s) => s.id === task.current_stage_id);
    const target = ordered[idx + dir];
    if (idx === -1 || !target) return;
    patchTask(task.id, { current_stage_id: target.id });
    const { error } = await supabase
      .from("tasks")
      .update({ current_stage_id: target.id })
      .eq("id", task.id);
    if (error) patchTask(task.id, { current_stage_id: task.current_stage_id });
  }

  async function assignDeliverable(
    task: Task,
    d: TaskDeliverable,
    profileId: string | null
  ) {
    const stage = deliverableStage(d, task);
    if (!stage) return;
    const others = (d.task_deliverable_assignments ?? []).filter(
      (a) => a.stage_id !== stage.id
    );

    if (profileId) {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("task_deliverable_assignments")
        .upsert(
          {
            deliverable_id: d.id,
            stage_id: stage.id,
            assigned_to: profileId,
            assigned_by: user?.id ?? null,
          },
          { onConflict: "deliverable_id,stage_id" }
        );
      if (error) return;
      const name =
        employees.find((e) => e.profile_id === profileId)?.profiles?.full_name ?? "?";
      patchDeliverable(task.id, d.id, {
        task_deliverable_assignments: [
          ...others,
          {
            deliverable_id: d.id,
            stage_id: stage.id,
            assigned_to: profileId,
            assigned_by: null,
            assigned_at: new Date().toISOString(),
            employees: { profiles: { full_name: name } },
          },
        ],
      });
    } else {
      const { error } = await supabase
        .from("task_deliverable_assignments")
        .delete()
        .eq("deliverable_id", d.id)
        .eq("stage_id", stage.id);
      if (error) return;
      patchDeliverable(task.id, d.id, { task_deliverable_assignments: others });
    }
  }

  /** One click: assign every deliverable's current phase to one person. */
  async function assignAll(task: Task, profileId: string) {
    for (const d of task.task_deliverables ?? []) {
      await assignDeliverable(task, d, profileId);
    }
  }

  function handleDeleted(taskId: string) {
    setLocalTasks((prev) => prev.filter((t) => t.id !== taskId));
  }

  const deptColor = ordered[0]?.color ?? "#71717a";

  return (
    <div className="space-y-3">
      {/* Department header */}
      <div className="flex items-center gap-2.5 mb-4">
        <div
          className="w-2.5 h-2.5 rounded-full"
          style={{ backgroundColor: deptColor, boxShadow: `0 0 8px ${deptColor}80` }}
        />
        <h3 className="font-semibold text-white/80 text-sm tracking-tight">{deptName}</h3>
        <span className="text-xs text-white/25 bg-white/[0.05] border border-white/[0.07] px-2 py-0.5 rounded-full">
          {localTasks.length} tasks
        </span>
      </div>

      {localTasks.length === 0 && (
        <p className="text-xs text-white/25 px-1">No tasks yet</p>
      )}

      <div className="space-y-3">
        {localTasks.map((task) => {
          const overdue = isTaskOverdue(task, ordered);
          const deliverables = [...(task.task_deliverables ?? [])].sort(
            (a, b) => a.position - b.position
          );
          const taskStage = stageById(task.current_stage_id);
          const taskIdx = ordered.findIndex((s) => s.id === task.current_stage_id);
          const taskNext = ordered[taskIdx + 1];
          const allDone = deliverables.length > 0
            ? deliverables.every((d) => deliverableStage(d, task)?.is_terminal)
            : taskStage?.is_terminal;

          return (
            <div
              key={task.id}
              className={cn(
                "rounded-xl border p-4 group transition-colors",
                overdue
                  ? "bg-red-500/[0.05] border-red-500/25 hover:bg-red-500/[0.07]"
                  : "bg-white/[0.03] border-white/[0.07] hover:bg-white/[0.05]"
              )}
            >
              {/* Card header */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <p
                    className="text-sm font-medium text-white/85 leading-snug cursor-pointer hover:text-white transition-colors truncate"
                    onClick={() => setEditingTask(task)}
                  >
                    {task.title}
                  </p>
                  {allDone && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 flex-shrink-0" />}
                  {overdue && <AlertCircle className="h-3.5 w-3.5 text-red-400 flex-shrink-0" />}
                  <button
                    onClick={() => setEditingTask(task)}
                    className="opacity-0 group-hover:opacity-100 text-white/30 hover:text-zinc-200 transition-all flex-shrink-0"
                  >
                    <Pencil className="h-3 w-3" />
                  </button>
                </div>

                {/* Assign-all: one person for every deliverable's current phase */}
                {deliverables.length > 1 && (
                  <Select value="" onValueChange={(v) => assignAll(task, v)}>
                    <SelectTrigger className="w-36 h-7 text-xs text-white/50">
                      <SelectValue placeholder="Assign all to…" />
                    </SelectTrigger>
                    <SelectContent>
                      {employees.map((emp) => (
                        <SelectItem key={emp.profile_id} value={emp.profile_id}>
                          {emp.profiles?.full_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              {/* Meta row */}
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                <span
                  className={cn(
                    "text-[10px] font-medium px-1.5 py-0.5 rounded-full border",
                    PRIORITY_STYLES[task.priority]
                  )}
                >
                  {task.priority}
                </span>
                {task.due_date && (
                  <span
                    className={cn(
                      "flex items-center gap-1 text-[10px]",
                      overdue ? "text-red-400 font-medium" : "text-white/30"
                    )}
                  >
                    <Calendar className="h-2.5 w-2.5" />
                    {formatDate(task.due_date)}
                    {overdue && <span>· Overdue</span>}
                  </span>
                )}
                {task.assigned_to && (
                  <span className="flex items-center gap-1 text-[10px] text-white/30">
                    <User className="h-2.5 w-2.5" />
                    {(task.employees as { profiles?: { full_name: string } })?.profiles?.full_name?.split(" ")[0]}
                  </span>
                )}
                {(task.task_creatives?.length ?? 0) > 0 && (
                  <span className="flex items-center gap-1 text-[10px] text-violet-300/60">
                    <Users className="h-2.5 w-2.5" />
                    {task.task_creatives!
                      .map((tc) => tc.employees?.profiles?.full_name?.split(" ")[0] ?? "?")
                      .join(", ")}
                  </span>
                )}
              </div>

              {/* Deliverable rows, each with its own stage */}
              {deliverables.length > 0 ? (
                <div className="mt-3 divide-y divide-white/[0.05] border-t border-white/[0.06]">
                  {deliverables.map((d) => {
                    const stage = deliverableStage(d, task);
                    if (!stage) return null;
                    const idx = ordered.findIndex((s) => s.id === stage.id);
                    const next = ordered[idx + 1];
                    const isLastMove = !!next?.is_terminal;
                    const stageColor = stage.color ?? "#71717a";
                    const currentAssignee =
                      d.task_deliverable_assignments?.find((a) => a.stage_id === stage.id)
                        ?.assigned_to ?? NONE;
                    const record = ordered
                      .filter((s) => s.position < stage.position)
                      .map((s) => {
                        const a = d.task_deliverable_assignments?.find(
                          (x) => x.stage_id === s.id
                        );
                        return a
                          ? `${s.name}: ${(a.employees?.profiles?.full_name ?? "?").split(" ")[0]}`
                          : null;
                      })
                      .filter(Boolean);

                    return (
                      <div key={d.id} className="py-2 flex items-center gap-2 flex-wrap">
                        <span className="flex items-center gap-1.5 text-xs text-white/70 min-w-24 flex-1">
                          <Clapperboard className="h-3 w-3 text-white/30 flex-shrink-0" />
                          <span className="truncate">{d.title}</span>
                        </span>

                        <span
                          className="text-[10px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1"
                          style={{ background: `${stageColor}18`, color: stageColor }}
                        >
                          {stage.is_terminal && <CheckCircle2 className="h-2.5 w-2.5" />}
                          {stage.name}
                        </span>

                        <Select
                          value={currentAssignee}
                          onValueChange={(v) =>
                            assignDeliverable(task, d, v === NONE ? null : v)
                          }
                        >
                          <SelectTrigger className="w-32 h-7 text-xs">
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

                        <span className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => moveDeliverable(task, d, -1)}
                            disabled={idx === 0}
                            className="text-white/30 hover:text-white/70 px-1.5 h-7 disabled:opacity-20"
                            title={idx > 0 ? `Back to ${ordered[idx - 1]!.name}` : undefined}
                          >
                            <ArrowLeft className="h-3.5 w-3.5" />
                          </Button>
                          {next ? (
                            <Button
                              size="sm"
                              variant={isLastMove ? "default" : "outline"}
                              onClick={() => moveDeliverable(task, d, 1)}
                              className={cn(
                                "h-7 text-xs",
                                isLastMove && "bg-emerald-600 hover:bg-emerald-500 text-white"
                              )}
                            >
                              {isLastMove ? (
                                <>
                                  Done
                                  <CheckCircle2 className="h-3 w-3" />
                                </>
                              ) : (
                                <>
                                  <span className="hidden sm:inline">{next.name}</span>
                                  <ArrowRight className="h-3 w-3" />
                                </>
                              )}
                            </Button>
                          ) : (
                            <span className="w-7" />
                          )}
                        </span>

                        {record.length > 0 && (
                          <p className="w-full text-[10px] text-white/25 pl-[18px] -mt-0.5">
                            {record.join(" · ")}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                /* No deliverables: the card itself moves through stages */
                taskStage && (
                  <div className="mt-3 pt-2.5 border-t border-white/[0.06] flex items-center gap-2">
                    <span
                      className="text-[10px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1"
                      style={{
                        background: `${taskStage.color ?? "#71717a"}18`,
                        color: taskStage.color ?? "#71717a",
                      }}
                    >
                      {taskStage.is_terminal && <CheckCircle2 className="h-2.5 w-2.5" />}
                      {taskStage.name}
                    </span>
                    <span className="flex-1" />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => moveTask(task, -1)}
                      disabled={taskIdx <= 0}
                      className="text-white/30 hover:text-white/70 px-1.5 h-7 disabled:opacity-20"
                    >
                      <ArrowLeft className="h-3.5 w-3.5" />
                    </Button>
                    {taskNext && (
                      <Button
                        size="sm"
                        variant={taskNext.is_terminal ? "default" : "outline"}
                        onClick={() => moveTask(task, 1)}
                        className={cn(
                          "h-7 text-xs",
                          taskNext.is_terminal && "bg-emerald-600 hover:bg-emerald-500 text-white"
                        )}
                      >
                        {taskNext.is_terminal ? (
                          <>
                            Done
                            <CheckCircle2 className="h-3 w-3" />
                          </>
                        ) : (
                          <>
                            <span className="hidden sm:inline">{taskNext.name}</span>
                            <ArrowRight className="h-3 w-3" />
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                )
              )}
            </div>
          );
        })}
      </div>

      {editingTask && (
        <EditTaskDialog
          key={editingTask.id}
          task={editingTask}
          stages={stages}
          employees={employees}
          creatives={creatives}
          open={!!editingTask}
          onClose={() => setEditingTask(null)}
          onSaved={(patch) => patchTask(editingTask.id, patch)}
          onDeleted={handleDeleted}
        />
      )}
    </div>
  );
}

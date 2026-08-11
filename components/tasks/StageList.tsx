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
import EditTaskDialog from "./EditTaskDialog";
import AssignDeliverablesDialog from "./AssignDeliverablesDialog";

/** Returns true when a task is past its due date and not yet in a terminal stage. */
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

export default function StageList({ stages, tasks, employees, creatives = [], deptName }: Props) {
  const [localTasks, setLocalTasks] = useState<Task[]>(tasks);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [assigning, setAssigning] = useState<{ task: Task; stage: DepartmentStage } | null>(null);
  const [supabase] = useState(() => createClient());

  // Re-sync when the server sends fresh data (e.g. after router.refresh()),
  // otherwise newly created tasks never show up until a full page reload.
  const [prevTasks, setPrevTasks] = useState(tasks);
  if (prevTasks !== tasks) {
    setPrevTasks(tasks);
    setLocalTasks(tasks);
  }

  const ordered = [...stages].sort((a, b) => a.position - b.position);

  async function moveTask(task: Task, dir: 1 | -1) {
    const idx = ordered.findIndex((s) => s.id === task.current_stage_id);
    const target = ordered[idx + dir];
    if (idx === -1 || !target) return;

    setLocalTasks((prev) =>
      prev.map((t) => (t.id === task.id ? { ...t, current_stage_id: target.id } : t))
    );

    const { error } = await supabase
      .from("tasks")
      .update({ current_stage_id: target.id })
      .eq("id", task.id);

    if (error) {
      setLocalTasks((prev) =>
        prev.map((t) => (t.id === task.id ? { ...t, current_stage_id: task.current_stage_id } : t))
      );
      return;
    }

    if (dir === 1 && (task.task_deliverables?.length ?? 0) > 0) {
      setAssigning({ task: { ...task, current_stage_id: target.id }, stage: target });
    }
  }

  function handleSaved(taskId: string, patch: Partial<Task>) {
    setLocalTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, ...patch } : t)));
  }

  function handleDeleted(taskId: string) {
    setLocalTasks((prev) => prev.filter((t) => t.id !== taskId));
  }

  function handleAssignmentsSaved(taskId: string, deliverables: TaskDeliverable[]) {
    setLocalTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, task_deliverables: deliverables } : t))
    );
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

      <div className="space-y-5">
        {ordered.map((stage, stageIdx) => {
          const stageTasks = localTasks.filter((t) => t.current_stage_id === stage.id);
          const stageColor = stage.color ?? "#71717a";
          const next = ordered[stageIdx + 1];
          const isLastMove = !!next?.is_terminal;

          return (
            <section key={stage.id}>
              {/* Stage heading */}
              <div
                className="flex items-center gap-2 px-3 py-2 rounded-t-xl border-b"
                style={{ background: `${stageColor}12`, borderColor: `${stageColor}25` }}
              >
                {stage.is_terminal && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />}
                <span className="text-xs font-semibold tracking-wide" style={{ color: stageColor }}>
                  {stage.name}
                </span>
                <span
                  className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                  style={{ background: `${stageColor}20`, color: stageColor }}
                >
                  {stageTasks.length}
                </span>
              </div>

              {/* Task rows */}
              <div className="rounded-b-xl border border-t-0 border-white/[0.06] bg-white/[0.02] divide-y divide-white/[0.05]">
                {stageTasks.length === 0 && (
                  <p className="px-4 py-3 text-xs text-white/20">—</p>
                )}
                {stageTasks.map((task) => {
                  const overdue = isTaskOverdue(task, ordered);
                  const deliverables = [...(task.task_deliverables ?? [])].sort(
                    (a, b) => a.position - b.position
                  );
                  return (
                    <div
                      key={task.id}
                      className={cn(
                        "px-4 py-3 group transition-colors",
                        overdue ? "bg-red-500/[0.05] hover:bg-red-500/[0.08]" : "hover:bg-white/[0.04]"
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p
                              className="text-sm font-medium text-white/80 leading-snug cursor-pointer hover:text-white transition-colors truncate"
                              onClick={() => setEditingTask(task)}
                            >
                              {task.title}
                            </p>
                            {overdue && (
                              <AlertCircle className="h-3.5 w-3.5 text-red-400 flex-shrink-0" />
                            )}
                            <button
                              onClick={() => setEditingTask(task)}
                              className="opacity-0 group-hover:opacity-100 text-white/30 hover:text-zinc-200 transition-all flex-shrink-0"
                            >
                              <Pencil className="h-3 w-3" />
                            </button>
                          </div>

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

                          {deliverables.length > 0 && (
                            <div className="mt-2 space-y-0.5">
                              {deliverables.map((d) => {
                                const a = d.task_deliverable_assignments?.find(
                                  (x) => x.stage_id === task.current_stage_id
                                );
                                const name = a?.employees?.profiles?.full_name?.split(" ")[0];
                                return (
                                  <p key={d.id} className="flex items-center gap-1.5 text-[11px] text-white/40">
                                    <Clapperboard className="h-2.5 w-2.5 flex-shrink-0" />
                                    <span className="truncate">{d.title}</span>
                                    {name ? (
                                      <span className="text-white/60">· {name}</span>
                                    ) : (
                                      <span className="text-white/20 italic">· unassigned</span>
                                    )}
                                  </p>
                                );
                              })}
                            </div>
                          )}
                        </div>

                        {/* Stage controls */}
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          {stageIdx > 0 && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => moveTask(task, -1)}
                              className="text-white/30 hover:text-white/70 px-2"
                              title={`Back to ${ordered[stageIdx - 1]!.name}`}
                            >
                              <ArrowLeft className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          {next && (
                            <Button
                              size="sm"
                              variant={isLastMove ? "default" : "outline"}
                              onClick={() => moveTask(task, 1)}
                              className={cn(isLastMove && "bg-emerald-600 hover:bg-emerald-500 text-white")}
                            >
                              {isLastMove ? (
                                <>
                                  Mark done
                                  <CheckCircle2 className="h-3.5 w-3.5" />
                                </>
                              ) : (
                                <>
                                  <span className="hidden sm:inline">{next.name}</span>
                                  <ArrowRight className="h-3.5 w-3.5" />
                                </>
                              )}
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
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
          onSaved={(patch) => handleSaved(editingTask.id, patch)}
          onDeleted={handleDeleted}
        />
      )}

      {assigning && (
        <AssignDeliverablesDialog
          key={`${assigning.task.id}-${assigning.stage.id}`}
          task={assigning.task}
          stage={assigning.stage}
          stages={ordered}
          employees={employees}
          open={!!assigning}
          onClose={() => setAssigning(null)}
          onSaved={(deliverables) => handleAssignmentsSaved(assigning.task.id, deliverables)}
        />
      )}
    </div>
  );
}

"use client";
import { useState, useCallback } from "react";
import {
  DragDropContext,
  Droppable,
  Draggable,
  type DropResult,
} from "@hello-pangea/dnd";
import { createClient } from "@/lib/supabase/browser";
import type { Task, DepartmentStage } from "@/lib/types";
import { AlertCircle, Calendar, User, GripVertical, Pencil, CheckCircle2 } from "lucide-react";
import { formatDate, cn } from "@/lib/utils";
import EditTaskDialog from "./EditTaskDialog";

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
  department_id: string | null;
}

interface Props {
  stages: DepartmentStage[];
  tasks: Task[];
  employees: Employee[];
  deptName: string;
  deptSlug: string;
  onTaskMoved?: () => void;
}

const PRIORITY_STYLES: Record<string, string> = {
  low: "text-white/30 bg-white/[0.04] border-white/[0.06]",
  medium: "text-blue-400 bg-blue-500/10 border-blue-500/20",
  high: "text-orange-400 bg-orange-500/10 border-orange-500/20",
  urgent: "text-red-400 bg-red-500/10 border-red-500/20",
};

export default function StageBoard({ stages, tasks, employees, deptName, onTaskMoved }: Props) {
  const [localTasks, setLocalTasks] = useState<Task[]>(tasks);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const supabase = createClient();

  const tasksByStage = useCallback(
    (stageId: string) => localTasks.filter((t) => t.current_stage_id === stageId),
    [localTasks]
  );

  async function onDragEnd(result: DropResult) {
    const { source, destination, draggableId } = result;
    if (!destination) return;
    if (source.droppableId === destination.droppableId && source.index === destination.index) return;

    const toStageId = destination.droppableId;

    setLocalTasks((prev) =>
      prev.map((t) => t.id === draggableId ? { ...t, current_stage_id: toStageId } : t)
    );

    const { error } = await supabase
      .from("tasks")
      .update({ current_stage_id: toStageId })
      .eq("id", draggableId);

    if (error) {
      setLocalTasks((prev) =>
        prev.map((t) => t.id === draggableId ? { ...t, current_stage_id: source.droppableId } : t)
      );
    } else {
      onTaskMoved?.();
    }
  }

  function handleSaved(taskId: string, patch: Partial<Task>) {
    setLocalTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, ...patch } : t)));
  }

  function handleDeleted(taskId: string) {
    setLocalTasks((prev) => prev.filter((t) => t.id !== taskId));
  }

  const deptColor = stages[0]?.color ?? "#6366f1";

  return (
    <div className="space-y-3">
      {/* Department header */}
      <div className="flex items-center gap-2.5 mb-4">
        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: deptColor, boxShadow: `0 0 8px ${deptColor}80` }} />
        <h3 className="font-semibold text-white/80 text-sm tracking-tight">{deptName}</h3>
        <span className="text-xs text-white/25 bg-white/[0.05] border border-white/[0.07] px-2 py-0.5 rounded-full">
          {localTasks.length} tasks
        </span>
      </div>

      <DragDropContext onDragEnd={onDragEnd}>
        <div className="flex gap-3 overflow-x-auto pb-4 -mx-1 px-1 touch-pan-x" style={{ WebkitOverflowScrolling: "touch" }}>
          {stages.map((stage) => {
            const stageTasks = tasksByStage(stage.id);
            const stageColor = stage.color ?? "#6366f1";
            return (
              <div key={stage.id} className="flex-shrink-0 w-72">
                {/* Column header */}
                <div
                  className="rounded-t-xl px-3 py-2.5 flex items-center justify-between border-b"
                  style={{
                    background: `${stageColor}12`,
                    borderColor: `${stageColor}25`,
                  }}
                >
                  <div className="flex items-center gap-2">
                    {stage.is_terminal && (
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                    )}
                    <span className="text-xs font-semibold tracking-wide" style={{ color: stageColor }}>
                      {stage.name}
                    </span>
                  </div>
                  <span
                    className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                    style={{ background: `${stageColor}20`, color: stageColor }}
                  >
                    {stageTasks.length}
                  </span>
                </div>

                {/* Droppable column */}
                <Droppable droppableId={stage.id}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={cn(
                        "rounded-b-xl min-h-[200px] p-2 space-y-2 border border-t-0 transition-all duration-150",
                        snapshot.isDraggingOver
                          ? "bg-indigo-500/[0.07] border-indigo-500/20"
                          : "bg-white/[0.02] border-white/[0.06]"
                      )}
                    >
                      {stageTasks.map((task, index) => {
                        const overdue = isTaskOverdue(task, stages);
                        return (
                          <Draggable key={task.id} draggableId={task.id} index={index}>
                            {(provided, snapshot) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                className={cn(
                                  "rounded-xl border p-3 select-none group transition-all duration-150",
                                  snapshot.isDragging
                                    ? "bg-white/[0.1] border-indigo-500/40 shadow-2xl shadow-black/50 rotate-1 scale-105"
                                    : overdue
                                      ? "bg-red-500/[0.06] border-red-500/25 hover:bg-red-500/[0.09] hover:border-red-500/40 hover:shadow-lg hover:shadow-black/20"
                                      : "bg-white/[0.04] border-white/[0.08] hover:bg-white/[0.07] hover:border-white/[0.14] hover:shadow-lg hover:shadow-black/20"
                                )}
                              >
                                <div className="flex items-start gap-2">
                                  <span
                                    {...provided.dragHandleProps}
                                    className="mt-0.5 text-white/20 hover:text-white/50 cursor-grab active:cursor-grabbing flex-shrink-0 transition-colors"
                                  >
                                    <GripVertical className="h-3.5 w-3.5" />
                                  </span>

                                  <p
                                    className="text-sm font-medium text-white/80 leading-snug flex-1 cursor-pointer hover:text-white transition-colors"
                                    onClick={() => setEditingTask(task)}
                                  >
                                    {task.title}
                                  </p>

                                  {overdue && (
                                    <AlertCircle className="h-3.5 w-3.5 text-red-400 flex-shrink-0 mt-0.5" />
                                  )}
                                  <button
                                    onClick={() => setEditingTask(task)}
                                    className="opacity-0 group-hover:opacity-100 text-white/30 hover:text-indigo-400 transition-all flex-shrink-0"
                                  >
                                    <Pencil className="h-3 w-3" />
                                  </button>
                                </div>

                                <div className="flex items-center gap-2 mt-2.5 pl-5 flex-wrap">
                                  <span className={cn(
                                    "text-[10px] font-medium px-1.5 py-0.5 rounded-full border",
                                    PRIORITY_STYLES[task.priority]
                                  )}>
                                    {task.priority}
                                  </span>
                                  {task.due_date && (
                                    <span className={cn(
                                      "flex items-center gap-1 text-[10px]",
                                      overdue ? "text-red-400 font-medium" : "text-white/30"
                                    )}>
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
                                </div>
                              </div>
                            )}
                          </Draggable>
                        );
                      })}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </div>
            );
          })}
        </div>
      </DragDropContext>

      {editingTask && (
        <EditTaskDialog
          task={editingTask}
          stages={stages}
          employees={employees}
          open={!!editingTask}
          onClose={() => setEditingTask(null)}
          onSaved={(patch) => handleSaved(editingTask.id, patch)}
          onDeleted={handleDeleted}
        />
      )}
    </div>
  );
}

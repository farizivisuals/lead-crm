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
import { Calendar, User, CheckCircle, GripVertical, Pencil } from "lucide-react";
import { formatDate, cn } from "@/lib/utils";
import EditTaskDialog from "./EditTaskDialog";

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

const PRIORITY_COLORS: Record<string, string> = {
  low: "text-gray-400",
  medium: "text-blue-500",
  high: "text-orange-500",
  urgent: "text-red-500",
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
    if (
      source.droppableId === destination.droppableId &&
      source.index === destination.index
    )
      return;

    const toStageId = destination.droppableId;

    // Optimistic update
    setLocalTasks((prev) =>
      prev.map((t) =>
        t.id === draggableId ? { ...t, current_stage_id: toStageId } : t
      )
    );

    const { error } = await supabase
      .from("tasks")
      .update({ current_stage_id: toStageId })
      .eq("id", draggableId);

    if (error) {
      // Rollback
      setLocalTasks((prev) =>
        prev.map((t) =>
          t.id === draggableId ? { ...t, current_stage_id: source.droppableId } : t
        )
      );
    } else {
      onTaskMoved?.();
    }
  }

  function handleSaved(taskId: string, patch: Partial<Task>) {
    setLocalTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, ...patch } : t))
    );
  }

  function handleDeleted(taskId: string) {
    setLocalTasks((prev) => prev.filter((t) => t.id !== taskId));
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 mb-4">
        <span
          className="w-3 h-3 rounded-full"
          style={{ backgroundColor: stages[0]?.color ?? "#6366f1" }}
        />
        <h3 className="font-semibold text-gray-800">{deptName}</h3>
        <span className="text-xs text-gray-400">({localTasks.length} tasks)</span>
      </div>

      <DragDropContext onDragEnd={onDragEnd}>
        <div className="flex gap-4 overflow-x-auto pb-4">
          {stages.map((stage) => {
            const stageTasks = tasksByStage(stage.id);
            return (
              <div key={stage.id} className="flex-shrink-0 w-72">
                {/* Column header */}
                <div
                  className="rounded-t-lg px-3 py-2 flex items-center justify-between"
                  style={{ backgroundColor: `${stage.color ?? "#6366f1"}20` }}
                >
                  <div className="flex items-center gap-2">
                    {stage.is_terminal && (
                      <CheckCircle className="h-3.5 w-3.5 text-green-500" />
                    )}
                    <span
                      className="text-sm font-medium"
                      style={{ color: stage.color ?? "#6366f1" }}
                    >
                      {stage.name}
                    </span>
                  </div>
                  <span className="text-xs text-gray-500 bg-white px-1.5 py-0.5 rounded-full">
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
                        "rounded-b-lg min-h-[200px] p-2 space-y-2 border border-t-0 border-gray-200 transition-colors",
                        snapshot.isDraggingOver ? "bg-blue-50" : "bg-gray-50"
                      )}
                    >
                      {stageTasks.map((task, index) => (
                        <Draggable key={task.id} draggableId={task.id} index={index}>
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              className={cn(
                                "bg-white rounded-lg border border-gray-200 p-3 shadow-sm select-none group",
                                snapshot.isDragging
                                  ? "shadow-lg border-blue-300 rotate-1"
                                  : "hover:border-gray-300 hover:shadow"
                              )}
                            >
                              {/* Top row: grip + title + edit button */}
                              <div className="flex items-start gap-2">
                                <span
                                  {...provided.dragHandleProps}
                                  className="mt-0.5 text-gray-300 hover:text-gray-500 cursor-grab active:cursor-grabbing flex-shrink-0"
                                  title="Drag to move"
                                >
                                  <GripVertical className="h-4 w-4" />
                                </span>

                                <p
                                  className="text-sm font-medium text-gray-900 leading-snug flex-1 cursor-pointer hover:text-blue-600"
                                  onClick={() => setEditingTask(task)}
                                >
                                  {task.title}
                                </p>

                                <button
                                  onClick={() => setEditingTask(task)}
                                  className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-blue-600 transition-opacity flex-shrink-0"
                                  title="Edit task"
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </button>
                              </div>

                              {/* Meta row */}
                              <div className="flex items-center gap-3 mt-2 text-xs text-gray-400 pl-6">
                                <span className={PRIORITY_COLORS[task.priority]}>
                                  {task.priority}
                                </span>
                                {task.due_date && (
                                  <span className="flex items-center gap-1">
                                    <Calendar className="h-3 w-3" />
                                    {formatDate(task.due_date)}
                                  </span>
                                )}
                                {task.assigned_to && (
                                  <span className="flex items-center gap-1">
                                    <User className="h-3 w-3" />
                                    {(
                                      task.employees as {
                                        profiles?: { full_name: string };
                                      }
                                    )?.profiles?.full_name?.split(" ")[0]}
                                  </span>
                                )}
                              </div>
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </div>
            );
          })}
        </div>
      </DragDropContext>

      {/* Edit dialog — single instance, changes task target */}
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

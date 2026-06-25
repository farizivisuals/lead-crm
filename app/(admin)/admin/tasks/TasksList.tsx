"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Calendar, User, ListTodo } from "lucide-react";
import { formatDate } from "@/lib/utils";
import type { TaskPriority } from "@/lib/types";

export interface TaskRow {
  id: string;
  title: string;
  priority: TaskPriority;
  due_date: string | null;
  project_id: string;
  project_name: string;
  dept_name: string;
  stage_name: string;
  is_terminal: boolean;
  assignee_id: string | null;
  assignee_name: string | null;
}

const PRIORITY_VARIANT: Record<TaskPriority, "default" | "secondary" | "warning" | "destructive"> = {
  low: "secondary",
  medium: "default",
  high: "warning",
  urgent: "destructive",
};

export default function TasksList({ rows, canFilter }: { rows: TaskRow[]; canFilter: boolean }) {
  const [assignee, setAssignee] = useState<string>("all");

  // Distinct assignees present in the data (execs only; team members see just their own).
  const assignees = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of rows) {
      if (r.assignee_id) map.set(r.assignee_id, r.assignee_name ?? "Unknown");
    }
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [rows]);

  const visible = useMemo(() => {
    if (assignee === "all") return rows;
    if (assignee === "unassigned") return rows.filter((r) => !r.assignee_id);
    return rows.filter((r) => r.assignee_id === assignee);
  }, [rows, assignee]);

  if (rows.length === 0) {
    return (
      <div className="rounded-2xl bg-white/[0.04] backdrop-blur-xl border border-white/[0.08] py-20 text-center">
        <div className="w-14 h-14 rounded-2xl bg-white/[0.06] border border-white/[0.08] flex items-center justify-center mx-auto mb-4">
          <ListTodo className="h-7 w-7 text-white/20" />
        </div>
        <p className="text-white/60 font-medium">No tasks</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {canFilter && assignees.length > 1 && (
        <select
          value={assignee}
          onChange={(e) => setAssignee(e.target.value)}
          className="bg-white/[0.06] border border-white/[0.12] rounded-xl px-3 py-2 text-sm text-white/80 focus:outline-none focus:border-white/30"
        >
          <option value="all">All assignees</option>
          {assignees.map(([id, name]) => (
            <option key={id} value={id}>{name}</option>
          ))}
          <option value="unassigned">Unassigned</option>
        </select>
      )}

      <div className="space-y-2">
        {visible.map((t) => (
          <Link key={t.id} href={`/admin/projects/${t.project_id}/tasks`}>
            <div className="group rounded-2xl bg-white/[0.04] backdrop-blur-xl border border-white/[0.08] p-4 hover:bg-white/[0.07] hover:border-white/[0.14] transition-all duration-200 cursor-pointer">
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className={`font-semibold text-white/90 group-hover:text-white transition-colors leading-tight ${t.is_terminal ? "line-through text-white/40" : ""}`}>
                    {t.title}
                  </p>
                  <p className="text-sm text-white/35 mt-0.5 truncate">
                    {t.project_name} · {t.dept_name} · {t.stage_name}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-2 flex-shrink-0">
                  <Badge variant={PRIORITY_VARIANT[t.priority]}>{t.priority}</Badge>
                  {t.assignee_name && (
                    <span className="flex items-center gap-1 text-xs text-white/40">
                      <User className="h-3 w-3" />
                      {t.assignee_name}
                    </span>
                  )}
                  {t.due_date && (
                    <span className="flex items-center gap-1 text-xs text-white/30">
                      <Calendar className="h-3 w-3" />
                      {formatDate(t.due_date)}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

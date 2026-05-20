"use client";

import { useState, useTransition } from "react";
import { updateProjectStatus } from "./actions";
import type { ProjectStatus } from "@/lib/types";
import { PROJECT_STATUS_LABELS } from "@/lib/rbac";
import { ChevronDown, Loader2 } from "lucide-react";

const ALL_STATUSES: ProjectStatus[] = ["planning", "active", "on_hold", "completed", "delivered", "cancelled"];

const statusStyles: Record<ProjectStatus, string> = {
  planning: "text-blue-400 border-blue-500/30 bg-blue-500/10 hover:bg-blue-500/20",
  active: "text-white/80 border-white/20 bg-white/[0.06] hover:bg-white/[0.1]",
  on_hold: "text-amber-400 border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20",
  completed: "text-green-400 border-green-500/30 bg-green-500/10 hover:bg-green-500/20",
  delivered: "text-emerald-400 border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20",
  cancelled: "text-red-400 border-red-500/30 bg-red-500/10 hover:bg-red-500/20",
};

export default function ProjectStatusSelect({ projectId, currentStatus }: { projectId: string; currentStatus: ProjectStatus }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function handleSelect(status: ProjectStatus) {
    setOpen(false);
    if (status === currentStatus) return;
    startTransition(() => updateProjectStatus(projectId, status));
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        disabled={pending}
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border transition-colors ${statusStyles[currentStatus]}`}
      >
        {pending
          ? <Loader2 className="h-3 w-3 animate-spin" />
          : PROJECT_STATUS_LABELS[currentStatus]
        }
        <ChevronDown className="h-3 w-3 opacity-60" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full mt-1 z-50 min-w-[140px] rounded-xl border border-white/[0.1] bg-[#16161f] shadow-2xl shadow-black/50 overflow-hidden">
            {ALL_STATUSES.map((s) => (
              <button
                key={s}
                onClick={() => handleSelect(s)}
                className={`w-full text-left px-3 py-2 text-xs font-medium transition-colors ${
                  s === currentStatus
                    ? "bg-white/[0.08] text-white"
                    : "text-white/60 hover:bg-white/[0.05] hover:text-white"
                }`}
              >
                {PROJECT_STATUS_LABELS[s]}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

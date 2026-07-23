"use client";
import type { Department } from "@/lib/types";

interface Props {
  departments: Department[];
  selected: string[];
  onChange: (ids: string[]) => void;
}

export default function DepartmentChecklist({ departments, selected, onChange }: Props) {
  return (
    <div className="rounded-xl border border-white/[0.09] bg-white/[0.03] divide-y divide-white/[0.05]">
      {departments.map((d) => (
        <label
          key={d.id}
          className="flex items-center gap-2.5 px-3 py-2 text-sm text-white/70 hover:bg-white/[0.04] cursor-pointer transition-colors"
        >
          <input
            type="checkbox"
            checked={selected.includes(d.id)}
            onChange={(e) =>
              onChange(
                e.target.checked
                  ? [...selected, d.id]
                  : selected.filter((id) => id !== d.id)
              )
            }
            className="h-3.5 w-3.5 rounded accent-white cursor-pointer"
          />
          {d.name}
        </label>
      ))}
      {!departments.length && (
        <p className="px-3 py-2 text-xs text-white/30">No departments yet</p>
      )}
    </div>
  );
}

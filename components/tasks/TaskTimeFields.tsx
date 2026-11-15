"use client";
import { AlertTriangle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Clash } from "@/lib/task-time";

/** Optional start/end time. Leave both blank for an all-day task. */
export function TaskTimeFields({
  start,
  end,
  onChange,
}: {
  start: string;
  end: string;
  onChange: (patch: { start_time?: string; end_time?: string }) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="space-y-2">
        <Label>Start time</Label>
        <Input type="time" value={start} onChange={(e) => onChange({ start_time: e.target.value })} />
      </div>
      <div className="space-y-2">
        <Label>End time</Label>
        <Input type="time" value={end} onChange={(e) => onChange({ end_time: e.target.value })} />
      </div>
    </div>
  );
}

/** Double-booking notice. A heads-up only — it never stops the save. */
export function BusyWarning({ name, clashes }: { name: string; clashes: Clash[] }) {
  if (clashes.length === 0) return null;
  return (
    <div className="flex gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
      <AlertTriangle className="h-4 w-4 text-amber-400 flex-shrink-0 mt-0.5" />
      <div className="text-sm">
        <p className="font-medium text-amber-300">{name} is busy then</p>
        <ul className="mt-1 space-y-0.5 text-amber-400/80">
          {clashes.map((t) => (
            <li key={t.id}>
              · {t.title}
              {t.when ? ` (${t.when})` : " (all day)"}
            </li>
          ))}
        </ul>
        <p className="mt-1 text-xs text-amber-400/60">You can still save.</p>
      </div>
    </div>
  );
}

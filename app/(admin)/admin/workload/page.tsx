import Link from "next/link";
import { Gauge, ChevronLeft, ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireExecutive } from "@/lib/auth/guards";
import { ROLE_LABELS } from "@/lib/rbac";
import { cn } from "@/lib/utils";
import { kuwaitToday, loadLevel, loadWorkload } from "@/lib/workload";

const LEVEL = {
  low: { bar: "bg-emerald-400", text: "text-emerald-300" },
  mid: { bar: "bg-amber-400", text: "text-amber-300" },
  high: { bar: "bg-red-400", text: "text-red-300" },
};

/** "2026-11" → [2026, 10]; anything else → this month in Kuwait. */
function parseMonth(m: string | undefined): [number, number] {
  const match = /^(\d{4})-(\d{2})$/.exec(m ?? "");
  if (match) return [Number(match[1]), Number(match[2]) - 1];
  const [y, mo] = kuwaitToday().split("-").map(Number);
  return [y!, mo! - 1];
}
const monthParam = (y: number, m: number) => {
  const d = new Date(Date.UTC(y, m, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
};

export default async function WorkloadPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  await requireExecutive();
  const { month } = await searchParams;
  const [year, mon] = parseMonth(month);
  const supabase = await createClient();
  const { rows, days } = await loadWorkload(supabase, year, mon);
  const today = kuwaitToday();
  const title = new Date(Date.UTC(year, mon, 1)).toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });

  return (
    <div className="space-y-6 animate-slide-up max-w-5xl">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Gauge className="h-3.5 w-3.5 text-zinc-400" />
            <span className="text-xs text-zinc-400 font-medium uppercase tracking-widest">Workload</span>
          </div>
          <h1 className="text-xl lg:text-2xl font-bold text-white tracking-tight">How booked is everyone</h1>
          <p className="text-white/40 text-sm mt-1">
            {`Days booked out of ${days.length} working days (Sun–Thu). Tasks, videos and clients are what's open right now.`}
          </p>
        </div>
        <div className="flex items-center gap-1 rounded-xl border border-white/[0.08] bg-white/[0.04] p-1">
          <Link href={`/admin/workload?month=${monthParam(year, mon - 1)}`} className="p-1.5 rounded-lg text-white/50 hover:text-white hover:bg-white/[0.08]" aria-label="Previous month">
            <ChevronLeft className="h-4 w-4" />
          </Link>
          <span className="px-2 text-sm font-medium text-white/80 min-w-[120px] text-center">{title}</span>
          <Link href={`/admin/workload?month=${monthParam(year, mon + 1)}`} className="p-1.5 rounded-lg text-white/50 hover:text-white hover:bg-white/[0.08]" aria-label="Next month">
            <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
      </div>

      <div className="rounded-2xl bg-white/[0.04] border border-white/[0.08] divide-y divide-white/[0.06]">
        {rows.length === 0 && <p className="px-5 py-8 text-sm text-white/40">No employees yet.</p>}
        {rows.map((r) => {
          const level = LEVEL[loadLevel(r.bookedCount, days.length)];
          const pct = days.length ? Math.round((r.bookedCount / days.length) * 100) : 0;
          return (
            <Link
              key={r.id}
              href={`/admin/calendar?emp=${r.id}`}
              className="flex flex-col lg:flex-row lg:items-center gap-3 lg:gap-6 px-4 lg:px-5 py-4 hover:bg-white/[0.03] transition-colors"
            >
              <div className="lg:w-40 min-w-0">
                <p className="text-sm font-semibold text-white truncate">{r.name}</p>
                <p className="text-xs text-white/35">{ROLE_LABELS[r.role]}</p>
              </div>

              <div className="flex-1 min-w-0 space-y-1.5">
                <div className="flex items-center gap-3">
                  <div className="h-2 flex-1 rounded-full bg-white/[0.08] overflow-hidden">
                    <div className={cn("h-full rounded-full", level.bar)} style={{ width: `${pct}%` }} />
                  </div>
                  <span className={cn("text-sm font-semibold tabular-nums w-24 text-right", level.text)}>
                    {r.bookedCount}/{days.length} days
                  </span>
                </div>
                <div className="flex gap-[3px]" aria-label="Booked days">
                  {days.map((d, i) => (
                    <span
                      key={d}
                      title={`${d}${r.booked[i] ? " · booked" : " · free"}`}
                      className={cn(
                        "h-2.5 flex-1 rounded-[3px]",
                        r.booked[i] ? level.bar : "bg-white/[0.07]",
                        d === today && "ring-1 ring-white/70"
                      )}
                    />
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-4 gap-4 lg:w-80 text-center">
                <Stat value={r.tasks} label="Tasks" note={r.creativeTasks ? `+${r.creativeTasks} creative` : undefined} />
                <Stat value={r.videos} label="Videos" />
                <Stat value={r.clients} label="Clients" />
                <Stat value={r.overdue} label="Overdue" alert={r.overdue > 0} />
              </div>
            </Link>
          );
        })}
      </div>
      <p className="text-xs text-white/30">Click someone to see their calendar. Today is outlined in the day strip.</p>
    </div>
  );
}

function Stat({ value, label, note, alert }: { value: number; label: string; note?: string; alert?: boolean }) {
  return (
    <div>
      <p className={cn("text-lg font-bold tabular-nums", alert ? "text-red-400" : "text-white")}>{value}</p>
      <p className="text-[10px] uppercase tracking-wider text-white/35">{label}</p>
      {note && <p className="text-[10px] text-violet-300/70">{note}</p>}
    </div>
  );
}

// Task time slots, shared by web and mobile. A slot runs from
// `start_date start_time` to `due_date end_time`; a missing time means the
// whole day. Times are Kuwait local `time` values, no timezone conversion.

type Db = { from(table: string): any };

export type Slot = {
  start_date: string;
  due_date: string;
  start_time: string | null;
  end_time: string | null;
};

const hhmm = (t: string | null) => (t ? t.slice(0, 5) : null);

/** Zero-padded ISO-ish strings compare correctly as plain strings. */
function bounds(s: Slot): [string, string] {
  return [`${s.start_date}T${hhmm(s.start_time) ?? "00:00"}`, `${s.due_date}T${hhmm(s.end_time) ?? "24:00"}`];
}

/** Touching slots (9–12 and 12–3) do not overlap. */
export function slotsOverlap(a: Slot, b: Slot): boolean {
  const [as, ae] = bounds(a);
  const [bs, be] = bounds(b);
  return as < be && bs < ae;
}

export function timeErrors(s: Slot): string | null {
  if (s.start_time && !s.end_time) return "Add an end time";
  if (!s.start_time && s.end_time) return "Add a start time";
  if (s.start_time && s.end_time && s.start_date === s.due_date && hhmm(s.end_time)! <= hhmm(s.start_time)!) {
    return "End time must be after start time";
  }
  return null;
}

/** "9" / "9:00" / "09:00" → "09:00"; blank → null; anything else → "invalid". */
export function normalizeTime(input: string): string | null | "invalid" {
  const v = input.trim();
  if (!v) return null;
  const m = /^(\d{1,2})(?::(\d{2}))?$/.exec(v);
  if (!m) return "invalid";
  const h = Number(m[1]);
  const min = Number(m[2] ?? "0");
  if (h > 23 || min > 59) return "invalid";
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

export function timeRange(start: string | null, end: string | null): string {
  return start && end ? `${hhmm(start)}–${hhmm(end)}` : "";
}

export type Clash = { id: string; title: string; when: string };

/**
 * Other tasks for `assignee` whose slots overlap `slot`. The database narrows
 * by date; times are compared here. A warning only — never a reason to block.
 */
/** Two tasks at the same time is normal (a shoot plus a photo shoot); warn from the third. */
export const MAX_TASKS_AT_ONCE = 2;

/**
 * The person's tasks that overlap `slot` — but only once they already have
 * MAX_TASKS_AT_ONCE of them (this booking would be one too many). Otherwise [].
 */
export async function bookingClashes(db: Db, assignee: string, slot: Slot, excludeTaskId: string | null): Promise<Clash[]> {
  let query = db
    .from("tasks")
    .select("id, title, start_date, due_date, start_time, end_time")
    .eq("assigned_to", assignee)
    .not("start_date", "is", null)
    .not("due_date", "is", null)
    .lte("start_date", slot.due_date)
    .gte("due_date", slot.start_date);
  if (excludeTaskId) query = query.neq("id", excludeTaskId);
  const { data, error } = await query;
  if (error) throw error;
  const clashes = ((data ?? []) as (Slot & { id: string; title: string })[])
    .filter((t) => slotsOverlap(t, slot))
    .map((t) => ({ id: t.id, title: t.title, when: timeRange(t.start_time, t.end_time) }));
  return clashes.length >= MAX_TASKS_AT_ONCE ? clashes : [];
}

/** For typed time fields (mobile): normalise both and say what's wrong, if anything. */
export function readTimes(
  startText: string,
  endText: string,
  startDate: string,
  dueDate: string
): { start_time: string | null; end_time: string | null; problem: string | null } {
  const s = normalizeTime(startText);
  const e = normalizeTime(endText);
  if (s === "invalid" || e === "invalid") return { start_time: null, end_time: null, problem: "Use times like 09:00 or 13:30" };
  return { start_time: s, end_time: e, problem: timeErrors({ start_date: startDate, due_date: dueDate, start_time: s, end_time: e }) };
}

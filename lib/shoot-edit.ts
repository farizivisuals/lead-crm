// Shoot → edit handoff: create one shoot task plus one linked edit task per
// editor. Shared by the web New Task dialog and the mobile new-task screen
// (mobile imports it as `@shared/shoot-edit`), so it must stay free of React,
// Next.js and any one Supabase client. Spec:
// docs/superpowers/specs/2026-11-14-shoot-edit-handoff-design.md
import type { TaskPriority } from "./types";

/** Any Supabase client (web and mobile pin different supabase-js versions). */
type Db = { from(table: string): any };

export type StageLite = { id: string; name: string; position: number; is_terminal: boolean };

export type EditBlock = {
  editorId: string;
  editorName: string;
  startDate: string;
  dueDate: string;
  videos: string[];
};

export type ShootWithEditsInput = {
  projectId: string;
  departmentId: string;
  /** All stages of the task's department. */
  stages: StageLite[];
  title: string;
  description: string;
  priority: TaskPriority;
  shootDate: string;
  shooterId: string | null;
  creativeIds: string[];
  edits: EditBlock[];
  userId: string;
};

const byPosition = (stages: StageLite[]) => [...stages].sort((a, b) => a.position - b.position);
const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? name;

/** The stage right after "Shoot" (Video: Post-production), or null if the department has no Shoot stage. */
export function editStageAfterShoot(stages: StageLite[]): StageLite | null {
  const ordered = byPosition(stages);
  const i = ordered.findIndex((s) => s.name.toLowerCase() === "shoot");
  return i === -1 ? null : ordered[i + 1] ?? null;
}

export function editTaskTitle(title: string, editorName: string): string {
  return `${title} — Edit (${firstName(editorName)})`;
}

/** The first thing wrong with the booking, worded for the user, or null. */
export function shootEditErrors(input: ShootWithEditsInput): string | null {
  if (!input.shootDate) return "Pick a shoot date";
  if (input.edits.length === 0) return "Add at least one edit block";
  for (const b of input.edits) {
    if (!b.editorId) return "Pick an editor";
    if (!b.startDate || !b.dueDate) return "Add edit start and due dates";
    if (b.dueDate < b.startDate) return "Edit due date is before its start date";
    if (b.videos.length === 0) return `Add at least one video for ${firstName(b.editorName)}`;
  }
  const seen = new Set<string>();
  for (const b of input.edits) {
    if (seen.has(b.editorId)) return `${firstName(b.editorName)} is in two edit blocks`;
    seen.add(b.editorId);
  }
  return null;
}

/** Same overlap rule as NewTaskDialog's availability check. */
async function bookedTitles(db: Db, assignee: string, start: string, due: string): Promise<string[]> {
  const { data, error } = await db
    .from("tasks")
    .select("id, title")
    .eq("assigned_to", assignee)
    .not("start_date", "is", null)
    .not("due_date", "is", null)
    .lte("start_date", due)
    .gte("due_date", start);
  if (error) throw error;
  return ((data ?? []) as { title: string }[]).map((t) => t.title);
}

/**
 * Validates, checks everyone's availability, then inserts the shoot task and
 * one edit task per block. Any failed insert deletes every task this call
 * created (their videos and creatives cascade with them) and rethrows.
 */
export async function createShootWithEdits(
  db: Db,
  input: ShootWithEditsInput
): Promise<{ shootId: string; editIds: string[] }> {
  const problem = shootEditErrors(input);
  if (problem) throw new Error(problem);

  const ordered = byPosition(input.stages);
  const firstStage = ordered[0];
  const editStage = editStageAfterShoot(input.stages);
  if (!firstStage || !editStage) throw new Error("This department has no Shoot stage");

  if (input.shooterId) {
    const clash = await bookedTitles(db, input.shooterId, input.shootDate, input.shootDate);
    if (clash.length) throw new Error(`The shooter is already booked then: ${clash.join(", ")}`);
  }
  for (const b of input.edits) {
    const clash = await bookedTitles(db, b.editorId, b.startDate, b.dueDate);
    if (clash.length) throw new Error(`${firstName(b.editorName)} is already booked then: ${clash.join(", ")}`);
  }

  const created: string[] = [];
  const base = {
    project_id: input.projectId,
    department_id: input.departmentId,
    description: input.description.trim() || null,
    priority: input.priority,
    created_by: input.userId,
  };

  async function insertTask(row: Record<string, unknown>): Promise<string> {
    const { data, error } = await db.from("tasks").insert(row).select("id").single();
    if (error) throw error;
    created.push(data.id);
    return data.id as string;
  }
  async function insertRows(table: string, rows: Record<string, unknown>[]) {
    if (rows.length === 0) return;
    const { error } = await db.from(table).insert(rows);
    if (error) throw error;
  }
  const creativesFor = (taskId: string) => input.creativeIds.map((profile_id) => ({ task_id: taskId, profile_id }));

  try {
    const shootId = await insertTask({
      ...base,
      current_stage_id: firstStage.id,
      title: input.title.trim(),
      start_date: input.shootDate,
      due_date: input.shootDate,
      assigned_to: input.shooterId,
    });
    await insertRows("task_creatives", creativesFor(shootId));

    const editIds: string[] = [];
    for (const b of input.edits) {
      const editId = await insertTask({
        ...base,
        current_stage_id: editStage.id,
        title: editTaskTitle(input.title.trim(), b.editorName),
        start_date: b.startDate,
        due_date: b.dueDate,
        assigned_to: b.editorId,
        follows_task_id: shootId,
      });
      editIds.push(editId);
      await insertRows(
        "task_deliverables",
        b.videos.map((title, position) => ({ task_id: editId, title, position, current_stage_id: editStage.id }))
      );
      await insertRows("task_creatives", creativesFor(editId));
    }
    return { shootId, editIds };
  } catch (e) {
    if (created.length) await db.from("tasks").delete().in("id", created);
    throw e;
  }
}

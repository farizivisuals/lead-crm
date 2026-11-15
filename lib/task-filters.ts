// Shared by the web and mobile calendars and "my tasks" lists. Kept free of
// app imports so the mobile bundle can pull it in through @shared.

type Db = { from(table: string): any };

export type TaskKind = "shoot" | "edit" | "other";

export type KindInput = {
  id: string;
  follows_task_id: string | null;
  department_id: string;
  /** Position of the task's current stage. */
  stage_position: number | null;
};

/**
 * Shoot or edit, for the calendar filter. A linked edit task is always an
 * edit and a shoot with linked edits is always a shoot (it jumps to Delivered
 * on handoff). Anything else in a department with a "Shoot" stage is a shoot
 * up to that stage and an edit after it. Departments with no Shoot stage
 * (Creatives, PR) are neither.
 *
 * @param shootPositions department id → position of its "Shoot" stage
 */
export function taskKinds(tasks: KindInput[], shootPositions: Record<string, number>): Map<string, TaskKind> {
  const hasEdits = new Set(tasks.map((t) => t.follows_task_id).filter(Boolean));
  const kinds = new Map<string, TaskKind>();
  for (const t of tasks) {
    const shootPos = shootPositions[t.department_id];
    let kind: TaskKind = "other";
    if (t.follows_task_id) kind = "edit";
    else if (hasEdits.has(t.id)) kind = "shoot";
    else if (shootPos != null && t.stage_position != null) kind = t.stage_position <= shootPos ? "shoot" : "edit";
    kinds.set(t.id, kind);
  }
  return kinds;
}

/** A task is someone's if it is assigned to them or they are a creative on it. */
export function isMine(task: { assignedTo: string | null; creativeIds: string[] }, who: string): boolean {
  return task.assignedTo === who || task.creativeIds.includes(who);
}

/** PostgREST `.or()` filter for tasks assigned to `who` or that `who` is a creative on. */
export async function myTaskFilter(db: Db, who: string): Promise<string> {
  const { data, error } = await db.from("task_creatives").select("task_id").eq("profile_id", who);
  if (error) throw error;
  const ids = ((data ?? []) as { task_id: string }[]).map((r) => r.task_id);
  return ids.length ? `assigned_to.eq.${who},id.in.(${ids.join(",")})` : `assigned_to.eq.${who}`;
}

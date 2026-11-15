import { supabase } from '../supabase';
import { one } from '../data';

/**
 * Task deliverables — the per-item unit of work inside a task ("Video 1",
 * "Video 2"). NOT the same thing as `./deliverables`, which is the client-facing
 * file submission with a Dropbox link and an approval flow.
 *
 * Each deliverable carries its OWN stage, so one video can be in Post-production
 * while its siblings are still in Shoot. A `(deliverable, stage)` row in
 * `task_deliverable_assignments` holds that phase's scheduling — who and when —
 * and rows for earlier stages are the permanent record of who did what.
 *
 * This mirrors `components/tasks/TaskCards.tsx` on the web; the two clients
 * write the same columns and must keep agreeing.
 */

/** Verbatim in both the board and the single-task select — keep them identical. */
export const TASK_DELIVERABLES_SELECT =
  'task_deliverables(id, task_id, title, position, current_stage_id, task_deliverable_assignments(deliverable_id, stage_id, assigned_to, scheduled_date, employees!task_deliverable_assignments_assigned_to_fkey(profiles(full_name))))';

export type TaskDeliverableAssignment = {
  deliverable_id: string;
  stage_id: string;
  assigned_to: string | null;
  scheduled_date: string | null;
  employees:
    | { profiles: { full_name: string } | null }
    | { profiles: { full_name: string } | null }[]
    | null;
};

export type TaskDeliverable = {
  id: string;
  task_id: string;
  title: string;
  position: number;
  /** NULL means "inherit the parent task's stage". */
  current_stage_id: string | null;
  task_deliverable_assignments: TaskDeliverableAssignment[] | null;
};

export type StageLite = {
  id: string;
  name: string;
  position: number;
  is_terminal: boolean;
  color: string | null;
};

export function sortDeliverables(
  rows: TaskDeliverable[] | null | undefined
): TaskDeliverable[] {
  return [...(rows ?? [])].sort((a, b) => a.position - b.position);
}

/** A deliverable's effective stage id, falling back to its task's. */
export function deliverableStageId(d: TaskDeliverable, taskStageId: string): string {
  return d.current_stage_id ?? taskStageId;
}

/** The scheduling row for a deliverable at one stage, if any. */
export function stageRow(
  d: TaskDeliverable,
  stageId: string
): TaskDeliverableAssignment | null {
  return (d.task_deliverable_assignments ?? []).find((a) => a.stage_id === stageId) ?? null;
}

export function assigneeName(row: TaskDeliverableAssignment | null): string | null {
  if (!row?.assigned_to) return null;
  return one(row.employees)?.profiles?.full_name ?? null;
}

/**
 * The task's own stage tracks its LEAST-advanced deliverable, so the dashboards,
 * the projects list's done/total fraction and the calendar all stay truthful
 * while individual deliverables run ahead. Same rule as the web's syncTaskStage.
 */
export function leastAdvancedStageId(
  deliverables: TaskDeliverable[],
  stages: StageLite[],
  taskStageId: string
): string {
  if (deliverables.length === 0) return taskStageId;
  const positions = deliverables.map((d) => {
    const id = deliverableStageId(d, taskStageId);
    return stages.find((s) => s.id === id)?.position ?? 0;
  });
  const min = Math.min(...positions);
  return stages.find((s) => s.position === min)?.id ?? taskStageId;
}

/** The stage one step forward (+1) or back (-1), or null at either end. */
export function adjacentStage(
  stages: StageLite[],
  stageId: string,
  dir: 1 | -1
): StageLite | null {
  const ordered = [...stages].sort((a, b) => a.position - b.position);
  const idx = ordered.findIndex((s) => s.id === stageId);
  if (idx === -1) return null;
  return ordered[idx + dir] ?? null;
}

export async function insertDeliverables(taskId: string, titles: string[], stageId: string) {
  if (titles.length === 0) return;
  const { error } = await supabase.from('task_deliverables').insert(
    titles.map((title, i) => ({
      task_id: taskId,
      title,
      position: i,
      current_stage_id: stageId,
    }))
  );
  if (error) throw error;
}

/**
 * Merge-upsert one `(deliverable, stage)` row. Only the columns passed are
 * written, so setting a date never clears the assignee and vice versa.
 */
export async function patchStageRow(
  deliverableId: string,
  stageId: string,
  cols: { assigned_to?: string | null; scheduled_date?: string | null },
  userId: string | null
) {
  const payload: Record<string, string | null> = {
    deliverable_id: deliverableId,
    stage_id: stageId,
    ...cols,
  };
  if (cols.assigned_to !== undefined) payload.assigned_by = userId;

  const { error } = await supabase
    .from('task_deliverable_assignments')
    .upsert(payload, { onConflict: 'deliverable_id,stage_id' });
  if (error) throw error;
}

/**
 * Move one deliverable to another stage, then re-point the parent task at its
 * least-advanced deliverable. The task write is best-effort in the same sense
 * as the web: the deliverable move is the user's intent and must not be rolled
 * back if the derived task update fails.
 */
export async function moveDeliverable(input: {
  deliverableId: string;
  toStageId: string;
  taskId: string;
  deliverables: TaskDeliverable[];
  stages: StageLite[];
  taskStageId: string;
}) {
  const { error } = await supabase
    .from('task_deliverables')
    .update({ current_stage_id: input.toStageId })
    .eq('id', input.deliverableId);
  if (error) throw error;

  const next = input.deliverables.map((d) =>
    d.id === input.deliverableId ? { ...d, current_stage_id: input.toStageId } : d
  );
  const taskStage = leastAdvancedStageId(next, input.stages, input.taskStageId);
  if (taskStage !== input.taskStageId) {
    await supabase.from('tasks').update({ current_stage_id: taskStage }).eq('id', input.taskId);
  }
}

/**
 * The task screen's editable shape for one deliverable. `stageId` is not edited
 * through the form — it changes only via the move buttons, which write
 * immediately — but it is carried here because it decides WHICH phase row the
 * assignee and date belong to.
 */
export type DeliverableDraft = {
  /** null for a row the user just added and has not saved yet. */
  id: string | null;
  title: string;
  stageId: string;
  assignedTo: string | null;
  /** 'YYYY-MM-DD', or '' for none. */
  date: string;
};

/**
 * Persist the deliverable section of the task form in one pass: adds, renames,
 * reorders, removals, and each row's assignee/date for its CURRENT phase.
 *
 * Insertions run before deletions so a failed insert never strips the task of
 * deliverables it still has — the same ordering rule the creatives sync follows.
 */
export async function saveDeliverableDrafts(input: {
  taskId: string;
  drafts: DeliverableDraft[];
  original: TaskDeliverable[];
  userId: string | null;
}) {
  const kept = input.drafts
    .map((d) => ({ ...d, title: d.title.trim() }))
    .filter((d) => d.title.length > 0);

  // 1. New rows first, reading their ids back so their phase rows can be written.
  const toInsert = kept.filter((d) => d.id === null);
  let insertedIds: string[] = [];
  if (toInsert.length > 0) {
    const { data, error } = await supabase
      .from('task_deliverables')
      .insert(
        toInsert.map((d) => ({
          task_id: input.taskId,
          title: d.title,
          position: kept.indexOf(d),
          current_stage_id: d.stageId,
        }))
      )
      .select('id');
    if (error) throw error;
    insertedIds = (data ?? []).map((r: any) => r.id as string);
  }
  let nextInserted = 0;
  const resolved = kept.map((d) =>
    d.id ? d : { ...d, id: insertedIds[nextInserted++] ?? null }
  );

  // 2. Renames and reorders of rows that already existed.
  for (const [i, d] of resolved.entries()) {
    if (!d.id) continue;
    const before = input.original.find((o) => o.id === d.id);
    if (!before) continue;
    if (before.title === d.title && before.position === i) continue;
    const { error } = await supabase
      .from('task_deliverables')
      .update({ title: d.title, position: i })
      .eq('id', d.id);
    if (error) throw error;
  }

  // 3. Removals.
  const removed = input.original
    .filter((o) => !resolved.some((d) => d.id === o.id))
    .map((o) => o.id);
  if (removed.length > 0) {
    const { error } = await supabase.from('task_deliverables').delete().in('id', removed);
    if (error) throw error;
  }

  // 4. Who and when, for each row's current phase.
  for (const d of resolved) {
    if (!d.id) continue;
    const before = input.original.find((o) => o.id === d.id);
    const beforeRow = before ? stageRow(before, d.stageId) : null;
    const wantDate = d.date.trim() || null;

    if (!d.assignedTo && !wantDate) {
      if (beforeRow) {
        const { error } = await supabase
          .from('task_deliverable_assignments')
          .delete()
          .eq('deliverable_id', d.id)
          .eq('stage_id', d.stageId);
        if (error) throw error;
      }
      continue;
    }
    if (
      beforeRow &&
      beforeRow.assigned_to === d.assignedTo &&
      (beforeRow.scheduled_date ?? null) === wantDate
    ) {
      continue;
    }
    await patchStageRow(
      d.id,
      d.stageId,
      { assigned_to: d.assignedTo, scheduled_date: wantDate },
      input.userId
    );
  }
}

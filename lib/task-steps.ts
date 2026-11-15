// "Mark done": finish the current step and move to the next stage. The move
// itself is the database's complete_task_step (migration 0029); this only
// words the button. Shared by web and mobile.

type Stage = { id: string; name: string; position: number; is_terminal: boolean };

/** The button for a task in `currentStageId`, or null when there's nothing left to do. */
export function markDoneAction(stages: Stage[], currentStageId: string): { label: string; nextName: string } | null {
  const ordered = [...stages].sort((a, b) => a.position - b.position);
  const i = ordered.findIndex((s) => s.id === currentStageId);
  const cur = ordered[i];
  const next = ordered[i + 1];
  if (!cur || cur.is_terminal || !next) return null;
  if (next.is_terminal) return { label: "Mark done", nextName: next.name };
  if (cur.name.toLowerCase() === "assigned") return { label: `Start ${next.name}`, nextName: next.name };
  return { label: `${cur.name} done → ${next.name}`, nextName: next.name };
}

/** Who may press it: the task's assignee, or an executive. */
export const canMarkDone = (assignedTo: string | null, userId: string | undefined, isExec: boolean) =>
  isExec || (!!userId && assignedTo === userId);

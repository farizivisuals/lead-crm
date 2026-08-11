# Task Deliverables & Stage-Flow Redesign

**Date:** 2026-08-12
**Status:** Approved (web scope; iOS follow-up deferred)

## Problem

Tasks are currently moved across per-department Kanban boards by drag-and-drop, and a task has a single assignee (`tasks.assigned_to`) plus optional `task_creatives`. The agency's real workflow is per-deliverable: one video-production task contains e.g. Video 1/2/3, and each video is shot by one videographer and later edited by a (possibly different) editor. Assignment must be possible per item **or** all-items-to-one-person in one click, at every phase. The Kanban drag-and-drop is not wanted; tasks should move forward (and occasionally back) through stages with explicit buttons, ending in a terminal "done" stage.

## Scope

- **In:** Supabase schema + RLS, web admin Tasks page (`/admin/projects/[projectId]/tasks`), New/Edit Task dialogs.
- **Out (deferred):** iOS app screens (`feat/mobile-app` branch) — they keep working against the same backend and get the deliverables UI in a follow-up. Also out: per-item due dates/status, notifications on deliverable assignment, per-deliverable availability conflict checks, changes to the global `/admin/tasks` read-only list, changes to the existing file-submission `deliverables` table.

## Data model (one migration: `0021_task_deliverables.sql`)

```sql
CREATE TABLE task_deliverables (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id    UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  title      TEXT NOT NULL,
  position   INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE task_deliverable_assignments (
  deliverable_id UUID NOT NULL REFERENCES task_deliverables(id) ON DELETE CASCADE,
  stage_id       UUID NOT NULL REFERENCES department_stages(id) ON DELETE CASCADE,
  assigned_to    UUID NOT NULL REFERENCES employees(profile_id) ON DELETE CASCADE,
  assigned_by    UUID REFERENCES profiles(id),
  assigned_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (deliverable_id, stage_id)
);
```

- The row whose `stage_id` matches the task's `current_stage_id` is the **live assignment**.
- Rows for earlier stages are the permanent per-phase record ("Video 1 — Shoot: Sarah, Editing: Tom"). No separate history table.
- Reassigning within a stage = upsert on `(deliverable_id, stage_id)`.
- RLS mirrors `task_creatives`: any employee who can see the project (`can_see_project` via the task) can select and manage both tables. Clients have no access.
- The existing `deliverables` table (file submissions with Dropbox URL + approval flow) is untouched and unrelated.

## UI

### Tasks page — list grouped by stage (replaces Kanban)

- Per department section (unchanged header), tasks render as **rows grouped under stage headings** in stage `position` order, using each stage's color as heading accent. Empty stages show the heading with no rows (or a muted "—").
- Each row: title (click opens Edit dialog), priority badge, due date (+ overdue treatment), task assignee, and the task's deliverables with their **current-stage** assignee first-names (e.g. "Video 1 · Sarah").
- **Next stage →** button advances the task one stage (`current_stage_id` update — same write the drag used, so `task_stage_history` triggers keep firing). On the last non-terminal stage the button reads **Mark done ✓** and moves the task into the terminal stage.
- **← Back** as a secondary/smaller control moves one stage backward. Hidden on the first stage.
- After a successful forward move, if the task has deliverables, the **Assign Deliverables dialog auto-opens** for the new stage. Dismissable — assignment can be done later from the Edit dialog.
- `components/kanban/StageBoard.tsx` is deleted; it is the only consumer of `@hello-pangea/dnd`, so the dependency is removed from `package.json` too. The `components/kanban/` folder is renamed `components/tasks/` (it keeps `EditTaskDialog.tsx`). The departments settings page copy "These define the Kanban columns" is updated to "These define the workflow stages".

### Assign Deliverables dialog (new)

- Header: task title + current stage name.
- **"Assign all to…"** dropdown at top: picking a person fills every row in one click.
- One row per deliverable: title, assignee `Select` (department employees), and prior-phase context inline (e.g. "Shoot: Sarah") pulled from earlier-stage assignment rows.
- Save upserts `task_deliverable_assignments` rows for the current stage; unset rows are simply not written (a deliverable may stay unassigned in a phase).

### New Task dialog

- Gains a **Deliverables** section: text input + add button, removable chips/rows (e.g. Video 1, Video 2, Video 3). Optional — tasks without deliverables behave exactly as today.
- Existing single **Assign to** field stays: that is the whole-task creative owner at creation.
- On submit, deliverable rows insert after the task, mirroring the existing `task_creatives` pattern.

### Edit Task dialog

- Gains the same Deliverables section: add / rename / remove items, plus per-item current-stage assignee selects and the same "Assign all to…" shortcut (reuses the assignment dialog's row component).

## Error handling

- Stage move: optimistic UI update, revert on Supabase error (same pattern the board used).
- Assignment dialog: standard error text on failed upsert; dialog stays open.

## Testing

- Type check (`tsc --noEmit`) and production build must pass.
- Manual verification in the browser preview: create task with 3 deliverables → advance to Shoot → assign all to one person → advance to Editing → assign items individually → prior-phase names visible → back button works → Mark done lands in terminal stage.

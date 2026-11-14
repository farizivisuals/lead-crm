# Shoot → edit handoff (two linked tasks)

**Status:** draft for approval · 2026-11-14

## Why
When a shoot is booked, the edit should be planned at the same time: choose
the editor and the edit dates up front. The editor needs it as **their own task**
so it shows in their task list and calendar (those screens only show tasks
where the person is the main assignee). When the shoot is done, the work hands
over to the editor without anyone re-entering it.

## Goals
- Book the shoot and plan the edit in one step, on web and mobile.
- Edit task appears in the editor's task list + calendar immediately.
- Marking the shoot done closes the shoot task and tells the editor.

## Non-goals (for now)
- Adding an edit to a shoot task that already exists (create-time only).
- Per-video editors (one editor per edit task).
- Changing the task lists / calendars themselves — not needed.

## Approaches considered
- **A. Two linked tasks — picked.** Separate shoot task + edit task, linked.
  Existing "assigned to me" lists and calendars work unchanged.
- B. One task with the edit planned per stage. Rejected: every list/calendar on
  both platforms would need changing, and the editor would see a stage of
  someone else's task rather than their own.

## Design
**Which tasks get it:** departments whose stages include one named "Shoot"
(today: Video, Photo). The "edit stage" is the stage right after Shoot
(Video: Post-production, Photo: Editing).

**Create form (web dialog + mobile screen):** for those departments, an optional
**"Plan the edit"** toggle. When on:
- The shoot part asks for a single **shoot date** and the **shooter**.
- The edit part asks for **editor**, **edit start**, **edit due**. Editor list =
  people in the same department. Same availability-clash check as today.
- Saving creates two tasks:
  - **Shoot task** — title as typed, starts in the first stage, start = due = shoot date.
  - **Edit task** — title "<title> — Edit", starts in the edit stage, editor + edit
    dates, `follows_task_id` → shoot task.
- **Deliverables** (Video 1, 2, 3…) go on the edit task. **Creatives** go on both.
- If the second insert fails, delete the first (same rollback pattern as today).

**Database (one migration):**
- `tasks.follows_task_id UUID NULL REFERENCES tasks(id) ON DELETE SET NULL`.
- Trigger: when a shoot task that has an edit task following it moves forward
  past Shoot, it jumps straight to its department's done stage, and the editor
  gets a notification "Shoot done — ready to edit: <title>" via `notify_user`.
- Editor is also notified at creation by the existing "task assigned" trigger.

**On the task cards:** each linked task shows a small "Edit task →" /
"← Shoot task" link to the other.

## Left to the builder
Exact copy/labels, placement of the link chip, and the edit-task title format.

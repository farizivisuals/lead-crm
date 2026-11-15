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
- One shoot can be split across **several editors**: some videos to one
  editor, some to another, each with their own edit dates.
- Each edit task appears in its editor's task list + calendar immediately.
- Marking the shoot done closes the shoot task and tells every editor.

## Non-goals (for now)
- Adding edits to a shoot task that already exists (create-time only).
- Moving a video from one edit task to another after creation.
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
- The edit part is a list of **edit blocks** (starts with one, "+ Add editor"
  adds more). Each block: **editor**, **edit start**, **edit due**, and **its
  own videos** (Video 1, Video 2…). Editor list = people in the same
  department. Same availability-clash check as today, per block.
- Saving creates one shoot task plus one edit task per block:
  - **Shoot task** — title as typed, starts in the first stage, start = due = shoot date.
    No videos of its own.
  - **Edit task(s)** — title "<title> — Edit (<editor first name>)", starts in
    the edit stage, that block's editor, dates and videos, `follows_task_id` →
    shoot task.
- **Creatives** go on every task.
- If any insert fails, delete what was created (same rollback pattern as today).
- A block needs an editor, both dates and at least one video to save.

**Database (one migration):**
- `tasks.follows_task_id UUID NULL REFERENCES tasks(id) ON DELETE SET NULL`.
- Trigger: when a shoot task that has edit tasks following it moves forward
  past Shoot, it jumps straight to its department's done stage, and **each**
  editor gets "Shoot done — ready to edit: <title>" via `notify_user`.
- Editors are also notified at creation by the existing "task assigned" trigger.

**On the task cards:** the shoot task lists its edit tasks ("Edits: Ali, Sara"),
each a link; every edit task shows a "← Shoot task" link.

## Changes after review
- 2026-11-14: one shoot can feed several edit tasks (videos split across
  editors), instead of a single edit task.

## Left to the builder
Exact copy/labels, placement of the link chip, and the edit-task title format.

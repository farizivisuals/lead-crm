# Task times (short design)

**Why:** a shooter can do two shoots a day (9–12, 1–4) and a photo and video shoot at the same time. Today tasks are date-only and any same-person date overlap hard-blocks the save.

**Goals:** optional start/end time on a task; double-booking checks compare times; clashes only warn, never block (user's choice). Web, mobile, DB.

**Non-goals:** times on edit blocks or per-video phase dates; timezone handling (times are Kuwait local `time`, no conversion); recurring slots.

**Approaches considered:**
- Add nullable `start_time` / `end_time` (`time`) to `tasks` — **picked**: additive, every existing date query keeps working.
- Convert `start_date` / `due_date` to `timestamptz` — rewrites every query and date input on both clients; rejected.
- Block same department, allow cross-department — offered; user chose warn-only.

**Design:**
- A task's slot runs from `start_date start_time` to `due_date end_time`; a missing time means the whole day. Touching slots (9–12, 12–3) don't clash.
- Both times or neither; on a single-day task end must be after start.
- Shared `lib/task-time.ts`: `slotsOverlap`, `bookingClashes(db, assignee, slot, excludeId)`, `timeErrors`, `normalizeTime`, `timeRange`. Used by web New/Edit task dialogs, mobile new/edit task screens, and `shoot-edit`.
- Clash UI stays where it is but reads "X is busy then" and no longer disables Create/Save. "Plan the edit" asks "Create anyway?" when an editor is busy instead of refusing.
- Times show on the web calendar (timed events), the mobile calendar's day list, and task cards.

**Builder's calls:** mobile time fields are text `HH:MM` like its date fields (`9` and `9:00` accepted); "Plan the edit" shoot gets times, edit blocks stay day-based.

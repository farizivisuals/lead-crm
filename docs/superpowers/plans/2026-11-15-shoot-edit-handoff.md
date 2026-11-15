# Shoot → Edit Handoff Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When creating a Video/Photo task, optionally plan the edit: one shoot task plus one linked edit task per editor (own dates, own videos), with an automatic handoff when the shoot is done.

**Architecture:** One DB migration adds `tasks.follows_task_id` and a BEFORE UPDATE trigger that closes the shoot task and notifies editors. All creation logic lives in one shared file, `lib/shoot-edit.ts`, used by the web dialog and (via the existing `@shared` alias → `../lib`) the mobile screen. Lists and calendars need no change: edit tasks are ordinary tasks assigned to the editor.

**Tech Stack:** Next.js 16 + Supabase (web), Expo 56 + React Query + jest-expo (mobile), Postgres plpgsql.

**Spec:** `docs/superpowers/specs/2026-11-14-shoot-edit-handoff-design.md`

## Global Constraints

- Applies only to departments with a stage named "Shoot" (case-insensitive, same rule as `isShootStage`). Edit stage = the stage right after Shoot by `position` (Video: Post-production, Photo: Editing).
- Edit task title: `<title> — Edit (<editor first name>)`.
- Notification: title `Shoot done — ready to edit`, body `Shoot done — ready to edit: <shoot title>`, type `shoot_done`, entity `task` / edit task id.
- Shoot task: starts in the department's first stage, `start_date = due_date = shoot date`, no videos.
- Creatives go on every created task. Any failed insert deletes every task created in that call.
- Live database: test the trigger only inside `BEGIN … ROLLBACK`. Never create test tasks in the live DB without asking the user.
- Mobile ships via EAS Update (`eas update --branch production --environment production --platform ios`), never a store build; ask before publishing.
- Node 26: run tools by direct path (`node node_modules/typescript/bin/tsc --noEmit`, `node node_modules/jest/bin/jest.js`).

## Review Focus

1. Edit due date before edit start → blocked with "Edit due date is before its start date" (Task 2 test).
2. Same editor picked in two blocks → blocked with "<Name> is in two edit blocks" (Task 2 test).
3. Editor or shooter already booked in that window → nothing is created, error names the clash (Task 2 test).
4. Shoot task moved straight from Pre-production to Post-production (skipping Shoot) still hands over; moving backwards or within pre-Shoot stages does not (Task 1 SQL test).
5. A plain Video task with no edit tasks moving past Shoot behaves exactly as today — no jump to Delivered (Task 1 SQL test).

---

### Task 1: Database link + handoff trigger

**Files:**
- Create: `supabase/migrations/0025_shoot_edit_handoff.sql`
- Modify: `lib/types.ts:155-174` (add `follows_task_id: string | null;` to `Task`)
- Modify: `mobile/lib/queries/task.ts:8-27` (add `follows_task_id: string | null;` to `TaskDetail`)

**Interfaces:**
- Produces: column `tasks.follows_task_id UUID NULL REFERENCES tasks(id) ON DELETE SET NULL` + index; function `handoff_shoot_to_edit()` (SECURITY DEFINER, `search_path = public`), trigger `on_shoot_handoff` BEFORE UPDATE OF current_stage_id ON tasks.

- [ ] **Step 1: Write the migration.** Trigger logic: only when `current_stage_id` changes AND some task has `follows_task_id = NEW.id`. Look up the department's Shoot stage position; if `old_position <= shoot_position AND new_position > shoot_position`, set `NEW.current_stage_id` to the department's lowest-position `is_terminal` stage and `PERFORM notify_user(e.assigned_to, 'shoot_done', 'task', e.id, …)` for each following edit task. No Shoot stage in the department → do nothing.
- [ ] **Step 2: Apply** with the Supabase MCP `apply_migration` (project `hlymjkqauershgkadtwk`, name `0025_shoot_edit_handoff`). Ask the user first — it is the live DB.
- [ ] **Step 3: Test in a rolled-back transaction** via `execute_sql`. Inside `BEGIN … ROLLBACK`: `set_config('request.jwt.claims', '{"sub":"<an exec profile id>"}', true)`; insert a Video shoot task in Pre-production and an edit task (different assignee) following it; then assert:
  - move shoot Pre-production → Shoot: stage stays Shoot, 0 `shoot_done` notifications;
  - move Shoot → Post-production: stage becomes Delivered, exactly 1 `shoot_done` notification for the editor;
  - a second shoot task moved Pre-production → Post-production directly: becomes Delivered;
  - a Video task with no edit task moved Shoot → Post-production: stays Post-production.
  Expected: all four hold; `ROLLBACK` leaves no rows.
- [ ] **Step 4: Add the type fields**, run both type checks. Expected: exit 0.
- [ ] **Step 5: Commit** `feat(db): link edit tasks to shoot tasks with automatic handoff`.

### Task 2: Shared creation logic

**Files:**
- Create: `lib/shoot-edit.ts`
- Modify: `mobile/package.json` jest block: add `"moduleNameMapper": { "^@shared/(.*)$": "<rootDir>/../lib/$1" }`
- Test: `mobile/lib/queries/__tests__/shoot-edit.test.ts` (`git add -f`, `mobile/` is gitignored)

**Interfaces:**
- Consumes: `follows_task_id` (Task 1), `TaskPriority` from `lib/types.ts`.
- Produces:
  ```ts
  type Db = { from(table: string): any }; // both supabase-js versions satisfy it
  export type StageLite = { id: string; name: string; position: number; is_terminal: boolean };
  export type EditBlock = { editorId: string; editorName: string; startDate: string; dueDate: string; videos: string[] };
  export type ShootWithEditsInput = {
    projectId: string; departmentId: string; stages: StageLite[];
    title: string; description: string; priority: TaskPriority;
    shootDate: string; shooterId: string | null; creativeIds: string[];
    edits: EditBlock[]; userId: string;
  };
  export function editStageAfterShoot(stages: StageLite[]): StageLite | null;
  export function editTaskTitle(title: string, editorName: string): string;
  export function shootEditErrors(input: ShootWithEditsInput): string | null; // first problem, or null
  export async function createShootWithEdits(db: Db, input: ShootWithEditsInput): Promise<{ shootId: string; editIds: string[] }>;
  ```

- [ ] **Step 1: Write failing tests** (hand-rolled `db` recorder like `mutations.test.ts`, passed in directly — no `jest.mock`):
  - `editStageAfterShoot` returns Post-production for Video stages, `null` for Creatives stages (no Shoot).
  - `editTaskTitle("Brand Film", "Ali Hassan") === "Brand Film — Edit (Ali)"`.
  - `shootEditErrors`: `"Pick a shoot date"`; `"Add at least one edit block"`; per block `"Pick an editor"`, `"Add edit start and due dates"`, `"Edit due date is before its start date"`, `"Add at least one video for Ali"`; `"Ali is in two edit blocks"`; `null` for a valid input.
  - `createShootWithEdits` with 2 blocks: inserts shoot task (first stage, start = due = shootDate, assigned to shooter), then 2 edit tasks (edit stage, `follows_task_id` = shoot id, titles via `editTaskTitle`), each block's videos as `task_deliverables` at the edit stage, creatives on all 3 tasks.
  - Conflict: when the `tasks` overlap query returns a row for an editor, it throws `"Ali is already booked then: <task title>"` and performs zero inserts.
  - Rollback: when the second edit-task insert fails, it deletes `id in [shoot, edit1]` and rethrows.
- [ ] **Step 2: Run** `node node_modules/jest/bin/jest.js shoot-edit` in `mobile/`. Expected: FAIL (module not found).
- [ ] **Step 3: Implement `lib/shoot-edit.ts`.** `createShootWithEdits` order: `shootEditErrors` (throw) → overlap check for shooter + every editor using the same window rule as `NewTaskDialog` (`assigned_to = X`, `start_date <= due`, `due_date >= start`) → inserts → on any error delete created ids with `.delete().in('id', ids)`. No React, no supabase import.
- [ ] **Step 4: Run** the test, then the full suite. Expected: all PASS.
- [ ] **Step 5: Commit** `feat: shared shoot + edit task creation`.

### Task 3: Web — "Plan the edit" in New Task

**Files:**
- Modify: `app/(admin)/admin/projects/[projectId]/tasks/NewTaskDialog.tsx`

**Interfaces:**
- Consumes: `editStageAfterShoot`, `shootEditErrors`, `createShootWithEdits`, `EditBlock` from `@/lib/shoot-edit`.

- [ ] **Step 1:** Show a "Plan the edit" switch only when `editStageAfterShoot(deptStages)` is non-null. When on: hide Due date and the task-level Deliverables field, relabel Start date as "Shoot date *", label Assign to as "Shooter"; render edit blocks (editor select from `deptEmployees`, start/due dates, video chips with add/remove — same chip UI as today), "+ Add editor" adds a block, × removes one (min 1). Block state starts as one empty block.
- [ ] **Step 2:** On submit when on: show `shootEditErrors(...)` inline if any, else `await createShootWithEdits(supabase, …)`; on error show the message; on success close and `router.refresh()`. Toggle off → existing path unchanged.
- [ ] **Step 3: Verify in the browser** (preview `lead-crm-dev`, a Video project's Tasks page): open Add Task → pick Video → switch appears; pick Creatives → it doesn't; with it on, add a second editor block and remove it; leave a block empty and submit → inline error. **Do not create tasks** unless the user agrees. No console errors.
- [ ] **Step 4:** Web type check exit 0. Commit `feat(web): plan the edit when booking a shoot`.

### Task 4: Mobile — "Plan the edit" in New Task

**Files:**
- Modify: `mobile/app/(employee)/projects/[projectId]/tasks/new.tsx`

**Interfaces:**
- Consumes: same as Task 3 via `@shared/shoot-edit`; `pickers.data.stages`, `pickers.data.employees`.

- [ ] **Step 1:** Same behaviour as Task 3 with existing components: a Pressable toggle row, one `GlassCard` per block (editor via `PickerSheet`, dates via `Input` `YYYY-MM-DD`, video chips like the current deliverables field), "+ Add editor".
- [ ] **Step 2:** When on, submit runs a `useMutation` around `createShootWithEdits(supabase, …)` with the same `onSuccess` invalidations as today; errors via `Alert.alert('Could not create tasks', e.message)`.
- [ ] **Step 3:** Mobile type check exit 0; full jest suite PASS. Commit `feat(mobile): plan the edit when booking a shoot`.

### Task 5: Linked-task links on cards and task screen

**Files:**
- Modify: `components/tasks/TaskCards.tsx` (title area ~line 268)
- Modify: `mobile/lib/queries/task.ts` (add `useLinkedTasks`)
- Modify: `mobile/app/(employee)/projects/[projectId]/tasks/[taskId].tsx`

**Interfaces:**
- Produces: `useLinkedTasks(task: { id: string; follows_task_id: string | null }): UseQueryResult<{ shoot: { id: string; title: string } | null; edits: { id: string; title: string }[] }>` — two plain queries (`.eq('id', follows_task_id)`, `.eq('follows_task_id', id)`), key `[...qk.task(id), 'linked']`.

- [ ] **Step 1 (web):** give each card `id={`task-${task.id}`}`; shoot cards with followers in `tasks` show "Edits: Ali, Sara" (each an `<a href="#task-<id>">`, editor first name); edit cards show "← Shoot task" linking to the shoot card.
- [ ] **Step 2 (mobile):** on the task screen, under the header, a "Shoot task" row or "Edit tasks" rows that `router.push` to `/projects/[projectId]/tasks/[taskId]`.
- [ ] **Step 3:** Both type checks exit 0, jest PASS; browser check that existing task cards still render. Commit `feat: link shoot and edit tasks`.

### Task 6: Ship

- [ ] **Step 1:** Ask the user whether to do one real end-to-end run (create a shoot with two edits on a test project, move it past Shoot, check notifications, then delete the tasks).
- [ ] **Step 2:** With their OK: `git push origin feat/mobile-app`, then the EAS Update command from Global Constraints; confirm the bundle contains `hlymjkqauershgkadtwk`.

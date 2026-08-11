# Task Deliverables & Stage-Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Kanban drag-and-drop with a stage-grouped task list (forward/back/mark-done buttons) and add per-deliverable, per-stage assignee tracking.

**Architecture:** One Supabase migration adds `task_deliverables` (items per task) and `task_deliverable_assignments` (one row per deliverable × stage — the current stage's row is the live assignee; older rows are the permanent per-phase record). The web Tasks page swaps `StageBoard` (drag-drop) for a new `StageList` (rows grouped under stage headings, explicit move buttons). A new `AssignDeliverablesDialog` handles per-item and all-to-one assignment, auto-opening after forward moves.

**Tech Stack:** Next.js 16 App Router, Supabase (Postgres + RLS, `@supabase/ssr` browser client), Tailwind, shadcn/ui primitives in `components/ui/`, lucide-react icons.

**Spec:** `docs/superpowers/specs/2026-08-12-task-deliverables-stage-flow-design.md`

## Global Constraints

- Node 26 breaks `.bin` shims — typecheck with `node node_modules/typescript/bin/tsc --noEmit`, build with `node node_modules/next/dist/bin/next build`.
- This Next.js version has breaking changes — check `node_modules/next/dist/docs/` before using unfamiliar APIs.
- No unit-test framework exists in the web app; the verification gates are typecheck, production build, and browser preview.
- iOS app (`feat/mobile-app` branch) and calendar screens are out of scope. The existing file-submission `deliverables` table is untouched.
- All security lives in Postgres RLS, not the frontend.
- Migration is applied to the live Supabase project via the Supabase MCP `apply_migration` tool (same SQL as the committed file).

---

### Task 1: Migration 0021 + TypeScript types

**Files:**
- Create: `supabase/migrations/0021_task_deliverables.sql`
- Modify: `lib/types.ts` (add two interfaces; extend `Task`)

**Interfaces:**
- Produces: tables `task_deliverables`, `task_deliverable_assignments`; TS types `TaskDeliverable`, `TaskDeliverableAssignment`; `Task.task_deliverables?: TaskDeliverable[]`.

- [ ] **Step 1: Write the migration** — RLS mirrors `task_creatives` in `0012_project_task_creatives.sql` (any employee who can see the project):

```sql
-- =============================================================
-- 0021: Task deliverables with per-stage assignment
-- =============================================================

CREATE TABLE task_deliverables (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id    UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  title      TEXT NOT NULL,
  position   INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE task_deliverables ENABLE ROW LEVEL SECURITY;

CREATE POLICY "task_deliverables_select" ON task_deliverables FOR SELECT TO authenticated
  USING (
    current_user_type() = 'employee'
    AND EXISTS (SELECT 1 FROM tasks t WHERE t.id = task_id AND can_see_project(t.project_id))
  );

CREATE POLICY "task_deliverables_manage" ON task_deliverables FOR ALL TO authenticated
  USING (
    current_user_type() = 'employee'
    AND EXISTS (SELECT 1 FROM tasks t WHERE t.id = task_id AND can_see_project(t.project_id))
  )
  WITH CHECK (
    current_user_type() = 'employee'
    AND EXISTS (SELECT 1 FROM tasks t WHERE t.id = task_id AND can_see_project(t.project_id))
  );

-- One row per (deliverable, stage): the task's current stage row is the live
-- assignment; earlier-stage rows are the permanent per-phase record.
CREATE TABLE task_deliverable_assignments (
  deliverable_id UUID NOT NULL REFERENCES task_deliverables(id) ON DELETE CASCADE,
  stage_id       UUID NOT NULL REFERENCES department_stages(id) ON DELETE CASCADE,
  assigned_to    UUID NOT NULL REFERENCES employees(profile_id) ON DELETE CASCADE,
  assigned_by    UUID REFERENCES profiles(id),
  assigned_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (deliverable_id, stage_id)
);

ALTER TABLE task_deliverable_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "task_deliverable_assignments_select" ON task_deliverable_assignments FOR SELECT TO authenticated
  USING (
    current_user_type() = 'employee'
    AND EXISTS (
      SELECT 1 FROM task_deliverables td JOIN tasks t ON t.id = td.task_id
      WHERE td.id = deliverable_id AND can_see_project(t.project_id)
    )
  );

CREATE POLICY "task_deliverable_assignments_manage" ON task_deliverable_assignments FOR ALL TO authenticated
  USING (
    current_user_type() = 'employee'
    AND EXISTS (
      SELECT 1 FROM task_deliverables td JOIN tasks t ON t.id = td.task_id
      WHERE td.id = deliverable_id AND can_see_project(t.project_id)
    )
  )
  WITH CHECK (
    current_user_type() = 'employee'
    AND EXISTS (
      SELECT 1 FROM task_deliverables td JOIN tasks t ON t.id = td.task_id
      WHERE td.id = deliverable_id AND can_see_project(t.project_id)
    )
  );
```

- [ ] **Step 2: Apply to the live project** — Supabase MCP: `list_projects` to get the project id, then `apply_migration` with name `task_deliverables` and the SQL above. Verify with `list_tables` that both tables exist.

- [ ] **Step 3: Add types** — in `lib/types.ts`, next to `TaskCreative` (~line 127):

```ts
export interface TaskDeliverableAssignment {
  deliverable_id: string;
  stage_id: string;
  assigned_to: string;
  assigned_by: string | null;
  assigned_at: string;
  employees?: { profiles?: { full_name: string } | null } | null;
}

export interface TaskDeliverable {
  id: string;
  task_id: string;
  title: string;
  position: number;
  created_at: string;
  task_deliverable_assignments?: TaskDeliverableAssignment[];
}
```

and add to `Task`: `task_deliverables?: TaskDeliverable[];`

- [ ] **Step 4: Typecheck** — `node node_modules/typescript/bin/tsc --noEmit` → 0 errors.

- [ ] **Step 5: Commit** — `git add supabase/migrations/0021_task_deliverables.sql lib/types.ts && git commit -m "feat(db): task deliverables with per-stage assignments"`

---

### Task 2: AssignDeliverablesDialog

**Files:**
- Create: `components/tasks/AssignDeliverablesDialog.tsx` (new folder; kanban→tasks rename completes in Task 3)

**Interfaces:**
- Consumes: `Task`, `TaskDeliverable`, `DepartmentStage` types from Task 1; `createClient` from `@/lib/supabase/browser`; ui primitives.
- Produces: `export default function AssignDeliverablesDialog(props: { task: Task; stage: DepartmentStage; stages: DepartmentStage[]; employees: { profile_id: string; profiles?: { full_name: string } | null }[]; open: boolean; onClose: () => void; onSaved: (deliverables: TaskDeliverable[]) => void })`

- [ ] **Step 1: Build the dialog.** Behavior contract:
  - Header: task title + stage name ("Assign deliverables — Shoot").
  - Top row: **"Assign all to…"** `Select`; choosing a person sets every deliverable's draft assignee in local state (one click, still saved by the Save button).
  - One row per deliverable (sorted by `position`): title, assignee `Select` (options: Unassigned sentinel `"_none"` + employees), and, when earlier-stage assignment rows exist, muted inline context like `Shoot: Sarah` (stage name + first name for each stage before the current one, in `stages` position order).
  - Draft state seeded from each deliverable's assignment row matching `stage.id`.
  - Save: for rows with an assignee → `supabase.from("task_deliverable_assignments").upsert(rows, { onConflict: "deliverable_id,stage_id" })` where each row is `{ deliverable_id, stage_id: stage.id, assigned_to, assigned_by: user.id }`; for rows cleared to Unassigned that previously had a row → `.delete().eq("stage_id", stage.id).in("deliverable_id", ids)`. On error: show message, keep dialog open.
  - On success: call `onSaved` with the deliverables array patched to the new assignment rows (synthesize `employees.profiles.full_name` from the `employees` prop, same pattern as `EditTaskDialog`'s creative sync), then `onClose()`.

Core save logic:

```tsx
const { data: { user } } = await supabase.auth.getUser();
const toUpsert = deliverables
  .filter((d) => draft[d.id] && draft[d.id] !== "_none")
  .map((d) => ({ deliverable_id: d.id, stage_id: stage.id, assigned_to: draft[d.id], assigned_by: user?.id ?? null }));
const toClear = deliverables
  .filter((d) => (!draft[d.id] || draft[d.id] === "_none")
    && d.task_deliverable_assignments?.some((a) => a.stage_id === stage.id))
  .map((d) => d.id);
```

- [ ] **Step 2: Typecheck** — `node node_modules/typescript/bin/tsc --noEmit` → 0 errors.
- [ ] **Step 3: Commit** — `git add components/tasks/ && git commit -m "feat: assign-deliverables dialog with per-item and all-to-one assignment"`

---

### Task 3: StageList replaces StageBoard (Kanban removal)

**Files:**
- Create: `components/tasks/StageList.tsx`
- Move: `components/kanban/EditTaskDialog.tsx` → `components/tasks/EditTaskDialog.tsx` (git mv; update its import in StageList)
- Delete: `components/kanban/StageBoard.tsx` (and now-empty `components/kanban/`)
- Modify: `app/(admin)/admin/projects/[projectId]/tasks/page.tsx` (query + render), `package.json` (drop `@hello-pangea/dnd`), `app/(admin)/admin/settings/departments/page.tsx:25` (copy)

**Interfaces:**
- Consumes: `AssignDeliverablesDialog` from Task 2; `EditTaskDialog` (unchanged props).
- Produces: `export default function StageList(props: { stages: DepartmentStage[]; tasks: Task[]; employees: Employee[]; creatives?: { profile_id: string; full_name: string }[]; deptName: string })` — same call-site shape StageBoard had minus `deptSlug`/`onTaskMoved`.

- [ ] **Step 1: Extend the page query** — in `tasks/page.tsx`, the tasks select gains the deliverables join:

```ts
.select("*, department_stages(*), departments(name), employees!assigned_to(profiles(full_name)), task_creatives(profile_id, employees!task_creatives_profile_id_fkey(profiles(full_name))), task_deliverables(id, task_id, title, position, created_at, task_deliverable_assignments(deliverable_id, stage_id, assigned_to, assigned_by, assigned_at, employees!task_deliverable_assignments_assigned_to_fkey(profiles(full_name))))")
```

Replace the `<StageBoard …>` render with `<StageList stages={…} tasks={…} employees={…} creatives={…} deptName={dept.name} />` and swap the import.

- [ ] **Step 2: Build StageList.** Behavior contract (reuse StageBoard's local-state pattern: `localTasks` + `prevTasks` resync, `handleSaved`, `handleDeleted`, `isTaskOverdue`, `PRIORITY_STYLES`, dept header with color dot and task count):
  - Group `localTasks` by `current_stage_id`; render one section per stage in `position` order: heading = stage name in `stage.color` with count badge (terminal stage gets the `CheckCircle2` icon), then task rows; empty stages show a muted "—" line.
  - Task row: title (click → `setEditingTask`), priority badge, due date + overdue treatment, assignee first-name, creatives names (all identical to StageBoard's card metadata), plus one line per deliverable: `Video 1 · Sarah` (current-stage assignee first name, or `· unassigned` muted).
  - Controls per row: `← ` back `Button` (variant ghost, hidden on first stage) and a primary **Next stage →** button, which on the last non-terminal stage reads **Mark done ✓**. Terminal-stage rows show neither forward button nor back? — back stays (spec: "move back as well"), forward disappears.
  - `moveTask(task, dir: 1 | -1)`: find current index in `stages`, target = `stages[idx + dir]`; if none, return. Optimistic `setLocalTasks`, then `supabase.from("tasks").update({ current_stage_id: target.id }).eq("id", task.id)`; revert on error. On success with `dir === 1` and `(task.task_deliverables?.length ?? 0) > 0`: `setAssigning({ task: movedTask, stage: target })` to auto-open `AssignDeliverablesDialog`.
  - `AssignDeliverablesDialog.onSaved(deliverables)` → patch that task in `localTasks`.
  - Render `EditTaskDialog` exactly as StageBoard did.

- [ ] **Step 3: Delete the board** — `git rm components/kanban/StageBoard.tsx`, `git mv components/kanban/EditTaskDialog.tsx components/tasks/EditTaskDialog.tsx`, remove `"@hello-pangea/dnd"` from `package.json` deps and run `npm install` to sync the lockfile. Update the settings copy at `app/(admin)/admin/settings/departments/page.tsx:25`: "These define the Kanban columns." → "These define the workflow stages."

- [ ] **Step 4: Typecheck + build** — `node node_modules/typescript/bin/tsc --noEmit` then `node node_modules/next/dist/bin/next build` → both clean. `grep -rin "kanban\|pangea" app components lib` → zero hits.

- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat: replace Kanban board with stage-grouped list and move buttons"`

---

### Task 4: Deliverables in NewTaskDialog

**Files:**
- Modify: `app/(admin)/admin/projects/[projectId]/tasks/NewTaskDialog.tsx`

**Interfaces:**
- Consumes: `task_deliverables` table from Task 1. No prop changes.

- [ ] **Step 1: Add the section.** State `const [deliverables, setDeliverables] = useState<string[]>([])` + `const [deliverableInput, setDeliverableInput] = useState("")`. UI between Creatives and the date fields: `Label "Deliverables"`, an `Input` (placeholder "Video 1") + `Button type="button"` with `Plus` icon that appends the trimmed input (Enter key too — `onKeyDown` intercepting Enter to add instead of submitting); added items render as removable chips (title + × button). In `handleSubmit`, after the task insert (and alongside the creatives insert):

```ts
if (deliverables.length > 0) {
  await supabase.from("task_deliverables").insert(
    deliverables.map((title, i) => ({ task_id: task.id, title, position: i }))
  );
}
```

- [ ] **Step 2: Typecheck** — `node node_modules/typescript/bin/tsc --noEmit` → 0 errors.
- [ ] **Step 3: Commit** — `git add app && git commit -m "feat: add deliverables to new-task dialog"`

---

### Task 5: Deliverables in EditTaskDialog

**Files:**
- Modify: `components/tasks/EditTaskDialog.tsx`

**Interfaces:**
- Consumes: `AssignDeliverablesDialog` from Task 2; `task.task_deliverables` from Task 1's `Task` extension.
- Produces: `onSaved` patch now includes `task_deliverables` so StageList rows refresh.

- [ ] **Step 1: Add the section.** Local state seeded from `task.task_deliverables` (sorted by position): `{ id: string | null; title: string }[]` (null id = newly added). UI below Creatives: one `Input` per item with a `Trash2` remove button, plus an "Add deliverable" ghost button appending an empty row, plus — when the task has deliverables — an "Assign for current stage…" outline button that opens `AssignDeliverablesDialog` (stage = `stages.find(s => s.id === form.current_stage_id)`). In `handleSave`, after the creatives sync, diff against the original items:
  - new rows (`id === null`, non-empty title) → insert with `position` = final index;
  - renamed rows → `update({ title, position })` per changed row;
  - removed ids → `.delete().in("id", removedIds)`;
  - include the resulting `task_deliverables` array in the `onSaved` patch (keep existing assignment rows for surviving items).
  Blank-titled rows are dropped, not saved.

- [ ] **Step 2: Typecheck** — `node node_modules/typescript/bin/tsc --noEmit` → 0 errors.
- [ ] **Step 3: Commit** — `git add components && git commit -m "feat: manage deliverables from edit-task dialog"`

---

### Task 6: End-to-end verification in the browser

**Files:** none (verification only)

- [ ] **Step 1: Build** — `node node_modules/next/dist/bin/next build` → clean.
- [ ] **Step 2: Browser walkthrough** — start the dev server via the preview tools, log in, open a project's Tasks page, then verify the spec's manual script: create a task with deliverables Video 1/2/3 → rows render under the first stage heading with "unassigned" items → **Next stage →** moves it and auto-opens the assign dialog → "Assign all to…" one person → save → names show on the row → advance again → assign items individually, prior-phase names visible in the dialog → **← Back** returns a stage → advance to the end → **Mark done ✓** lands it under the terminal heading → console/network clean.
- [ ] **Step 3: Final commit** of anything the walkthrough shook out; report results with a screenshot.

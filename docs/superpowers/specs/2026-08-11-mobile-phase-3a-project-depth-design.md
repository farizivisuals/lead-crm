# Lead CRM Mobile — Phase 3a: Project Depth — Design

> Phase 3 of the mobile port (`docs/superpowers/specs/2026-08-10-mobile-app-design.md` §14)
> is ~2,960 lines of web source across 10 screen families, 3 redesigns and 3 new
> dependencies. It is split into three sub-projects, each with its own spec, plan
> and implementation cycle:
>
> - **3a — Project depth** (this document): deliverables CRUD, project activity
> - **3b — Clients & quotes**: clients list, read-only client detail, quote builder, PDF export
> - **3c — Agency surfaces**: calendar, search, team, stage settings, profile, notifications

**Goal:** an employee can see and manage a project's deliverables from the phone,
and read what has actually happened on the project. This removes the last two
`· Soon` placeholders from the project detail screen Phase 2 shipped.

**Ports:** `app/(admin)/admin/projects/[projectId]/deliverables/*` and
`app/(admin)/admin/projects/[projectId]/activity/page.tsx`.

**Depends on:** Phase 2, complete at `40d3e79`. Every convention below is Phase
2's, unchanged.

---

## 1. What the source actually does

Four findings came out of reading the web app. They shape the whole sub-project,
so they are recorded here rather than left to be rediscovered.

### 1.1 The "Send to client for review" button is dead

`deliverables/page.tsx:162` posts a form to
`/api/deliverables/${deliverableId}/send-to-client`. **That route does not
exist** — `app/api/auth/signout/route.ts` is the only API route in the repo. The
button has always returned a 404.

Its intended effect is already reachable two other ways in the same screen: the
edit dialog's status picker offers `client_review` directly, and its version-bump
affordance sets `version + 1` and `status: 'client_review'` in one tap.

**Decision: mobile does not port the button.** Nothing that works today is lost.

### 1.2 Comments are read-only everywhere

The activity page and the client portal both read the `comments` table. Nothing
in the repo writes to it. The Comments card is a section that cannot ever
populate.

**Decision: mobile does not port the Comments card.** A compose box would be
net-new product — an RLS insert path, a notification decision, and the
`is_client_visible` toggle — and belongs in its own cycle.

### 1.3 The activity query is missing an `!inner`

`activity/page.tsx:24` filters stage history with `.eq("tasks.project_id",
projectId)` and no `!inner` hint. In PostgREST a filter on an embedded resource
without `!inner` does not restrict the parent rows — it nulls the embed where it
does not match. The page therefore lists the last 50 stage changes across **every
project the viewer can see**, and foreign rows render as "*someone* moved
**undefined**".

This is the exact trap `.superpowers/sdd/phase-2-porting-brief.md` documents and
that Phase 2 used `!inner` to avoid throughout.

**Decision (user ruling): fix it in both clients.** Mobile uses
`tasks!inner(title)`; the same one-word fix lands on the web page in this cycle
so the two clients agree.

### 1.4 `activity_log` has no writer

No migration contains `INSERT INTO activity_log`, and the only reference in app
code is `dashboard/page.tsx:65` reading it. The table is permanently empty. This
is why the executive dashboard's Activity panel showed "No activity yet" against
live data during Phase 2's on-device verification — not RLS scoping, not a quiet
week.

`task_stage_history` is the opposite: `log_task_stage_change()` (migration 0009)
writes it on every real stage change, guarded by `IS DISTINCT FROM`.

**Decision (user ruling): repoint the dashboard Activity panel at
`task_stage_history`** — the same query as the project screen without the project
filter. A dead panel becomes live for the cost of a query swap, on both clients.
Populating `activity_log` properly is net-new backend product and is out of scope.

---

## 2. Scope

**In:** deliverables list, create, edit (including version bump), open in
Dropbox; project activity list; wiring the two project-detail tiles; repointing
the dashboard activity feed; the web `!inner` fix.

**Out:** the dead send-to-client button; the Comments card; deliverable delete
(RLS allows root/exec/manager but no client has ever offered a UI); rendering
`thumbnail_url` as an image; anything touching `activity_log`'s emptiness beyond
the repoint.

**New dependencies: none.**

**New migrations: none.** No schema change, no dashboard configuration.

---

## 3. Screens

### 3.1 Deliverables — `(employee)/projects/[projectId]/deliverables/index.tsx`

A list, newest first. Each row shows: the type label
(`DELIVERABLE_TYPE_LABELS`), `v{version}`, the title, "By {full_name} ·
{submitted_at}", a status badge (`DELIVERABLE_STATUS_LABELS`), and an "Open in
Dropbox" action. When the deliverable has revisions, the most recent one renders
as a nested block: `✓ Approved` or `↩ Revision requested`, the note if present,
and "by {actor} · {created_at}".

Header carries a "New" action. Each row carries an "Edit" action, gated
cosmetically (§5).

Empty state: "No deliverables yet" / "Add a Dropbox link to submit your first
deliverable".

**Create** collects title, type (`photo | video | pr`), status, dropbox_url,
thumbnail_url (optional), and an optional task from this project's tasks. Both
forms offer the full `deliverable_status` enum — `draft`, `internal_review`,
`client_review`, `approved`, `revision_requested` — as the web does.

**Edit** collects title, dropbox_url, thumbnail_url, status, and offers a version
bump. The bump is a single control reading `v{n} → v{n+1}` that raises `version`
and sets `status: 'client_review'`; the submit label then reads `Save as v{n+1}`.
It is one write, not two.

### 3.2 Activity — `(employee)/projects/[projectId]/activity.tsx`

One list, newest first, capped at 50: "**{mover}** moved **{task title}** from
{from stage} → {to stage}", with a relative timestamp beneath. `from_stage_id` is
nullable — the first move into a stage has none — and that case renders without
the "from" clause.

Empty state: "No stage changes yet".

### 3.3 Project detail

The `Deliverables · Soon` and `Activity · Soon` tiles lose their affix and become
tappable. The deliverables tile keeps the real count it already shows.

---

## 4. Data layer

Phase 2's conventions, unchanged: hooks in `mobile/lib/queries/<domain>.ts`
calling `supabase.from()` directly, no repository layer, keys only from `qk`,
embedded to-one relations funnelled through `one()`, `queryFn` throws and the
screen renders `error.message` in a muted row, mutations surface failures with
`Alert.alert`.

### 4.1 Query keys

Two new entries, both **nested under `qk.project(projectId)`** so the existing
project invalidation cascades without new call sites — the same shape the Phase 2
final review applied to `qk.taskPickers`:

```
projectDeliverables: (projectId) => ['project', projectId, 'deliverables']
projectActivity:     (projectId) => ['project', projectId, 'activity']
```

The dashboard's activity feed needs no new key: it is part of the composite
`useExecutiveDashboard` query already keyed by `qk.dashboardExec(deptId)`.

### 4.2 Selects

Verbatim from the web except where §1.3 rules otherwise.

**Deliverables** (`mobile/lib/queries/deliverables.ts`):

```
.from('deliverables')
.select('*, profiles:submitted_by(full_name), deliverable_revisions(action, note, created_at, profiles:actor_profile_id(full_name))')
.eq('project_id', projectId)
.order('created_at', { ascending: false })
```

Tasks for the create form's optional task picker:

```
.from('tasks').select('id, title').eq('project_id', projectId)
```

**Project activity** (`mobile/lib/queries/activity.ts`) — note the added
`!inner`:

```
.from('task_stage_history')
.select('*, tasks!inner(title), from_stage:from_stage_id(name), to_stage:to_stage_id(name), profiles:moved_by(full_name)')
.eq('tasks.project_id', projectId)
.order('moved_at', { ascending: false })
.limit(50)
```

**Dashboard feed** — the same select with no project filter and `.limit(8)`.
RLS (`task_history_select`, migration 0008) is employee-only and scoped by
`can_see_project`, so this is correctly narrowed without an app-level filter.

### 4.3 Mutations

`createDeliverable` inserts `project_id`, `task_id` (null when unset), `type`,
`title`, `dropbox_url`, `thumbnail_url` (null when empty), `status`, and
`submitted_by` = the signed-in user id.

`updateDeliverable` updates `title`, `dropbox_url`, `thumbnail_url` (null when
empty), `status`, `version`.

Both invalidate `qk.project(projectId)` — which cascades to the deliverables
key — plus `qk.projects()` and `qk.dashboards()`, matching what Phase 2's final
review established for every mutation that changes a project. `qk.dashboards()`
is not over-invalidation here: the plain-employee dashboard's "Approval Status"
panel reads `deliverables` filtered to `submitted_by = auth.uid()`, so creating
or editing one does change it.

Both carry the double-submit guard the phase settled on: the submit gate leads
with `!mutation.isPending`, and `Button`'s `loading` prop reaches
`Pressable disabled`. This is the pattern that cost Phase 2 three separate fix
rounds; it is not optional.

---

## 5. Role gating

RLS is the boundary; the UI gate is cosmetic, as everywhere else in this app.

- **Create:** any employee who can see the project (`deliverables_insert`). The
  web renders its New dialog unconditionally; mobile matches.
- **Edit:** RLS (`deliverables_update`) permits any employee who can see the
  project. The web nonetheless shows Edit only to
  `isExecutive(role) || isCreativeEmployee(employee)`. Mobile mirrors that
  cosmetic gate, using the shared helpers — `isExecutive` from `@shared/rbac`,
  `isCreativeEmployee` from `mobile/lib/data.ts`.
- **Delete:** no UI on either client.
- **Activity:** no gate. `task_history_select` is employee-only and
  project-scoped, so the screen is empty rather than forbidden for anyone who
  should not see it.

---

## 6. Decisions taken without asking

- **`thumbnail_url` stays a form field and renders no image.** The web stores it
  and never displays it. Rendering it would be net-new design plus `expo-image`
  (installed but unused). Revisit in Phase 6 polish if it earns its place.
- **The Dropbox link opens via React Native's `Linking.openURL`** — no
  dependency, and it hands off to the Dropbox app when installed.
  `expo-web-browser` would keep the user in-app but buys nothing here.
- **The version bump stays a single control**, not a separate "send to client"
  action. Two paths to the same write is what the double-submit guards exist to
  prevent.
- **The latest revision is picked by `created_at`, not by array position.** The
  web takes `revisions[0]` from a select that never orders
  `deliverable_revisions`, so which revision it shows is whatever PostgREST
  happens to return. This is a deliberate, behaviour-preserving-in-intent
  divergence: it shows the revision the web *means* to show.

---

## 7. Error handling

Every consumed query renders `error.message` in a muted row. Phase 2 shipped
three separate screens that swallowed a *secondary* query's error and each needed
a fix round — the deliverables screen has two queries (deliverables, tasks) and
the dashboard's composite has seven after the repoint, so this is a checklist
item, not a hope.

Mutations surface failures with `Alert.alert`. No optimistic state on either
screen: neither has an interaction where the round-trip is felt, so there is
nothing to roll back.

---

## 8. Testing

Minimal and pure, per the plan-wide directive. No render tests for screens.

Two pieces of non-trivial derivation, each getting one assertion-level check in
the query module's test file:

1. **Latest-revision derivation** — which revision of several wins, and its
   action label. The web takes `revisions[0]` and relies on an ordering the
   select does not specify; the mobile helper picks by `created_at` explicitly.
2. **Stage-change sentence assembly** — must handle a null `from_stage`, which
   is the real shape of the first move into any stage.

Everything else on these screens is presentational or already covered:
`one()`, `shortDate`, `relativeTime` and `firstName` all have tests from Phase 1.

---

## 9. Changes outside `mobile/`

Four files, all small:

1. `app/(admin)/admin/projects/[projectId]/activity/page.tsx` — add `!inner`
   (§1.3).
2. `app/(admin)/admin/dashboard/page.tsx` — repoint the Activity panel from
   `activity_log` to `task_stage_history` (§1.4).
3. `mobile/lib/queries/dashboard.ts` — the same repoint on mobile.
4. `mobile/components/dashboard/ExecutiveDashboard.tsx` — the row now renders a
   stage-change sentence rather than an `action` string.

No phase before this one has touched web code. It is done here because the
alternative is two clients that disagree about what a project's activity is.

---

## 10. Acceptance

- `npx tsc --noEmit` clean inside `mobile/`; `npm test` passes with the two new
  checks.
- No new dependency in `mobile/package.json`; no new migration.
- `grep -ri "service_role\|createAdminClient" mobile/ --exclude-dir=node_modules`
  returns nothing.
- An employee can open a project → Deliverables, see the list with revision
  feedback, add one, edit one, bump a version, and open a Dropbox link in the
  Dropbox app.
- A plain employee who is not a creative sees no Edit action; an executive does.
- A project's Activity lists **only that project's** stage changes, and a first
  move into a stage renders without a "from" clause.
- The executive dashboard's Activity panel shows real recent stage changes rather
  than "No activity yet".
- The project detail screen has no `· Soon` affix left on either tile.

## 11. Carried forward

- `activity_log` remains unwritten. The repoint hides the symptom; the table is
  still dead. Either populate it or drop it — a decision for whoever owns the
  backend, not this cycle.
- Phase 2's write paths (`createProject` and its rollback, `createTask`,
  `moveTaskStage`, `saveTask`, `deleteTask`, the availability hard block) are
  still reasoned-but-never-executed, blocked by the harness classifier on
  simulator form input. 3a adds two more unexercised write paths
  (`createDeliverable`, `updateDeliverable`) unless that is resolved first.

# Lead CRM Mobile — Phase 3a: Project Depth — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** An employee can manage a project's deliverables from the phone and read what has actually happened on the project, removing the last two `· Soon` placeholders from project detail.

**Architecture:** Two new Expo Router screens under `mobile/app/(employee)/projects/[projectId]/`, backed by two new TanStack Query modules in `mobile/lib/queries/`. Every read is a hook calling `supabase.from(...)` directly; every write is a plain async function invoked from `useMutation` followed by `queryClient.invalidateQueries`. Two query-key entries nest under `qk.project(projectId)` so existing project invalidation cascades for free. One shared select string and one shared row-flattening helper are reused by both the project activity screen and the dashboard feed, so the two never drift.

**Tech Stack:** Expo SDK 56 · Expo Router · `@supabase/supabase-js` · TanStack Query · React Native `FlatList` / `Modal` / `Alert` / `Linking` · Jest (`jest-expo`)

**Spec:** `docs/superpowers/specs/2026-08-11-mobile-phase-3a-project-depth-design.md`
**Prior phase:** `docs/superpowers/plans/2026-08-11-mobile-phase-2-employee-core.md`, complete at `40d3e79`
**Porting brief:** `.superpowers/sdd/phase-2-porting-brief.md`

## What already exists (do not rebuild)

- `mobile/lib/data.ts`: `one`, `taskProgress`, `isTaskOverdue`, `countByStage`, `isCreativeEmployee`, `shortDate`, `relativeTime`, `firstName`, `distinctAssignees`, `distinctClientCount`
- `mobile/lib/queries/keys.ts`: `qk`, including `qk.dashboards()`, `qk.project()`, `qk.projects()`, `qk.projectTasks()`
- `mobile/lib/query-client.ts`: the single `QueryClient` instance
- `mobile/components/ui/`: `Screen`, `GlassCard`, `Button`, `Input`, `Badge`, `ScreenHeader`, `PickerSheet`, `Placeholder`
- `mobile/lib/queries/board.ts`: `useBoard(projectId)` — already fetches this project's tasks with `id` and `title`
- `@shared/rbac`: `isExecutive`, `DELIVERABLE_STATUS_LABELS`, `DELIVERABLE_TYPE_LABELS`, `PRIORITY_LABELS`, `PROJECT_STATUS_LABELS`, `DEPT_COLORS`
- `@shared/types`: `DeliverableType`, `DeliverableStatus`, `RevisionAction`
- 62 tests across 9 suites, all passing. `npx tsc --noEmit` clean inside `mobile/`.

## Global Constraints

- **Never import or reference `SUPABASE_SERVICE_ROLE_KEY`, `lib/supabase/admin.ts`, or `createAdminClient` anywhere under `mobile/`.** A leak there is total database compromise.
- iOS only. **Dark theme only** — no light-mode values, no `useColorScheme`. Canvas is exactly `#06060a`. Border radius is `12`.
- Role gating uses the shared helpers from `@shared/rbac` plus `isCreativeEmployee` from `mobile/lib/data.ts`. Never hand-roll a role comparison. UI gating is cosmetic; Postgres RLS is the actual boundary. Do not write a comment implying the UI check is what protects the data.
- **Every Supabase select is copied verbatim from the spec, including the FK-disambiguation and `!inner` hints.** Getting that syntax wrong returns silently wrong rows, not an error. Do not "tidy" a select string.
- Supabase returns an embedded to-one relation as an object in some query shapes and a single-element array in others. Always funnel it through `one()` from `mobile/lib/data.ts`. Never index `[0]` directly, never assume an object.
- **No new dependencies. No new migrations. No schema or dashboard configuration.**
- All query keys come from `qk` in `mobile/lib/queries/keys.ts` — never inlined at a call site.
- A mutation's `onSuccess` invalidates the narrowest key that could contain the changed row, then every list key that shows it. `qk.project(id)` prefix-matches `['project', id, …]` but does **not** prefix-match `qk.projects()`.
- `queryFn` throws the Supabase error object; screens render `error.message` in a muted error row. **Every consumed query needs a rendered error path** — Phase 2 shipped three screens that swallowed a secondary query's error and each needed its own fix round. Mutations surface failures with `Alert.alert`.
- Every mutation is guarded against double-submit: the submit gate leads with `!mutation.isPending`, and `Button`'s `loading` prop reaches `Pressable disabled` (`off = disabled || loading`).
- Testing is deliberately minimal: one runnable check per piece of non-trivial pure logic, unit-tested directly. **Do not write render tests for screens.**
- Every `useEffect` must carry a comment explaining why its dependency array is what it is.
- Typed routes: link to a not-yet-existing route with `@ts-expect-error` and a comment naming the task that removes it. Never `as any`.

## Environment notes

- Node 26 breaks the `.bin` shims. Use `node node_modules/typescript/bin/tsc --noEmit` from inside `mobile/`. `npm test` is the jest script.
- A Metro dev server runs on port 8081, driven by the controller. **Do not start, stop, restart or `--clear` it.** Do not run `npx expo start`.
- `mobile/.expo/types/router.d.ts` is generated by Metro and gitignored. Never hand-edit it.
- Implementers have no Supabase credentials and no simulator access, and must never create, guess or request any. The controller runs every on-device check.

---

## File Structure

| File | Responsibility |
|---|---|
| `mobile/lib/queries/keys.ts` *(modify)* | Two new key entries, nested under `project` |
| `mobile/lib/queries/activity.ts` *(create)* | Stage-history select, row flattening, project activity hook |
| `mobile/lib/queries/deliverables.ts` *(create)* | Deliverables read hook, latest-revision helper, create and update writes |
| `mobile/lib/queries/__tests__/project-depth.test.ts` *(create)* | Unit checks for the two pure helpers |
| `mobile/app/(employee)/projects/[projectId]/deliverables/index.tsx` *(create)* | Deliverables list |
| `mobile/app/(employee)/projects/[projectId]/deliverables/new.tsx` *(create)* | Create form |
| `mobile/app/(employee)/projects/[projectId]/deliverables/[deliverableId].tsx` *(create)* | Edit form with version bump |
| `mobile/app/(employee)/projects/[projectId]/activity.tsx` *(create)* | Stage-change list |
| `mobile/app/(employee)/projects/[projectId]/index.tsx` *(modify)* | Two tiles become tappable |
| `mobile/lib/queries/dashboard.ts` *(modify)* | Activity feed repointed at stage history |
| `mobile/components/dashboard/ExecutiveDashboard.tsx` *(modify)* | Renders a stage-change sentence |
| `app/(admin)/admin/projects/[projectId]/activity/page.tsx` *(modify)* | Add the missing `!inner` |
| `app/(admin)/admin/dashboard/page.tsx` *(modify)* | Same repoint on the web |

---

### Task 1: Data layer — query modules and pure helpers

Nothing here renders a screen. The deliverable is a passing test suite and a clean typecheck. Every later task consumes this.

**Files:**
- Modify: `mobile/lib/queries/keys.ts`
- Create: `mobile/lib/queries/activity.ts`
- Create: `mobile/lib/queries/deliverables.ts`
- Create: `mobile/lib/queries/__tests__/project-depth.test.ts`

**Interfaces:**
- Consumes: `supabase` (`mobile/lib/supabase.ts`), `one` (`mobile/lib/data.ts`), `qk`, and `DeliverableType` / `DeliverableStatus` / `RevisionAction` from `@shared/types`
- Produces:
  - `qk.projectDeliverables(projectId)`, `qk.projectActivity(projectId)`
  - `STAGE_HISTORY_SELECT: string`
  - `describeStageChange(row: StageChangeRow): StageChange`
  - `useProjectActivity(projectId: string): UseQueryResult<StageChange[]>`
  - `latestRevision(revisions: DeliverableRevision[] | null): DeliverableRevision | null`
  - `useDeliverables(projectId: string): UseQueryResult<DeliverableRow[]>`
  - `createDeliverable(input: CreateDeliverableInput): Promise<void>`
  - `updateDeliverable(input: UpdateDeliverableInput): Promise<void>`
  - types `StageChangeRow`, `StageChange`, `DeliverableRevision`, `DeliverableRow`, `CreateDeliverableInput`, `UpdateDeliverableInput`

- [ ] **Step 1: Add the two query keys**

In `mobile/lib/queries/keys.ts`, insert these two entries immediately after the `projectTasks` line, keeping the file's existing comment style:

```ts
  // Both nested under `project` so the existing qk.project(id) invalidation in
  // the deliverable and task mutations cascades here without new call sites.
  projectDeliverables: (projectId: string) =>
    ['project', projectId, 'deliverables'] as const,
  projectActivity: (projectId: string) => ['project', projectId, 'activity'] as const,
```

- [ ] **Step 2: Write the activity query module**

Create `mobile/lib/queries/activity.ts`:

```ts
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../supabase';
import { qk } from './keys';
import { one } from '../data';

export type StageChangeRow = {
  id: string;
  moved_at: string;
  tasks: { title: string } | { title: string }[] | null;
  from_stage: { name: string } | { name: string }[] | null;
  to_stage: { name: string } | { name: string }[] | null;
  profiles: { full_name: string } | { full_name: string }[] | null;
};

export type StageChange = {
  id: string;
  movedAt: string;
  actor: string;
  taskTitle: string;
  fromStage: string | null;
  toStage: string;
};

/**
 * `tasks!inner` is load-bearing. Without it, a filter on the embedded resource
 * does not restrict the parent rows — PostgREST only nulls the embed where it
 * does not match — so the query returns every project's stage changes. The web
 * page shipped without it and listed the whole agency's history under one
 * project's heading.
 *
 * Shared with the dashboard feed in `dashboard.ts`, which uses the same select
 * without the project filter. One string, so the two cannot drift.
 */
export const STAGE_HISTORY_SELECT =
  '*, tasks!inner(title), from_stage:from_stage_id(name), to_stage:to_stage_id(name), profiles:moved_by(full_name)';

/**
 * Flattens one task_stage_history row into what the screens render.
 * `from_stage_id` is nullable — the first move into any stage has none — and
 * the sentence must drop the "from" clause rather than print an empty name.
 */
export function describeStageChange(row: StageChangeRow): StageChange {
  return {
    id: row.id,
    movedAt: row.moved_at,
    actor: one(row.profiles)?.full_name ?? 'Someone',
    taskTitle: one(row.tasks)?.title ?? 'a task',
    fromStage: one(row.from_stage)?.name ?? null,
    toStage: one(row.to_stage)?.name ?? '—',
  };
}

export function useProjectActivity(projectId: string) {
  return useQuery({
    queryKey: qk.projectActivity(projectId),
    queryFn: async (): Promise<StageChange[]> => {
      const { data, error } = await supabase
        .from('task_stage_history')
        .select(STAGE_HISTORY_SELECT)
        .eq('tasks.project_id', projectId)
        .order('moved_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return ((data ?? []) as unknown as StageChangeRow[]).map(describeStageChange);
    },
  });
}
```

- [ ] **Step 3: Write the deliverables query module**

Create `mobile/lib/queries/deliverables.ts`:

```ts
import { useQuery } from '@tanstack/react-query';
import type { DeliverableStatus, DeliverableType, RevisionAction } from '@shared/types';
import { supabase } from '../supabase';
import { qk } from './keys';

export type DeliverableRevision = {
  action: RevisionAction;
  note: string | null;
  created_at: string;
  profiles: { full_name: string } | { full_name: string }[] | null;
};

export type DeliverableRow = {
  id: string;
  project_id: string;
  task_id: string | null;
  type: DeliverableType;
  title: string;
  dropbox_url: string;
  thumbnail_url: string | null;
  version: number;
  status: DeliverableStatus;
  submitted_at: string;
  profiles: { full_name: string } | { full_name: string }[] | null;
  deliverable_revisions: DeliverableRevision[] | null;
};

/**
 * The most recent revision by created_at. The web takes `revisions[0]` from a
 * select that never orders `deliverable_revisions`, so which one it shows is
 * whatever PostgREST happens to return. Picking explicitly shows the revision
 * the web means to show.
 */
export function latestRevision(
  revisions: DeliverableRevision[] | null
): DeliverableRevision | null {
  if (!revisions || revisions.length === 0) return null;
  return revisions.reduce((latest, r) => (r.created_at > latest.created_at ? r : latest));
}

export function useDeliverables(projectId: string) {
  return useQuery({
    queryKey: qk.projectDeliverables(projectId),
    queryFn: async (): Promise<DeliverableRow[]> => {
      const { data, error } = await supabase
        .from('deliverables')
        .select(
          '*, profiles:submitted_by(full_name), deliverable_revisions(action, note, created_at, profiles:actor_profile_id(full_name))'
        )
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as DeliverableRow[];
    },
  });
}

export type CreateDeliverableInput = {
  project_id: string;
  task_id: string | null;
  type: DeliverableType;
  title: string;
  dropbox_url: string;
  thumbnail_url: string;
  status: DeliverableStatus;
  submitted_by: string;
};

export async function createDeliverable(input: CreateDeliverableInput) {
  const { error } = await supabase.from('deliverables').insert({
    project_id: input.project_id,
    task_id: input.task_id || null,
    type: input.type,
    title: input.title,
    dropbox_url: input.dropbox_url,
    thumbnail_url: input.thumbnail_url || null,
    status: input.status,
    submitted_by: input.submitted_by,
  });
  if (error) throw error;
}

export type UpdateDeliverableInput = {
  id: string;
  title: string;
  dropbox_url: string;
  thumbnail_url: string;
  status: DeliverableStatus;
  version: number;
};

/**
 * One write, including the version bump. The bump raises `version` and sets
 * `status: 'client_review'` in the same update — the screen puts both into
 * local state before submitting, so there is never a second round-trip and
 * never a second path to the same write.
 */
export async function updateDeliverable(input: UpdateDeliverableInput) {
  const { error } = await supabase
    .from('deliverables')
    .update({
      title: input.title,
      dropbox_url: input.dropbox_url,
      thumbnail_url: input.thumbnail_url || null,
      status: input.status,
      version: input.version,
    })
    .eq('id', input.id);
  if (error) throw error;
}
```

- [ ] **Step 4: Write the failing tests**

Create `mobile/lib/queries/__tests__/project-depth.test.ts`:

```ts
// Both modules import the real Supabase client, which touches expo-sqlite at
// module load and blows up under jest. The helpers under test have no I/O, so
// a bare mock is enough to let the imports resolve.
jest.mock('../../supabase', () => ({ supabase: {} }));

import { describeStageChange } from '../activity';
import { latestRevision } from '../deliverables';

describe('describeStageChange', () => {
  it('drops the "from" clause for the first move into a stage', () => {
    // from_stage_id is null on a task's first move — the sentence must not
    // claim it came from somewhere.
    const flat = describeStageChange({
      id: 'h1',
      moved_at: '2026-08-11T10:00:00Z',
      tasks: { title: 'Luca Shoot' },
      from_stage: null,
      to_stage: { name: 'Shoot' },
      profiles: { full_name: 'Salman Farizi' },
    });
    expect(flat.fromStage).toBeNull();
    expect(flat.toStage).toBe('Shoot');
    expect(flat.actor).toBe('Salman Farizi');
    expect(flat.taskTitle).toBe('Luca Shoot');
  });

  it('unwraps single-element arrays, which is how Supabase returns these embeds', () => {
    const flat = describeStageChange({
      id: 'h2',
      moved_at: '2026-08-11T11:00:00Z',
      tasks: [{ title: 'Luca Video Edits' }],
      from_stage: [{ name: 'Shoot' }],
      to_stage: [{ name: 'Post-production' }],
      profiles: [{ full_name: 'Quintin' }],
    });
    expect(flat.fromStage).toBe('Shoot');
    expect(flat.toStage).toBe('Post-production');
    expect(flat.taskTitle).toBe('Luca Video Edits');
  });
});

describe('latestRevision', () => {
  it('picks by created_at, not by array position', () => {
    // The web takes revisions[0] from an unordered select. If this ever
    // reduces to "first element", the screen shows stale feedback.
    const older = {
      action: 'request_revision' as const,
      note: 'Needs work',
      created_at: '2026-08-01T00:00:00Z',
      profiles: { full_name: 'Dina' },
    };
    const newer = {
      action: 'approve' as const,
      note: null,
      created_at: '2026-08-09T00:00:00Z',
      profiles: { full_name: 'Anwar' },
    };
    expect(latestRevision([older, newer])).toBe(newer);
    expect(latestRevision([newer, older])).toBe(newer);
  });

  it('is null for no revisions', () => {
    expect(latestRevision(null)).toBeNull();
    expect(latestRevision([])).toBeNull();
  });
});
```

- [ ] **Step 5: Run the tests to verify they pass**

Run from inside `mobile/`:

```bash
npm test -- project-depth
```

Expected: 4 passing tests, output pristine. If you wrote the modules before the tests, note honestly in your report that the RED phase was not observed.

- [ ] **Step 6: Typecheck and commit**

```bash
node node_modules/typescript/bin/tsc --noEmit
```

Expected: clean, no output.

```bash
git add mobile/lib/queries/keys.ts mobile/lib/queries/activity.ts mobile/lib/queries/deliverables.ts mobile/lib/queries/__tests__/project-depth.test.ts
git commit -m "feat(mobile): add deliverables and project activity query modules"
```

---

### Task 2: Deliverables list screen

**Files:**
- Create: `mobile/app/(employee)/projects/[projectId]/deliverables/index.tsx`

**Interfaces:**
- Consumes: `Screen`, `GlassCard`, `Badge`, `ScreenHeader`, `useAuth`, `theme`; `one`, `shortDate`, `isCreativeEmployee` from `mobile/lib/data.ts`; `useDeliverables`, `latestRevision`, `type DeliverableRow` from Task 1; `isExecutive`, `DELIVERABLE_STATUS_LABELS`, `DELIVERABLE_TYPE_LABELS` from `@shared/rbac`
- Produces: route `/projects/[projectId]/deliverables`

- [ ] **Step 1: Write the screen**

Create `mobile/app/(employee)/projects/[projectId]/deliverables/index.tsx`. Note the import depth is five levels, identical to `tasks/index.tsx`:

```tsx
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { isExecutive, DELIVERABLE_STATUS_LABELS, DELIVERABLE_TYPE_LABELS } from '@shared/rbac';
import { Screen } from '../../../../../components/ui/Screen';
import { GlassCard } from '../../../../../components/ui/GlassCard';
import { Badge } from '../../../../../components/ui/Badge';
import { ScreenHeader } from '../../../../../components/ui/ScreenHeader';
import { useAuth } from '../../../../../lib/auth';
import { one, shortDate, isCreativeEmployee } from '../../../../../lib/data';
import {
  useDeliverables,
  latestRevision,
  type DeliverableRow,
} from '../../../../../lib/queries/deliverables';
import { theme } from '../../../../../lib/theme';

export default function DeliverablesScreen() {
  const { projectId } = useLocalSearchParams<{ projectId: string }>();
  const router = useRouter();
  const { employee } = useAuth();
  // Cosmetic only — RLS (deliverables_update) permits any employee who can see
  // the project. This mirrors the web's own gate.
  const canReview = isExecutive(employee?.role ?? 'employee') || isCreativeEmployee(employee);

  const { data, isLoading, error } = useDeliverables(projectId);

  function newDeliverable() {
    // @ts-expect-error — the /projects/[projectId]/deliverables/new route does
    // not exist until Task 3 creates it. Delete this directive (not the call) in Task 3.
    router.push({ pathname: '/projects/[projectId]/deliverables/new', params: { projectId } });
  }

  function editDeliverable(deliverableId: string) {
    // @ts-expect-error — the /projects/[projectId]/deliverables/[deliverableId]
    // route does not exist until Task 3 creates it. Delete this directive (not
    // the call) in Task 3.
    router.push({ pathname: '/projects/[projectId]/deliverables/[deliverableId]', params: { projectId, deliverableId } });
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.scroll}>
        <ScreenHeader
          title="Deliverables"
          onBack={() => router.back()}
          right={
            <Pressable onPress={newDeliverable} hitSlop={10}>
              <Text style={styles.newButton}>New</Text>
            </Pressable>
          }
        />

        {error && <Text style={styles.error}>{error.message}</Text>}

        {isLoading ? (
          <Text style={styles.muted}>Loading…</Text>
        ) : error ? null : (data?.length ?? 0) === 0 ? (
          <GlassCard>
            <Text style={styles.emptyTitle}>No deliverables yet</Text>
            <Text style={styles.muted}>Add a Dropbox link to submit your first deliverable</Text>
          </GlassCard>
        ) : (
          data!.map((d) => (
            <DeliverableCard
              key={d.id}
              deliverable={d}
              canReview={canReview}
              onEdit={() => editDeliverable(d.id)}
            />
          ))
        )}
      </ScrollView>
    </Screen>
  );
}

function DeliverableCard({
  deliverable,
  canReview,
  onEdit,
}: {
  deliverable: DeliverableRow;
  canReview: boolean;
  onEdit: () => void;
}) {
  const revision = latestRevision(deliverable.deliverable_revisions);
  const submitter = one(deliverable.profiles)?.full_name ?? 'Unknown';

  async function openDropbox() {
    try {
      await Linking.openURL(deliverable.dropbox_url);
    } catch {
      Alert.alert('Could not open link', deliverable.dropbox_url);
    }
  }

  return (
    <GlassCard>
      <View style={styles.cardTop}>
        <View style={styles.flex}>
          <View style={styles.typeRow}>
            <Text style={styles.typeChip}>{DELIVERABLE_TYPE_LABELS[deliverable.type]}</Text>
            <Text style={styles.version}>v{deliverable.version}</Text>
          </View>
          <Text style={styles.title} numberOfLines={2}>
            {deliverable.title}
          </Text>
          <Text style={styles.meta}>
            By {submitter} · {shortDate(deliverable.submitted_at)}
          </Text>
        </View>
        <Badge label={DELIVERABLE_STATUS_LABELS[deliverable.status]} />
      </View>

      {revision && (
        <View style={styles.revision}>
          <Text style={revision.action === 'approve' ? styles.approved : styles.revisionRequested}>
            {revision.action === 'approve' ? '✓ Approved' : '↩ Revision requested'}
          </Text>
          {revision.note ? <Text style={styles.revisionNote}>{revision.note}</Text> : null}
          <Text style={styles.revisionMeta}>
            by {one(revision.profiles)?.full_name ?? 'Unknown'} · {shortDate(revision.created_at)}
          </Text>
        </View>
      )}

      <View style={styles.actions}>
        <Pressable onPress={openDropbox} hitSlop={8}>
          <Text style={styles.action}>Open in Dropbox</Text>
        </Pressable>
        {canReview ? (
          <Pressable onPress={onEdit} hitSlop={8}>
            <Text style={styles.action}>Edit</Text>
          </Pressable>
        ) : null}
      </View>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 20, gap: 12, paddingBottom: 140 },
  flex: { flex: 1 },
  newButton: { color: '#fff', fontSize: 15, fontWeight: '600' },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  typeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  typeChip: {
    color: theme.colors.foreground,
    fontSize: 11,
    fontWeight: '500',
    borderWidth: 1,
    borderColor: theme.colors.borderStrong,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  version: { color: theme.text.dimmer, fontSize: 11, fontWeight: '500' },
  title: { color: '#fff', fontSize: 15, fontWeight: '600', marginTop: 8 },
  meta: { color: theme.text.dim, fontSize: 12, marginTop: 4 },
  revision: {
    marginTop: 12,
    borderRadius: theme.radius,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.glass,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  approved: { color: '#34d399', fontSize: 12, fontWeight: '600' },
  revisionRequested: { color: '#fb923c', fontSize: 12, fontWeight: '600' },
  revisionNote: { color: theme.text.label, fontSize: 13, marginTop: 4 },
  revisionMeta: { color: theme.text.dimmer, fontSize: 11, marginTop: 6 },
  actions: { flexDirection: 'row', gap: 20, marginTop: 12 },
  action: { color: theme.text.label, fontSize: 13, fontWeight: '500' },
  emptyTitle: { color: '#fff', fontSize: 15, fontWeight: '600', marginBottom: 4 },
  muted: { color: theme.text.dim, fontSize: 13 },
  error: { color: '#f87171', fontSize: 13 },
});
```

- [ ] **Step 2: Typecheck**

```bash
node node_modules/typescript/bin/tsc --noEmit
```

Expected: clean. Two `@ts-expect-error` directives remain live in this file. A clean typecheck proves both are load-bearing — TypeScript errors on a directive that suppresses nothing.

- [ ] **Step 3: Run the suite**

```bash
npm test
```

Expected: 66 passing across 9 suites — the 62 baseline plus Task 1's 4. This task adds no tests.

- [ ] **Step 4: Commit**

```bash
git add "mobile/app/(employee)/projects/[projectId]/deliverables"
git commit -m "feat(mobile): add project deliverables list"
```

---

### Task 3: Deliverable create and edit screens

Two forms. The edit form carries the version bump, which is the only non-obvious interaction in this task: it is a control that mutates local state (`version + 1` and `status: 'client_review'`) so the single submit writes both. It never issues a second request.

**Files:**
- Create: `mobile/app/(employee)/projects/[projectId]/deliverables/new.tsx`
- Create: `mobile/app/(employee)/projects/[projectId]/deliverables/[deliverableId].tsx`
- Modify: `mobile/app/(employee)/projects/[projectId]/deliverables/index.tsx` (remove both `@ts-expect-error` directives)

**Interfaces:**
- Consumes: `Screen`, `GlassCard`, `Button`, `Input`, `ScreenHeader`, `PickerSheet`, `useAuth`, `qk`, `theme`; `useBoard` from `mobile/lib/queries/board.ts`; `useDeliverables`, `createDeliverable`, `updateDeliverable`, types from Task 1; `DELIVERABLE_STATUS_LABELS`, `DELIVERABLE_TYPE_LABELS` from `@shared/rbac`
- Produces: routes `/projects/[projectId]/deliverables/new` and `/projects/[projectId]/deliverables/[deliverableId]`

**Note on the task picker:** the create form's optional task field reuses `useBoard(projectId)`, which already fetches this project's tasks with `id` and `title` under `qk.projectTasks(projectId)`. Do **not** add a second query for the same rows — Phase 2's final review found exactly that duplication (the same creatives select under two cache keys) and had it extracted.

- [ ] **Step 1: Write the create screen**

Create `mobile/app/(employee)/projects/[projectId]/deliverables/new.tsx`:

```tsx
import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { DeliverableStatus, DeliverableType } from '@shared/types';
import { DELIVERABLE_STATUS_LABELS, DELIVERABLE_TYPE_LABELS } from '@shared/rbac';
import { Screen } from '../../../../../components/ui/Screen';
import { GlassCard } from '../../../../../components/ui/GlassCard';
import { Button } from '../../../../../components/ui/Button';
import { Input } from '../../../../../components/ui/Input';
import { ScreenHeader } from '../../../../../components/ui/ScreenHeader';
import { PickerSheet } from '../../../../../components/ui/PickerSheet';
import { useAuth } from '../../../../../lib/auth';
import { qk } from '../../../../../lib/queries/keys';
import { useBoard } from '../../../../../lib/queries/board';
import { createDeliverable } from '../../../../../lib/queries/deliverables';
import { theme } from '../../../../../lib/theme';

const TYPES: DeliverableType[] = ['photo', 'video', 'pr'];
const STATUSES: DeliverableStatus[] = [
  'draft',
  'internal_review',
  'client_review',
  'approved',
  'revision_requested',
];
const NO_TASK = 'none';

export default function NewDeliverableScreen() {
  const { projectId } = useLocalSearchParams<{ projectId: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { session } = useAuth();

  const board = useBoard(projectId);
  const tasks = board.data?.tasks ?? [];

  const [title, setTitle] = useState('');
  const [type, setType] = useState<DeliverableType>('video');
  const [status, setStatus] = useState<DeliverableStatus>('draft');
  const [dropboxUrl, setDropboxUrl] = useState('');
  const [thumbnailUrl, setThumbnailUrl] = useState('');
  const [taskId, setTaskId] = useState<string | null>(null);
  const [picker, setPicker] = useState<'type' | 'status' | 'task' | null>(null);

  const mutation = useMutation({
    mutationFn: createDeliverable,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.project(projectId) });
      queryClient.invalidateQueries({ queryKey: qk.projects() });
      queryClient.invalidateQueries({ queryKey: qk.dashboards() });
      router.back();
    },
    onError: (e: Error) => Alert.alert('Could not add deliverable', e.message),
  });

  const canSubmit =
    !mutation.isPending &&
    !!session?.user.id &&
    title.trim().length > 0 &&
    dropboxUrl.trim().length > 0;

  function submit() {
    if (!canSubmit) return;
    mutation.mutate({
      project_id: projectId,
      task_id: taskId,
      type,
      title: title.trim(),
      dropbox_url: dropboxUrl.trim(),
      thumbnail_url: thumbnailUrl.trim(),
      status,
      submitted_by: session!.user.id,
    });
  }

  const taskTitle = tasks.find((t) => t.id === taskId)?.title ?? 'None';

  return (
    <Screen>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <ScreenHeader title="New deliverable" onBack={() => router.back()} />

          {board.error && <Text style={styles.error}>{board.error.message}</Text>}

          <GlassCard>
            <View style={styles.form}>
              <Input label="Title" value={title} onChangeText={setTitle} placeholder="Deliverable title" />

              <Pressable onPress={() => setPicker('type')}>
                <Text style={styles.label}>TYPE</Text>
                <Text style={styles.value}>{DELIVERABLE_TYPE_LABELS[type]}</Text>
              </Pressable>

              <Pressable onPress={() => setPicker('status')}>
                <Text style={styles.label}>STATUS</Text>
                <Text style={styles.value}>{DELIVERABLE_STATUS_LABELS[status]}</Text>
              </Pressable>

              <Input
                label="Dropbox link"
                value={dropboxUrl}
                onChangeText={setDropboxUrl}
                placeholder="https://www.dropbox.com/sh/..."
                keyboardType="url"
              />
              <Input
                label="Thumbnail URL"
                value={thumbnailUrl}
                onChangeText={setThumbnailUrl}
                placeholder="Optional"
                keyboardType="url"
              />

              <Pressable onPress={() => setPicker('task')}>
                <Text style={styles.label}>TASK</Text>
                <Text style={styles.value}>{taskTitle}</Text>
                <Text style={styles.muted}>Optional — links this deliverable to one task.</Text>
              </Pressable>
            </View>
          </GlassCard>

          <Button
            title="Add deliverable"
            onPress={submit}
            disabled={!canSubmit}
            loading={mutation.isPending}
          />
        </ScrollView>
      </KeyboardAvoidingView>

      <PickerSheet
        visible={picker === 'type'}
        title="Type"
        selected={type}
        options={TYPES.map((t) => ({ value: t, label: DELIVERABLE_TYPE_LABELS[t] }))}
        onSelect={(v) => {
          setType(v as DeliverableType);
          setPicker(null);
        }}
        onClose={() => setPicker(null)}
      />
      <PickerSheet
        visible={picker === 'status'}
        title="Status"
        selected={status}
        options={STATUSES.map((s) => ({ value: s, label: DELIVERABLE_STATUS_LABELS[s] }))}
        onSelect={(v) => {
          setStatus(v as DeliverableStatus);
          setPicker(null);
        }}
        onClose={() => setPicker(null)}
      />
      <PickerSheet
        visible={picker === 'task'}
        title="Task"
        selected={taskId ?? NO_TASK}
        options={[
          { value: NO_TASK, label: 'None' },
          ...tasks.map((t) => ({ value: t.id, label: t.title })),
        ]}
        onSelect={(v) => {
          setTaskId(v === NO_TASK ? null : v);
          setPicker(null);
        }}
        onClose={() => setPicker(null)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { padding: 20, gap: 16, paddingBottom: 160 },
  form: { gap: 16 },
  label: {
    fontSize: 11,
    fontWeight: '500',
    color: theme.text.label,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  value: { color: '#fff', fontSize: 15, marginTop: 6 },
  muted: { color: theme.text.dim, fontSize: 12, marginTop: 6 },
  error: { color: '#f87171', fontSize: 13 },
});
```

- [ ] **Step 2: Write the edit screen**

Create `mobile/app/(employee)/projects/[projectId]/deliverables/[deliverableId].tsx`. The form seeds from the list cache — `useDeliverables` is already warm because the user arrived from that list — so there is no second single-row query:

```tsx
import { useEffect, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { DeliverableStatus } from '@shared/types';
import { DELIVERABLE_STATUS_LABELS } from '@shared/rbac';
import { Screen } from '../../../../../components/ui/Screen';
import { GlassCard } from '../../../../../components/ui/GlassCard';
import { Button } from '../../../../../components/ui/Button';
import { Input } from '../../../../../components/ui/Input';
import { ScreenHeader } from '../../../../../components/ui/ScreenHeader';
import { PickerSheet } from '../../../../../components/ui/PickerSheet';
import { qk } from '../../../../../lib/queries/keys';
import { useDeliverables, updateDeliverable } from '../../../../../lib/queries/deliverables';
import { theme } from '../../../../../lib/theme';

const STATUSES: DeliverableStatus[] = [
  'draft',
  'internal_review',
  'client_review',
  'approved',
  'revision_requested',
];

export default function EditDeliverableScreen() {
  const { projectId, deliverableId } = useLocalSearchParams<{
    projectId: string;
    deliverableId: string;
  }>();
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useDeliverables(projectId);
  const deliverable = data?.find((d) => d.id === deliverableId) ?? null;

  const [title, setTitle] = useState('');
  const [dropboxUrl, setDropboxUrl] = useState('');
  const [thumbnailUrl, setThumbnailUrl] = useState('');
  const [status, setStatus] = useState<DeliverableStatus>('draft');
  const [version, setVersion] = useState(1);
  const [pickerOpen, setPickerOpen] = useState(false);

  useEffect(() => {
    // Keyed on the deliverable's ROW IDENTITY, not on the object — `data` is a
    // new array after every refetch and every invalidation, and re-running this
    // would overwrite whatever the user has typed. Seeding once per id is the
    // whole intent.
    if (!deliverable) return;
    setTitle(deliverable.title);
    setDropboxUrl(deliverable.dropbox_url);
    setThumbnailUrl(deliverable.thumbnail_url ?? '');
    setStatus(deliverable.status);
    setVersion(deliverable.version);
  }, [deliverable?.id]);

  const mutation = useMutation({
    mutationFn: updateDeliverable,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.project(projectId) });
      queryClient.invalidateQueries({ queryKey: qk.projects() });
      queryClient.invalidateQueries({ queryKey: qk.dashboards() });
      router.back();
    },
    onError: (e: Error) => Alert.alert('Could not save deliverable', e.message),
  });

  if (isLoading) {
    return (
      <Screen>
        <View style={styles.centered}>
          <Text style={styles.muted}>Loading…</Text>
        </View>
      </Screen>
    );
  }
  if (error || !deliverable) {
    return (
      <Screen>
        <View style={styles.centered}>
          <Text style={styles.error}>{error?.message ?? 'Deliverable not found'}</Text>
        </View>
      </Screen>
    );
  }

  const bumped = version !== deliverable.version;
  const canSubmit =
    !mutation.isPending && title.trim().length > 0 && dropboxUrl.trim().length > 0;

  function bumpVersion() {
    // Local state only. The single submit below writes the new version and the
    // client_review status together — there is no separate "send to client"
    // request, which is what the web's dead 404 button tried to be.
    setVersion((v) => v + 1);
    setStatus('client_review');
  }

  function submit() {
    if (!canSubmit) return;
    mutation.mutate({
      id: deliverableId,
      title: title.trim(),
      dropbox_url: dropboxUrl.trim(),
      thumbnail_url: thumbnailUrl.trim(),
      status,
      version,
    });
  }

  return (
    <Screen>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <ScreenHeader title="Edit deliverable" onBack={() => router.back()} />

          <GlassCard>
            <View style={styles.form}>
              <Input label="Title" value={title} onChangeText={setTitle} placeholder="Deliverable title" />

              <View>
                <View style={styles.versionRow}>
                  <Text style={styles.label}>VERSION</Text>
                  <Pressable onPress={bumpVersion} hitSlop={8}>
                    <Text style={styles.bump}>
                      v{version} → v{version + 1}
                    </Text>
                  </Pressable>
                </View>
                <Text style={styles.muted}>
                  Bumping also moves this deliverable to Client Review.
                </Text>
              </View>

              <Input
                label="Dropbox link"
                value={dropboxUrl}
                onChangeText={setDropboxUrl}
                placeholder="https://www.dropbox.com/sh/..."
                keyboardType="url"
              />

              <Input
                label="Thumbnail URL"
                value={thumbnailUrl}
                onChangeText={setThumbnailUrl}
                placeholder="Optional"
                keyboardType="url"
              />

              <Pressable onPress={() => setPickerOpen(true)}>
                <Text style={styles.label}>STATUS</Text>
                <Text style={styles.value}>{DELIVERABLE_STATUS_LABELS[status]}</Text>
              </Pressable>
            </View>
          </GlassCard>

          <Button
            title={bumped ? `Save as v${version}` : 'Save changes'}
            onPress={submit}
            disabled={!canSubmit}
            loading={mutation.isPending}
          />
        </ScrollView>
      </KeyboardAvoidingView>

      <PickerSheet
        visible={pickerOpen}
        title="Status"
        selected={status}
        options={STATUSES.map((s) => ({ value: s, label: DELIVERABLE_STATUS_LABELS[s] }))}
        onSelect={(v) => {
          setStatus(v as DeliverableStatus);
          setPickerOpen(false);
        }}
        onClose={() => setPickerOpen(false)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { padding: 20, gap: 16, paddingBottom: 160 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  form: { gap: 16 },
  label: {
    fontSize: 11,
    fontWeight: '500',
    color: theme.text.label,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  value: { color: '#fff', fontSize: 15, marginTop: 6 },
  versionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  bump: { color: theme.text.label, fontSize: 12, fontWeight: '500' },
  muted: { color: theme.text.dim, fontSize: 13 },
  error: { color: '#f87171', fontSize: 13, textAlign: 'center' },
});
```

- [ ] **Step 3: Retire both forward-reference directives from Task 2**

In `mobile/app/(employee)/projects/[projectId]/deliverables/index.tsx`, delete these two comment lines from `newDeliverable`, leaving the `router.push` call:

```
    // @ts-expect-error — the /projects/[projectId]/deliverables/new route does
    // not exist until Task 3 creates it. Delete this directive (not the call) in Task 3.
```

and these three from `editDeliverable`, again leaving the call:

```
    // @ts-expect-error — the /projects/[projectId]/deliverables/[deliverableId]
    // route does not exist until Task 3 creates it. Delete this directive (not
    // the call) in Task 3.
```

- [ ] **Step 4: Verify**

```bash
node node_modules/typescript/bin/tsc --noEmit
npm test
grep -rn "ts-expect-error" "app/(employee)/projects"
```

Expected: typecheck clean; 66 tests across 9 suites; the grep prints nothing. If the typecheck complains about an unused `@ts-expect-error`, you removed a directive whose route now resolves — that is the expected outcome of Step 3, not an error to suppress.

- [ ] **Step 5: Commit**

```bash
git add "mobile/app/(employee)/projects/[projectId]/deliverables"
git commit -m "feat(mobile): add deliverable create and edit screens"
```

---

### Task 4: Project activity screen and tile wiring

**Files:**
- Create: `mobile/app/(employee)/projects/[projectId]/activity.tsx`
- Modify: `mobile/app/(employee)/projects/[projectId]/index.tsx`

**Interfaces:**
- Consumes: `Screen`, `GlassCard`, `ScreenHeader`, `theme`; `relativeTime` from `mobile/lib/data.ts`; `useProjectActivity`, `type StageChange` from Task 1
- Produces: route `/projects/[projectId]/activity`

**The web page also renders a Comments card. Do not port it.** Nothing in the repo writes to the `comments` table — both the admin activity page and the client portal only read it — so the card is a section that cannot populate. A compose box would be net-new product needing an RLS insert path, a notification decision and the `is_client_visible` toggle, and belongs in its own cycle.

- [ ] **Step 1: Write the activity screen**

Create `mobile/app/(employee)/projects/[projectId]/activity.tsx`. Import depth here is **four** levels, not five — this file sits in `[projectId]/`, alongside `index.tsx`:

```tsx
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Screen } from '../../../../components/ui/Screen';
import { GlassCard } from '../../../../components/ui/GlassCard';
import { ScreenHeader } from '../../../../components/ui/ScreenHeader';
import { relativeTime } from '../../../../lib/data';
import { useProjectActivity, type StageChange } from '../../../../lib/queries/activity';
import { theme } from '../../../../lib/theme';

export default function ActivityScreen() {
  const { projectId } = useLocalSearchParams<{ projectId: string }>();
  const router = useRouter();
  const { data, isLoading, error } = useProjectActivity(projectId);

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.scroll}>
        <ScreenHeader title="Activity" onBack={() => router.back()} />

        {error && <Text style={styles.error}>{error.message}</Text>}

        {isLoading ? (
          <Text style={styles.muted}>Loading…</Text>
        ) : error ? null : (data?.length ?? 0) === 0 ? (
          <GlassCard>
            <Text style={styles.muted}>No stage changes yet</Text>
          </GlassCard>
        ) : (
          <GlassCard>
            {data!.map((change) => (
              <StageChangeRowView key={change.id} change={change} />
            ))}
          </GlassCard>
        )}
      </ScrollView>
    </Screen>
  );
}

function StageChangeRowView({ change }: { change: StageChange }) {
  return (
    <View style={styles.row}>
      <Text style={styles.sentence}>
        <Text style={styles.strong}>{change.actor}</Text>
        {' moved '}
        <Text style={styles.strong}>{change.taskTitle}</Text>
        {change.fromStage ? (
          <>
            {' from '}
            <Text style={styles.stage}>{change.fromStage}</Text>
          </>
        ) : null}
        {' → '}
        <Text style={styles.toStage}>{change.toStage}</Text>
      </Text>
      <Text style={styles.meta}>{relativeTime(change.movedAt)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 20, gap: 12, paddingBottom: 140 },
  row: {
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
  },
  sentence: { color: theme.colors.foreground, fontSize: 13, lineHeight: 19 },
  strong: { fontWeight: '600', color: '#fff' },
  stage: { color: theme.text.dim },
  toStage: { color: '#a78bfa' },
  meta: { color: theme.text.dimmer, fontSize: 11, marginTop: 2 },
  muted: { color: theme.text.dim, fontSize: 13 },
  error: { color: '#f87171', fontSize: 13 },
});
```

- [ ] **Step 2: Wire the two project-detail tiles**

In `mobile/app/(employee)/projects/[projectId]/index.tsx`, add these two navigation functions next to the existing `openTasks` (around line 129):

```tsx
  function openDeliverables() {
    router.push({ pathname: '/projects/[projectId]/deliverables', params: { projectId } });
  }

  function openActivity() {
    router.push({ pathname: '/projects/[projectId]/activity', params: { projectId } });
  }
```

Then replace the two inert tiles (around lines 256-264):

```tsx
        <GlassCard>
          <Text style={styles.tileTitleSoon}>Deliverables · Soon</Text>
          <Text style={styles.muted}>{deliverableCount} total</Text>
        </GlassCard>

        <GlassCard>
          <Text style={styles.tileTitleSoon}>Activity · Soon</Text>
        </GlassCard>
```

with:

```tsx
        <Pressable onPress={openDeliverables}>
          <GlassCard>
            <Text style={styles.tileTitle}>Deliverables</Text>
            <Text style={styles.muted}>{deliverableCount} total</Text>
          </GlassCard>
        </Pressable>

        <Pressable onPress={openActivity}>
          <GlassCard>
            <Text style={styles.tileTitle}>Activity</Text>
          </GlassCard>
        </Pressable>
```

Both now use `styles.tileTitle`, the same style the live Tasks tile uses. If `styles.tileTitleSoon` has no remaining consumer in the file after this change, delete it — a dead style is exactly the kind of surface Phase 2's final review had removed.

- [ ] **Step 3: Verify**

```bash
node node_modules/typescript/bin/tsc --noEmit
npm test
grep -rn "Soon" "app/(employee)/projects"
```

Expected: typecheck clean; 66 tests across 9 suites; the grep prints nothing, since these were the last two `· Soon` affixes under `projects/`.

- [ ] **Step 4: Commit**

```bash
git add "mobile/app/(employee)/projects/[projectId]/activity.tsx" "mobile/app/(employee)/projects/[projectId]/index.tsx"
git commit -m "feat(mobile): add project activity screen and wire the project detail tiles"
```

---

### Task 5: Repoint both dashboards' activity feed

`activity_log` has no writer anywhere — no migration contains `INSERT INTO activity_log`, and the only reference in app code is the dashboard reading it. Both clients' Activity panels have therefore always been empty. This task points them at `task_stage_history`, which a trigger genuinely writes on every stage change.

**Files:**
- Modify: `mobile/lib/queries/dashboard.ts`
- Modify: `mobile/components/dashboard/ExecutiveDashboard.tsx`
- Modify: `app/(admin)/admin/projects/[projectId]/activity/page.tsx`
- Modify: `app/(admin)/admin/dashboard/page.tsx`

**Interfaces:**
- Consumes: `STAGE_HISTORY_SELECT`, `describeStageChange`, `type StageChange` from Task 1
- Produces: `ExecutiveDashboardData['activity']` is now `StageChange[]` instead of the old `{ id, action, created_at, profiles }[]`

- [ ] **Step 1: Repoint the mobile query**

In `mobile/lib/queries/dashboard.ts`, add to the imports:

```ts
import {
  STAGE_HISTORY_SELECT,
  describeStageChange,
  type StageChange,
  type StageChangeRow,
} from './activity';
```

Change the `activity` member of `ExecutiveDashboardData` from its current object-array shape to:

```ts
  activity: StageChange[];
```

Replace the `activityRes` query (currently the `activity_log` select, around line 67) with:

```ts
          // activity_log has no writer anywhere in the schema, so it was always
          // empty. task_stage_history is written by log_task_stage_change() on
          // every real stage change. Never department-filtered — always
          // agency-wide, as the panel has always been — and RLS
          // (task_history_select) already scopes it to projects this employee
          // can see.
          supabase
            .from('task_stage_history')
            .select(STAGE_HISTORY_SELECT)
            .order('moved_at', { ascending: false })
            .limit(8),
```

And change the returned `activity` value from its current cast to:

```ts
        activity: ((activityRes.data ?? []) as unknown as StageChangeRow[]).map(describeStageChange),
```

Leave the existing `if (activityRes.error) throw activityRes.error;` exactly where it is.

- [ ] **Step 2: Render the sentence on mobile**

In `mobile/components/dashboard/ExecutiveDashboard.tsx`, replace the body of the activity map (currently around lines 92-102) with:

```tsx
            {data!.activity.map((a) => (
              <View key={a.id} style={styles.activityRow}>
                <Text style={styles.activityText} numberOfLines={2}>
                  <Text style={styles.actor}>{a.actor}</Text>
                  {' moved '}
                  <Text style={styles.actor}>{a.taskTitle}</Text>
                  {a.fromStage ? ` from ${a.fromStage}` : ''}
                  {` → ${a.toStage}`}
                </Text>
                <Text style={styles.meta}>{relativeTime(a.movedAt)}</Text>
              </View>
            ))}
```

The `one` import may now be unused in this file — check, and remove it if so rather than leaving a dead import.

- [ ] **Step 3: Fix the web activity query**

In `app/(admin)/admin/projects/[projectId]/activity/page.tsx` line 24, change:

```ts
    .select("*, tasks(title), from_stage:from_stage_id(name), to_stage:to_stage_id(name), profiles:moved_by(full_name)")
```

to:

```ts
    .select("*, tasks!inner(title), from_stage:from_stage_id(name), to_stage:to_stage_id(name), profiles:moved_by(full_name)")
```

Without `!inner`, the `.eq("tasks.project_id", projectId)` on the next line does not restrict the parent rows — it only nulls the embed where it does not match — so the page lists every project's stage changes and foreign rows render as "moved undefined".

- [ ] **Step 4: Repoint the web dashboard**

In `app/(admin)/admin/dashboard/page.tsx`, replace the `activity_log` query (lines 64-68) with:

```ts
    supabase
      .from("task_stage_history")
      .select("*, tasks!inner(title), from_stage:from_stage_id(name), to_stage:to_stage_id(name), profiles:moved_by(full_name)")
      .order("moved_at", { ascending: false })
      .limit(8),
```

Then replace the row body inside `recentActivity.map` (lines 250-254) with the new shape. The old code read `log.action` and `log.created_at`, neither of which exists on a stage-history row:

```tsx
                        <span className="font-semibold text-white/80">
                          {(log.profiles as { full_name: string })?.full_name}
                        </span>{" "}
                        moved{" "}
                        <span className="font-semibold text-white/80">
                          {(log.tasks as { title: string })?.title}
                        </span>
                        {log.from_stage && (
                          <> from {(log.from_stage as { name: string })?.name}</>
                        )}
                        {" → "}
                        {(log.to_stage as { name: string })?.name}
                      </p>
                      <p className="text-[10px] text-white/25 mt-0.5">{formatRelative(log.moved_at)}</p>
```

The web page casts these embeds as plain objects rather than funnelling them through a `one()` helper. That is correct here: `@supabase/supabase-js` returns a to-one embed as an object in this query shape, and the surrounding page already relies on that throughout. Do not introduce a mobile-style helper into web code.

- [ ] **Step 5: Verify**

```bash
node node_modules/typescript/bin/tsc --noEmit
npm test
```

Expected: typecheck clean inside `mobile/`, 66 tests across 9 suites.

Then from the repo root, confirm the web still compiles:

```bash
node node_modules/typescript/bin/tsc --noEmit -p tsconfig.json
```

Expected: no new errors relative to before your change. The root tsconfig does not exclude `mobile/`, so it reports pre-existing noise from there — compare against a run on the previous commit rather than expecting a clean sheet, and say in your report which errors were already present.

- [ ] **Step 6: Commit**

```bash
git add mobile/lib/queries/dashboard.ts mobile/components/dashboard/ExecutiveDashboard.tsx "app/(admin)/admin/projects/[projectId]/activity/page.tsx" "app/(admin)/admin/dashboard/page.tsx"
git commit -m "fix: point activity feeds at task_stage_history and scope project activity"
```

---

## Phase 3a Done When

- [ ] `npm test` passes — 66 tests across 9 suites
- [ ] `npx tsc --noEmit` is clean inside `mobile/`
- [ ] `grep -rn "ts-expect-error" "mobile/app/(employee)/projects"` returns nothing
- [ ] `grep -rn "Soon" "mobile/app/(employee)/projects"` returns nothing
- [ ] `grep -ri "service_role\|createAdminClient" mobile/ --exclude-dir=node_modules` returns nothing
- [ ] `git diff --name-only` for the phase touches no `.sql` file and no `mobile/package.json`
- [ ] An employee can open a project → Deliverables, see the list with its revision feedback, add one, edit one, bump a version, and open a Dropbox link in the Dropbox app
- [ ] A plain employee who is not a creative sees no Edit action; an executive does
- [ ] A project's Activity lists **only that project's** stage changes, and a first move into a stage renders without a "from" clause
- [ ] The executive dashboard's Activity panel shows real recent stage changes rather than "No activity yet"
- [ ] The web project Activity page no longer lists other projects' stage changes

## Judgement calls made in this plan

- **Create and edit are routes, not modals.** This matches `tasks/new.tsx` and `tasks/[taskId].tsx` exactly, and gives back-navigation and keyboard handling for free.
- **The edit screen seeds from the list cache** rather than issuing a single-row query. The user always arrives from the list, so the cache is warm; a second query would be a second cache entry for rows we already hold.
- **The create screen's task picker reuses `useBoard`.** It already fetches this project's tasks with `id` and `title`. Phase 2's final review found the same select running under two cache keys and had it extracted; this avoids repeating that.
- **`STAGE_HISTORY_SELECT` and `describeStageChange` are shared** between the project screen and the dashboard feed. One string and one flattener, so the two surfaces cannot drift — the project screen adds only the `.eq` and a larger limit.
- **No delete.** RLS permits it for root/exec/manager, but no client has ever offered a UI, and adding one is net-new product.
- **`thumbnail_url` is stored, never rendered.** The web does the same. Rendering it would need `expo-image` and net-new design.

## Carried into later phases

- `activity_log` is still an unwritten table. This plan points both readers away from it; it does not populate or drop it. That decision belongs to whoever owns the backend.
- Phase 2's write paths remain reasoned-but-never-executed, blocked by the harness classifier on simulator form input. This plan adds two more — `createDeliverable` and `updateDeliverable`.
- `focusManager` is still not wired to `AppState`, so invalidation remains the app's only refresh mechanism. Every mutation here invalidates correctly, but the systemic fix is still outstanding.

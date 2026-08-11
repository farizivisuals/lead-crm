# Lead CRM Mobile — Phase 2: Employee Core — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** An employee can sign in on iOS and do their core day-to-day work: see their dashboard (executive or plain-employee variant), browse and create projects, open a project's detail (status, moodboard, creatives), work its task board, open a task to edit it or move it between stages, and review My Tasks.

**Architecture:** Screens are Expo Router files under `mobile/app/(employee)/`. Every read is a TanStack Query hook in `mobile/lib/queries/*.ts` that calls `supabase.from(...)` directly — no repository/service layer over Supabase. Every write is a plain async function invoked from `useMutation`, followed by `queryClient.invalidateQueries` on the narrowest affected key. All non-trivial derivation (progress reduction, stage counting, overdue, date formatting, filter derivation) lives in pure functions in `mobile/lib/data.ts` so it can be tested without rendering anything.

**Tech Stack:** Expo SDK 56 · Expo Router · `@supabase/supabase-js` · TanStack Query · React Native `FlatList` / `Modal` / `Alert` · Jest (`jest-expo`)

**Spec:** `docs/superpowers/specs/2026-08-10-mobile-app-design.md` (§7.2, §14 phase 2)
**Porting brief:** `.superpowers/sdd/phase-2-porting-brief.md` — the source of truth for every query and role rule below.
**Prior phase:** `docs/superpowers/plans/2026-08-10-mobile-phase-1-foundation.md`

## What already exists (do not rebuild)

- `mobile/lib/`: `supabase.ts` (`supabase`), `theme.ts` (`theme`), `routing.ts` (`resolveRoute`), `auth.tsx` (`AuthProvider`, `useAuth`), `recovery-link.ts`
- `mobile/components/ui/`: `Screen`, `GlassCard`, `Button`, `Input`, `Placeholder`
- `mobile/app/`: `_layout.tsx` (SessionGate using `Stack.Protected`), `+not-found.tsx` (**load-bearing — never delete**), `(auth)/*`, `(employee)/{_layout,dashboard,projects,tasks,calendar,more}.tsx`, `(client)/*`
- `@shared/rbac` → the web app's `lib/rbac.ts`; `@shared/types` → `lib/types.ts`, via the Metro `resolveRequest` intercept in `mobile/metro.config.js`.
- TanStack Query is installed and `QueryClientProvider` is already mounted in `mobile/app/_layout.tsx` with `defaultOptions: { queries: { staleTime: 30_000, retry: 1 } }`. No hooks exist yet — Task 1 creates the first ones.
- 30 tests across 7 suites, all passing. `npx tsc --noEmit` clean inside `mobile/`.

## Global Constraints

- **Never import or reference `SUPABASE_SERVICE_ROLE_KEY`, `lib/supabase/admin.ts`, or `createAdminClient` anywhere under `mobile/`.** A leak there is total database compromise.
- iOS only. **Dark theme only** — no light-mode values, no `useColorScheme`. Canvas is exactly `#06060a`. Border radius is `12`.
- Role gating uses the shared helpers from `@shared/rbac` (`isExecutive`, `ROLE_LABELS`, `PROJECT_STATUS_LABELS`, `PRIORITY_LABELS`, `DEPT_COLORS`). Never hand-roll a role comparison. UI gating is cosmetic; Postgres RLS is the actual boundary. Do not write a comment implying the UI check is what protects the data.
- **Every Supabase query in this plan is copied verbatim from the porting brief, including the embedded-relation FK-disambiguation syntax** (`department_stages!current_stage_id!inner(...)`, `employees!assigned_to(...)`, `employees!task_creatives_profile_id_fkey(...)`). Getting that syntax wrong returns silently wrong data, not an error. Do not "tidy" a select string.
- Supabase returns an embedded to-one relation as an object in some query shapes and a single-element array in others. Always funnel it through `one()` from `mobile/lib/data.ts`. Never index `[0]` directly, never assume an object.
- No new dependencies. `FlatList`, `Modal` and `Alert` from `react-native` cover every list, sheet and confirm in this phase.
- Testing is deliberately minimal: one runnable check per piece of non-trivial logic. **Do not write render tests for presentational screens.** Do test pure logic — stage counting, progress reduction, filter derivation, date maths.
- Every `useEffect` you write must carry a comment explaining why its dependency array is what it is.
- No new env vars, no new Supabase migrations, no dashboard configuration. Phase 2 depends on nothing outside this repo.

## Data-layer conventions established here (Phases 3–5 follow them)

1. **Location.** Read hooks live in `mobile/lib/queries/<domain>.ts` — one file per screen family (`projects.ts`, `tasks.ts`, `dashboard.ts`). Mutations live in the same file as the query they invalidate.
2. **Keys.** All query keys come from `mobile/lib/queries/keys.ts`. Keys are hierarchical, broadest segment first: `['project', projectId]`, `['project', projectId, 'tasks']`. Never inline a key string at a call site — invalidation across files is what makes drift expensive.
3. **Invalidation.** A mutation's `onSuccess` invalidates the narrowest key that could contain the changed row, then any list key that shows it. `revalidatePath` on web maps 1:1 onto this.
4. **No abstraction over Supabase.** `queryFn` calls `supabase.from(...)` inline. Do not build a client wrapper, a generic `useTable`, or a query-builder helper.
5. **Errors.** `queryFn` throws the Supabase error object; screens render `error.message` in a muted error row. Mutations surface failures with `Alert.alert`.

---

### Task 1: Data-layer foundation — pure helpers, query keys, shared UI primitives

Everything in this task is consumed by two or more later tasks. Nothing here renders a screen; the deliverable is a passing test suite and a clean typecheck.

**Files:**
- Create: `mobile/lib/data.ts`
- Create: `mobile/lib/__tests__/data.test.ts`
- Create: `mobile/lib/queries/keys.ts`
- Create: `mobile/components/ui/Badge.tsx`
- Create: `mobile/components/ui/ScreenHeader.tsx`
- Create: `mobile/components/ui/PickerSheet.tsx`
- Modify: `mobile/lib/auth.tsx`

**Interfaces:**
- Consumes: `supabase` (`mobile/lib/supabase.ts`), `theme` (`mobile/lib/theme.ts`), `EmployeeRole` from `@shared/types`
- Produces:
  - `one<T>(value: T | T[] | null | undefined): T | null`
  - `taskProgress(rows: TaskProgressRow[]): Record<string, { total: number; done: number }>`
  - `isTaskOverdue(dueDate: string | null, isTerminal: boolean, today?: string): boolean`
  - `countByStage<S extends StageLike>(stages: S[], tasks: { current_stage_id: string }[]): { stage: S; count: number }[]`
  - `isCreativeEmployee(employee: { role: EmployeeRole; employee_departments?: EmployeeDeptRow[] } | null | undefined): boolean`
  - `shortDate(iso: string | null): string`
  - `relativeTime(iso: string, now?: number): string`
  - `firstName(fullName: string | null | undefined): string`
  - `distinctAssignees(rows: AssigneeRow[]): { id: string; name: string }[]`
  - `distinctClientCount(rows: { projects: { client_id: string } | { client_id: string }[] | null }[]): number`
  - types `TaskProgressRow`, `Progress`, `StageLike`, `EmployeeDeptRow`, `AssigneeRow`
  - `qk` — the query-key registry from `mobile/lib/queries/keys.ts`
  - `<Badge>` — Props: `{ label: string; color?: string }`
  - `<ScreenHeader>` — Props: `{ title: string; subtitle?: string; onBack?: () => void; right?: ReactNode }`
  - `<PickerSheet>` — Props: `{ visible: boolean; title: string; options: PickerOption[]; selected?: string | null; searchable?: boolean; onSelect: (value: string) => void; onClose: () => void }`, plus `type PickerOption = { value: string; label: string; sublabel?: string; color?: string }`
  - `useAuth().employee` now also carries `employee_departments`

- [ ] **Step 1: Write the pure helpers**

`mobile/lib/data.ts`:

```ts
import type { EmployeeRole } from '@shared/types';

/**
 * Supabase returns an embedded to-one relation as a bare object in some query
 * shapes and as a single-element array in others. The web app checks
 * `Array.isArray()` defensively at every such site (porting brief §3); this is
 * that check, once. Never index `[0]` directly and never assume an object.
 */
export function one<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

export type TaskProgressRow = {
  project_id: string;
  department_stages:
    | { is_terminal: boolean }
    | { is_terminal: boolean }[]
    | null;
};

export type Progress = { total: number; done: number };

/**
 * Reduce a flat, unfiltered task list into per-project { total, done }.
 * The source query deliberately has no project filter — RLS already scopes
 * `tasks` to the projects the caller can see, so every returned row belongs to
 * a project that is also in the projects list.
 */
export function taskProgress(rows: TaskProgressRow[]): Record<string, Progress> {
  const map: Record<string, Progress> = {};
  for (const row of rows) {
    const entry = (map[row.project_id] ??= { total: 0, done: 0 });
    entry.total += 1;
    if (one(row.department_stages)?.is_terminal) entry.done += 1;
  }
  return map;
}

/**
 * Web parity (`isTaskOverdue` in components/kanban/StageBoard.tsx): a task is
 * overdue when its due date is strictly in the past AND its current stage is
 * not terminal. ISO date strings compare lexicographically, so no Date object
 * and no timezone are involved.
 */
export function isTaskOverdue(
  dueDate: string | null,
  isTerminal: boolean,
  today: string = new Date().toISOString().slice(0, 10)
): boolean {
  if (!dueDate || isTerminal) return false;
  return dueDate.slice(0, 10) < today;
}

export type StageLike = {
  id: string;
  name: string;
  position: number;
  is_terminal: boolean;
  color: string | null;
};

/**
 * Stage chips: preserves the stages' incoming order (already `.order('position')`
 * from the query) and counts the tasks currently sitting in each one.
 */
export function countByStage<S extends StageLike>(
  stages: S[],
  tasks: { current_stage_id: string }[]
): { stage: S; count: number }[] {
  return stages.map((stage) => ({
    stage,
    count: tasks.filter((t) => t.current_stage_id === stage.id).length,
  }));
}

export type EmployeeDeptRow = {
  department_id: string;
  departments?: { slug: string } | null;
};

/**
 * Port of `isCreativeEmployee()` from lib/auth/guards.ts:63-68, kept
 * semantically identical. It is NOT imported from `@shared` because guards.ts
 * imports `next/navigation`, `react.cache` and the server Supabase client,
 * none of which resolve under Metro. Mirrors `is_creative()` in migration 0019.
 * Note an executive who sits in the creatives department is NOT "creative" by
 * this helper — executives get moodboard rights via isExecutive instead.
 */
export function isCreativeEmployee(
  employee:
    | { role: EmployeeRole; employee_departments?: EmployeeDeptRow[] }
    | null
    | undefined
): boolean {
  return (
    employee?.role === 'employee' &&
    (employee.employee_departments ?? []).some(
      (d) => d.departments?.slug === 'creatives'
    )
  );
}

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

/**
 * '2026-08-11' -> 'Aug 11'. Split into calendar parts by hand rather than
 * passed through `new Date()`, because `new Date('2026-08-11')` parses as
 * midnight UTC and renders as the previous day on any device west of GMT.
 * These columns are DATE, not TIMESTAMPTZ — they have no time zone to respect.
 */
export function shortDate(iso: string | null): string {
  if (!iso) return '—';
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  if (!y || !m || !d || m < 1 || m > 12) return '—';
  return `${MONTHS[m - 1]} ${d}`;
}

/** Activity feed timestamps. `created_at` IS a timestamptz, so Date is correct here. */
export function relativeTime(iso: string, now: number = Date.now()): string {
  const mins = Math.floor(Math.max(0, now - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return `${Math.floor(days / 7)}w ago`;
}

/** Web parity: task cards show the assignee's first name only. */
export function firstName(fullName: string | null | undefined): string {
  return (fullName ?? '').split(' ')[0] || '—';
}

export type AssigneeRow = {
  assigned_to: string | null;
  employees?:
    | { profiles?: { full_name: string } | null }
    | { profiles?: { full_name: string } | null }[]
    | null;
};

/**
 * My Tasks' assignee filter is populated from the assignees actually present
 * in the fetched rows, not from a separate employees query (web parity —
 * TasksList.tsx's useMemo). Unassigned rows are excluded; the screen adds its
 * own "Unassigned" option.
 */
export function distinctAssignees(rows: AssigneeRow[]): { id: string; name: string }[] {
  const map = new Map<string, string>();
  for (const row of rows) {
    if (!row.assigned_to || map.has(row.assigned_to)) continue;
    map.set(row.assigned_to, one(row.employees)?.profiles?.full_name ?? 'Unknown');
  }
  return [...map.entries()]
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Executive dashboard, department-filtered branch: counts DISTINCT clients
 * across the department's projects. A plain row count double-counts any client
 * with two or more projects in that department (porting brief §1A item 2).
 */
export function distinctClientCount(
  rows: { projects: { client_id: string } | { client_id: string }[] | null }[]
): number {
  const ids = new Set<string>();
  for (const row of rows) {
    const clientId = one(row.projects)?.client_id;
    if (clientId) ids.add(clientId);
  }
  return ids.size;
}
```

- [ ] **Step 2: Write the tests**

`mobile/lib/__tests__/data.test.ts`:

```ts
import {
  one,
  taskProgress,
  isTaskOverdue,
  countByStage,
  isCreativeEmployee,
  shortDate,
  relativeTime,
  firstName,
  distinctAssignees,
  distinctClientCount,
} from '../data';

describe('one', () => {
  it('unwraps an array-shaped embed', () => {
    expect(one([{ a: 1 }])).toEqual({ a: 1 });
  });
  it('passes an object-shaped embed through', () => {
    expect(one({ a: 1 })).toEqual({ a: 1 });
  });
  it('returns null for empty array, null and undefined', () => {
    expect(one([])).toBeNull();
    expect(one(null)).toBeNull();
    expect(one(undefined)).toBeNull();
  });
});

describe('taskProgress', () => {
  it('counts totals and terminal-stage completions per project', () => {
    expect(
      taskProgress([
        { project_id: 'p1', department_stages: { is_terminal: false } },
        { project_id: 'p1', department_stages: [{ is_terminal: true }] },
        { project_id: 'p2', department_stages: null },
      ])
    ).toEqual({ p1: { total: 2, done: 1 }, p2: { total: 1, done: 0 } });
  });
  it('returns an empty map for no rows', () => {
    expect(taskProgress([])).toEqual({});
  });
});

describe('isTaskOverdue', () => {
  it('flags a past due date in a non-terminal stage', () => {
    expect(isTaskOverdue('2026-08-10', false, '2026-08-11')).toBe(true);
  });
  it('does not flag a terminal-stage task however old', () => {
    expect(isTaskOverdue('2020-01-01', true, '2026-08-11')).toBe(false);
  });
  it('does not flag today or the future', () => {
    expect(isTaskOverdue('2026-08-11', false, '2026-08-11')).toBe(false);
    expect(isTaskOverdue('2026-09-01', false, '2026-08-11')).toBe(false);
  });
  it('does not flag a task with no due date', () => {
    expect(isTaskOverdue(null, false, '2026-08-11')).toBe(false);
  });
});

describe('countByStage', () => {
  const stages = [
    { id: 's1', name: 'Brief', position: 0, is_terminal: false, color: null },
    { id: 's2', name: 'Done', position: 1, is_terminal: true, color: '#0f0' },
  ];
  it('counts tasks per stage and keeps stage order', () => {
    const result = countByStage(stages, [
      { current_stage_id: 's1' },
      { current_stage_id: 's2' },
      { current_stage_id: 's2' },
    ]);
    expect(result.map((r) => [r.stage.id, r.count])).toEqual([
      ['s1', 1],
      ['s2', 2],
    ]);
  });
  it('reports zero for a stage with no tasks', () => {
    expect(countByStage(stages, [])).toEqual([
      { stage: stages[0], count: 0 },
      { stage: stages[1], count: 0 },
    ]);
  });
});

describe('isCreativeEmployee', () => {
  const creativesDept = [{ department_id: 'd1', departments: { slug: 'creatives' } }];
  it('is true for a plain employee in the creatives department', () => {
    expect(isCreativeEmployee({ role: 'employee', employee_departments: creativesDept })).toBe(true);
  });
  it('is false for a manager in the creatives department', () => {
    expect(isCreativeEmployee({ role: 'manager', employee_departments: creativesDept })).toBe(false);
  });
  it('is false for an employee in another department', () => {
    expect(
      isCreativeEmployee({
        role: 'employee',
        employee_departments: [{ department_id: 'd2', departments: { slug: 'video' } }],
      })
    ).toBe(false);
  });
  it('is false with no departments loaded and for null', () => {
    expect(isCreativeEmployee({ role: 'employee' })).toBe(false);
    expect(isCreativeEmployee(null)).toBe(false);
  });
});

describe('shortDate', () => {
  it('formats a date-only string without shifting the day', () => {
    expect(shortDate('2026-08-11')).toBe('Aug 11');
    expect(shortDate('2026-01-01')).toBe('Jan 1');
    expect(shortDate('2026-12-31')).toBe('Dec 31');
  });
  it('renders an em dash for null and for garbage', () => {
    expect(shortDate(null)).toBe('—');
    expect(shortDate('not-a-date')).toBe('—');
  });
});

describe('relativeTime', () => {
  const now = Date.parse('2026-08-11T12:00:00Z');
  it('bucketises minutes, hours, days and weeks', () => {
    expect(relativeTime('2026-08-11T11:59:40Z', now)).toBe('just now');
    expect(relativeTime('2026-08-11T11:30:00Z', now)).toBe('30m ago');
    expect(relativeTime('2026-08-11T09:00:00Z', now)).toBe('3h ago');
    expect(relativeTime('2026-08-09T12:00:00Z', now)).toBe('2d ago');
    expect(relativeTime('2026-07-28T12:00:00Z', now)).toBe('2w ago');
  });
});

describe('firstName', () => {
  it('takes the first token', () => {
    expect(firstName('Ada Lovelace')).toBe('Ada');
  });
  it('falls back to an em dash', () => {
    expect(firstName(null)).toBe('—');
    expect(firstName('')).toBe('—');
  });
});

describe('distinctAssignees', () => {
  it('dedupes by id, resolves names through either embed shape, and sorts', () => {
    expect(
      distinctAssignees([
        { assigned_to: 'u2', employees: { profiles: { full_name: 'Zoe Q' } } },
        { assigned_to: 'u1', employees: [{ profiles: { full_name: 'Ada L' } }] },
        { assigned_to: 'u1', employees: [{ profiles: { full_name: 'Ada L' } }] },
        { assigned_to: null, employees: null },
      ])
    ).toEqual([
      { id: 'u1', name: 'Ada L' },
      { id: 'u2', name: 'Zoe Q' },
    ]);
  });
});

describe('distinctClientCount', () => {
  it('counts each client once even with several projects in the department', () => {
    expect(
      distinctClientCount([
        { projects: { client_id: 'c1' } },
        { projects: [{ client_id: 'c1' }] },
        { projects: { client_id: 'c2' } },
        { projects: null },
      ])
    ).toBe(2);
  });
});
```

- [ ] **Step 3: Run the tests and confirm they pass**

```bash
cd mobile && npm test
```

Expected: PASS. 8 suites total (the 7 from Phase 1, plus `data.test.ts`).

- [ ] **Step 4: Write the query-key registry**

`mobile/lib/queries/keys.ts`:

```ts
/**
 * Every query key in the app. Hierarchical, broadest segment first, so an
 * invalidation of ['project', id] also clears ['project', id, 'tasks'].
 * Never inline a key at a call site — mutations in one file invalidate keys
 * owned by another, and string drift between them fails silently.
 */
export const qk = {
  dashboardExec: (deptId: string | null) => ['dashboard', 'exec', deptId] as const,
  dashboardEmployee: (userId: string) => ['dashboard', 'employee', userId] as const,

  projects: () => ['projects'] as const,
  projectFormOptions: () => ['projects', 'form-options'] as const,

  project: (projectId: string) => ['project', projectId] as const,
  projectTasks: (projectId: string) => ['project', projectId, 'tasks'] as const,
  boardMeta: (deptIds: string[]) => ['board-meta', deptIds.join(',')] as const,

  task: (taskId: string) => ['task', taskId] as const,
  taskPickers: (projectId: string, deptId: string) =>
    ['task-pickers', projectId, deptId] as const,
  taskConflicts: (
    assignedTo: string,
    startDate: string,
    dueDate: string,
    excludeTaskId: string | null
  ) => ['task-conflicts', assignedTo, startDate, dueDate, excludeTaskId] as const,

  allTasks: () => ['tasks'] as const,
};
```

- [ ] **Step 5: Write Badge**

`mobile/components/ui/Badge.tsx`:

```tsx
import { StyleSheet, Text, View } from 'react-native';
import { theme } from '../../lib/theme';

export function Badge({ label, color }: { label: string; color?: string }) {
  const tint = color ?? theme.text.label;
  return (
    <View style={[styles.wrap, { borderColor: tint }]}>
      <Text style={[styles.text, { color: tint }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
    backgroundColor: 'rgba(255,255,255,0.04)',
    alignSelf: 'flex-start',
  },
  text: { fontSize: 11, fontWeight: '600' },
});
```

- [ ] **Step 6: Write ScreenHeader**

Pushed screens keep `headerShown: false` (Phase 1's convention) and render this
instead, so `Screen`'s safe-area padding is applied exactly once. The native
swipe-back gesture still works with the header hidden.

`mobile/components/ui/ScreenHeader.tsx`:

```tsx
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SymbolView } from 'expo-symbols';
import { theme } from '../../lib/theme';

export function ScreenHeader({
  title,
  subtitle,
  onBack,
  right,
}: {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  right?: ReactNode;
}) {
  return (
    <View style={styles.wrap}>
      {onBack && (
        <Pressable onPress={onBack} hitSlop={12} style={styles.back}>
          <SymbolView name="chevron.left" tintColor="#fff" size={18} />
        </Pressable>
      )}
      <View style={styles.titles}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={styles.subtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingBottom: 4 },
  back: { paddingVertical: 4, paddingRight: 2 },
  titles: { flex: 1 },
  title: { color: '#fff', fontSize: 22, fontWeight: '700', letterSpacing: -0.5 },
  subtitle: { color: theme.text.dim, fontSize: 13, marginTop: 2 },
});
```

- [ ] **Step 7: Write PickerSheet**

One component covers every selection surface in this phase: the dashboard
department filter, the client picker, the stage picker, the assignee picker and
the status picker. Radix `Select`/`Popover` on web are widget details, not
behaviour (porting brief, cross-cutting table) — open/close plus single-select
is all that has to survive.

`mobile/components/ui/PickerSheet.tsx`:

```tsx
import { useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SymbolView } from 'expo-symbols';
import { BlurView } from 'expo-blur';
import { theme } from '../../lib/theme';

export type PickerOption = {
  value: string;
  label: string;
  sublabel?: string;
  color?: string;
};

export function PickerSheet({
  visible,
  title,
  options,
  selected,
  searchable = false,
  onSelect,
  onClose,
}: {
  visible: boolean;
  title: string;
  options: PickerOption[];
  selected?: string | null;
  searchable?: boolean;
  onSelect: (value: string) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState('');
  const needle = query.trim().toLowerCase();
  const shown = needle
    ? options.filter((o) => o.label.toLowerCase().includes(needle))
    : options;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={styles.sheet}>
        <BlurView intensity={60} tint="dark" style={StyleSheet.absoluteFill} />
        <View style={styles.sheetInner}>
          <Text style={styles.title}>{title}</Text>
          {searchable && (
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search"
              placeholderTextColor={theme.text.dimmer}
              autoCapitalize="none"
              style={styles.search}
            />
          )}
          <FlatList
            data={shown}
            keyExtractor={(o) => o.value}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={<Text style={styles.empty}>No matches</Text>}
            renderItem={({ item }) => (
              <Pressable
                style={styles.row}
                onPress={() => {
                  setQuery('');
                  onSelect(item.value);
                }}
              >
                {item.color ? (
                  <View style={[styles.dot, { backgroundColor: item.color }]} />
                ) : null}
                <View style={styles.rowText}>
                  <Text style={styles.label}>{item.label}</Text>
                  {item.sublabel ? (
                    <Text style={styles.sublabel}>{item.sublabel}</Text>
                  ) : null}
                </View>
                {selected === item.value && (
                  <SymbolView name="checkmark" tintColor="#fff" size={16} />
                )}
              </Pressable>
            )}
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet: {
    maxHeight: '70%',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: 1,
    borderColor: theme.colors.borderMd,
    overflow: 'hidden',
    backgroundColor: theme.colors.background,
  },
  sheetInner: { padding: 20, paddingBottom: 36, gap: 12 },
  title: { color: '#fff', fontSize: 17, fontWeight: '700' },
  search: {
    height: 40,
    borderRadius: theme.radius,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: 'rgba(255,255,255,0.05)',
    paddingHorizontal: 12,
    color: '#fff',
    fontSize: 14,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
  },
  rowText: { flex: 1 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  label: { color: theme.colors.foreground, fontSize: 15 },
  sublabel: { color: theme.text.dim, fontSize: 12, marginTop: 2 },
  empty: { color: theme.text.dimmer, fontSize: 13, paddingVertical: 16 },
});
```

- [ ] **Step 8: Extend the auth profile fetch with department membership**

`isCreativeEmployee` needs `employee_departments`; Phase 1 only selected `role`.
In `mobile/lib/auth.tsx` make exactly two changes and touch nothing else — in
particular **do not modify the profile effect's dependency array**, which is
deliberately keyed on `session?.user?.id` rather than `session` (a whole-object
key re-runs on every hourly `TOKEN_REFRESHED` and remounts the navigator).

Change the `EmployeeRow` type from:

```ts
type EmployeeRow = { role: EmployeeRole };
```

to:

```ts
type EmployeeRow = {
  role: EmployeeRole;
  // Needed by isCreativeEmployee() in lib/data.ts — a plain employee in the
  // creatives department may edit project moodboards.
  employee_departments?: { department_id: string; departments?: { slug: string } | null }[];
};
```

and change the select string on line 148 from:

```ts
.select('id, full_name, user_type, employees(role)')
```

to:

```ts
.select('id, full_name, user_type, employees(role, employee_departments(department_id, departments(slug)))')
```

- [ ] **Step 9: Verify**

```bash
cd mobile && npx tsc --noEmit && npm test
```

Expected: no type errors; all suites pass. Then `npx expo start --clear`, sign in
as an employee and confirm the More tab still renders the correct role label —
that proves the widened profile select still returns a row rather than erroring.

- [ ] **Step 10: Commit**

```bash
git add mobile/lib/data.ts mobile/lib/__tests__/data.test.ts mobile/lib/queries mobile/components/ui mobile/lib/auth.tsx
git commit -m "feat(mobile): add phase 2 data helpers, query keys and shared UI primitives"
```

---

### Task 2: Projects list and New Project

Ports `app/(admin)/admin/projects/page.tsx` and `NewProjectDialog.tsx`.

The tab entry `mobile/app/(employee)/projects.tsx` becomes a directory with a
nested `Stack`, so project detail and the task board can be pushed inside the
Projects tab. The tab bar's `Tabs.Screen name="projects"` in
`mobile/app/(employee)/_layout.tsx` already matches the directory — that file
needs no edit.

**Files:**
- Delete: `mobile/app/(employee)/projects.tsx`
- Create: `mobile/app/(employee)/projects/_layout.tsx`
- Create: `mobile/app/(employee)/projects/index.tsx`
- Create: `mobile/app/(employee)/projects/new.tsx`
- Create: `mobile/lib/queries/projects.ts`

**Interfaces:**
- Consumes: `supabase`, `theme`, `Screen`, `GlassCard`, `Button`, `Input`, `Badge`, `ScreenHeader`, `PickerSheet` (+ `PickerOption`), `useAuth`, `qk`, and from `mobile/lib/data.ts`: `one`, `taskProgress`, `shortDate`, `type Progress`, `type TaskProgressRow`. `isExecutive`, `PROJECT_STATUS_LABELS`, `DEPT_COLORS` from `@shared/rbac`.
- Produces:
  - routes `/projects` and `/projects/new`
  - `useProjectsList(): UseQueryResult<{ projects: ProjectListRow[]; progress: Record<string, Progress> }>`
  - `useProjectFormOptions(): UseQueryResult<{ clients: ClientOption[]; departments: DepartmentOption[]; creatives: CreativeOption[] }>`
  - `createProject(input: CreateProjectInput): Promise<string>` — resolves to the new project id
  - types `ProjectListRow`, `ClientOption`, `DepartmentOption`, `CreativeOption`, `CreateProjectInput`

- [ ] **Step 1: Write the projects query module**

The web page runs all five queries in one server render. On mobile the three
form-only queries (clients, departments, creatives) move into their own hook so
the list screen doesn't pay for them — the query text is unchanged, only which
screen runs it. Both hooks' select strings are verbatim from porting brief §2.

`mobile/lib/queries/projects.ts`:

```ts
import { useQuery } from '@tanstack/react-query';
import type { ProjectStatus } from '@shared/types';
import { supabase } from '../supabase';
import { qk } from './keys';
import { taskProgress, type Progress, type TaskProgressRow } from '../data';

export type ProjectListRow = {
  id: string;
  name: string;
  description: string | null;
  status: ProjectStatus;
  target_end_date: string | null;
  updated_at: string;
  clients: { company_name: string } | { company_name: string }[] | null;
  project_departments:
    | { department_id: string; is_primary: boolean; departments: { name: string; slug: string } | { name: string; slug: string }[] | null }[]
    | null;
};

export function useProjectsList() {
  return useQuery({
    queryKey: qk.projects(),
    queryFn: async (): Promise<{
      projects: ProjectListRow[];
      progress: Record<string, Progress>;
    }> => {
      const [projectsRes, tasksRes] = await Promise.all([
        supabase
          .from('projects')
          .select('*, clients(company_name), project_departments(*, departments(name, slug))')
          .order('updated_at', { ascending: false }),
        // Deliberately unfiltered, exactly as the web query: RLS already scopes
        // `tasks` to the same visible projects, so the client reduces the whole
        // result into a per-project progress map. Do not add a project filter.
        supabase.from('tasks').select('project_id, department_stages(is_terminal)'),
      ]);
      if (projectsRes.error) throw projectsRes.error;
      if (tasksRes.error) throw tasksRes.error;
      return {
        projects: (projectsRes.data ?? []) as unknown as ProjectListRow[],
        progress: taskProgress((tasksRes.data ?? []) as unknown as TaskProgressRow[]),
      };
    },
  });
}

export type ClientOption = { id: string; company_name: string };
export type DepartmentOption = { id: string; name: string; slug: string };
export type CreativeOption = { profile_id: string; full_name: string };

export function useProjectFormOptions() {
  return useQuery({
    queryKey: qk.projectFormOptions(),
    queryFn: async () => {
      const [clientsRes, deptsRes, creativesRes] = await Promise.all([
        supabase.from('clients').select('id, company_name').order('company_name'),
        supabase.from('departments').select('*').order('name'),
        supabase
          .from('employees')
          .select('profile_id, profiles(full_name), employee_departments!inner(departments!inner(slug))')
          .eq('employee_departments.departments.slug', 'creatives'),
      ]);
      if (clientsRes.error) throw clientsRes.error;
      if (deptsRes.error) throw deptsRes.error;
      if (creativesRes.error) throw creativesRes.error;
      return {
        clients: (clientsRes.data ?? []) as ClientOption[],
        departments: (deptsRes.data ?? []) as DepartmentOption[],
        creatives: (creativesRes.data ?? []).map((row: any) => ({
          profile_id: row.profile_id as string,
          full_name:
            (Array.isArray(row.profiles) ? row.profiles[0] : row.profiles)?.full_name ??
            'Unknown',
        })) as CreativeOption[],
      };
    },
  });
}

export type CreateProjectInput = {
  client_id: string;
  name: string;
  description: string;
  status: ProjectStatus;
  start_date: string;
  target_end_date: string;
  /** Order matters: the FIRST entry becomes the primary department. */
  departmentIds: string[];
  creativeProfileIds: string[];
  userId: string;
};

/**
 * Three sequential writes with manual rollback, matching NewProjectDialog.tsx.
 * There is no transaction or RPC on the web either — if the department or
 * creative insert fails, the just-created project row is deleted rather than
 * left half-formed. Reproduce that, including the ordering.
 */
export async function createProject(input: CreateProjectInput): Promise<string> {
  const { data: project, error: projectError } = await supabase
    .from('projects')
    .insert({
      client_id: input.client_id,
      name: input.name,
      description: input.description || null,
      status: input.status,
      start_date: input.start_date || null,
      target_end_date: input.target_end_date || null,
      owner_profile_id: input.userId,
      created_by: input.userId,
    })
    .select()
    .single();
  if (projectError || !project) throw projectError ?? new Error('Project insert returned no row');

  const projectId = project.id as string;

  const { error: deptError } = await supabase.from('project_departments').insert(
    input.departmentIds.map((dept_id, i) => ({
      project_id: projectId,
      department_id: dept_id,
      // First selected department is primary — order-dependent, so the picker
      // must preserve selection order (see the screen's toggle helper).
      is_primary: i === 0,
    }))
  );
  if (deptError) {
    await supabase.from('projects').delete().eq('id', projectId);
    throw deptError;
  }

  if (input.creativeProfileIds.length > 0) {
    const { error: creativesError } = await supabase.from('project_creatives').insert(
      input.creativeProfileIds.map((profile_id) => ({ project_id: projectId, profile_id }))
    );
    if (creativesError) {
      await supabase.from('projects').delete().eq('id', projectId);
      throw creativesError;
    }
  }

  return projectId;
}
```

- [ ] **Step 2: Replace the projects tab file with a nested stack**

```bash
cd mobile && rm "app/(employee)/projects.tsx" && mkdir -p "app/(employee)/projects"
```

`mobile/app/(employee)/projects/_layout.tsx`:

```tsx
import { Stack } from 'expo-router';
import { theme } from '../../../lib/theme';

export default function ProjectsLayout() {
  // headerShown stays false and screens render <ScreenHeader> themselves, so
  // <Screen>'s safe-area padding is applied exactly once. Swipe-back still
  // works with the native header hidden.
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.colors.background },
      }}
    />
  );
}
```

- [ ] **Step 3: Write the projects list screen**

`mobile/app/(employee)/projects/index.tsx`:

```tsx
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { isExecutive, PROJECT_STATUS_LABELS, DEPT_COLORS } from '@shared/rbac';
import { Screen } from '../../../components/ui/Screen';
import { GlassCard } from '../../../components/ui/GlassCard';
import { Badge } from '../../../components/ui/Badge';
import { ScreenHeader } from '../../../components/ui/ScreenHeader';
import { useAuth } from '../../../lib/auth';
import { one, shortDate } from '../../../lib/data';
import { useProjectsList, type ProjectListRow } from '../../../lib/queries/projects';
import { theme } from '../../../lib/theme';

export default function ProjectsScreen() {
  const router = useRouter();
  const { employee } = useAuth();
  const canManage = isExecutive(employee?.role ?? 'employee');
  const { data, isLoading, error } = useProjectsList();

  function openProject(projectId: string) {
    // @ts-expect-error — the /projects/[projectId] route does not exist until
    // Task 3 creates it. Delete this directive (not the call) in Task 3.
    router.push({ pathname: '/projects/[projectId]', params: { projectId } });
  }

  return (
    <Screen>
      <FlatList
        contentContainerStyle={styles.list}
        data={data?.projects ?? []}
        keyExtractor={(p) => p.id}
        ListHeaderComponent={
          <ScreenHeader
            title="Projects"
            right={
              canManage ? (
                <Pressable onPress={() => router.push('/projects/new')} hitSlop={10}>
                  <Text style={styles.newButton}>New</Text>
                </Pressable>
              ) : undefined
            }
          />
        }
        ListEmptyComponent={
          isLoading ? (
            <Text style={styles.muted}>Loading…</Text>
          ) : error ? (
            <Text style={styles.error}>{error.message}</Text>
          ) : (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>No projects yet</Text>
              <Text style={styles.muted}>Projects you can see will appear here.</Text>
            </View>
          )
        }
        renderItem={({ item }) => (
          <ProjectCard
            project={item}
            progress={data?.progress[item.id]}
            onPress={() => openProject(item.id)}
          />
        )}
      />
    </Screen>
  );
}

function ProjectCard({
  project,
  progress,
  onPress,
}: {
  project: ProjectListRow;
  progress?: { total: number; done: number };
  onPress: () => void;
}) {
  const client = one(project.clients)?.company_name ?? '—';
  const depts = (project.project_departments ?? [])
    .map((pd) => one(pd.departments))
    .filter((d): d is { name: string; slug: string } => !!d);
  const pct = progress && progress.total > 0
    ? Math.round((progress.done / progress.total) * 100)
    : 0;

  return (
    <Pressable onPress={onPress}>
      <GlassCard>
        <View style={styles.cardTop}>
          <Text style={styles.cardTitle} numberOfLines={1}>
            {project.name}
          </Text>
          <Badge label={PROJECT_STATUS_LABELS[project.status]} />
        </View>
        <Text style={styles.client}>{client}</Text>
        {project.description ? (
          <Text style={styles.description} numberOfLines={1}>
            {project.description}
          </Text>
        ) : null}

        <View style={styles.chips}>
          {depts.map((d) => (
            <Badge key={d.slug} label={d.name} color={DEPT_COLORS[d.slug]} />
          ))}
          <Text style={styles.due}>Due {shortDate(project.target_end_date)}</Text>
        </View>

        {progress && progress.total > 0 ? (
          <View style={styles.progressWrap}>
            <View style={styles.track}>
              <View style={[styles.fill, { width: `${pct}%` }]} />
            </View>
            <Text style={styles.progressText}>
              {progress.done} / {progress.total} tasks done
            </Text>
          </View>
        ) : null}
      </GlassCard>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  list: { padding: 20, gap: 12, paddingBottom: 120 },
  newButton: { color: '#fff', fontSize: 15, fontWeight: '600' },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardTitle: { color: '#fff', fontSize: 16, fontWeight: '600', flex: 1 },
  client: { color: theme.text.label, fontSize: 13, marginTop: 4 },
  description: { color: theme.text.dim, fontSize: 13, marginTop: 6 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6, marginTop: 10 },
  due: { color: theme.text.dimmer, fontSize: 12 },
  progressWrap: { marginTop: 12, gap: 6 },
  track: { height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.08)' },
  fill: { height: 4, borderRadius: 2, backgroundColor: '#fafafa' },
  progressText: { color: theme.text.dimmer, fontSize: 11 },
  empty: { alignItems: 'center', gap: 6, paddingVertical: 60 },
  emptyTitle: { color: '#fff', fontSize: 16, fontWeight: '600' },
  muted: { color: theme.text.dim, fontSize: 13, textAlign: 'center' },
  error: { color: '#f87171', fontSize: 13, textAlign: 'center', paddingVertical: 40 },
});
```

- [ ] **Step 4: Write the New Project screen**

Required fields match the web: `client_id`, `name`, and at least one department.
Dates are plain `YYYY-MM-DD` text inputs — the web uses `<input type="date">`,
and a native date picker is deferred rather than pulling in a dependency for two
optional fields. Note that in the plan's "Carried into later phases" list.

`mobile/app/(employee)/projects/new.tsx`:

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
import { useRouter } from 'expo-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { ProjectStatus } from '@shared/types';
import { PROJECT_STATUS_LABELS, DEPT_COLORS } from '@shared/rbac';
import { Screen } from '../../../components/ui/Screen';
import { GlassCard } from '../../../components/ui/GlassCard';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { ScreenHeader } from '../../../components/ui/ScreenHeader';
import { PickerSheet } from '../../../components/ui/PickerSheet';
import { useAuth } from '../../../lib/auth';
import { qk } from '../../../lib/queries/keys';
import {
  createProject,
  useProjectFormOptions,
} from '../../../lib/queries/projects';
import { theme } from '../../../lib/theme';

const STATUSES: ProjectStatus[] = ['planning', 'active', 'on_hold', 'completed', 'cancelled'];

export default function NewProjectScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { session } = useAuth();
  const { data: options, isLoading } = useProjectFormOptions();

  const [clientId, setClientId] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<ProjectStatus>('planning');
  const [startDate, setStartDate] = useState('');
  const [targetEndDate, setTargetEndDate] = useState('');
  // An ORDERED list, not a Set: the first entry becomes the primary department.
  const [deptIds, setDeptIds] = useState<string[]>([]);
  const [creativeIds, setCreativeIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [picker, setPicker] = useState<'client' | 'status' | null>(null);

  const clientName =
    options?.clients.find((c) => c.id === clientId)?.company_name ?? 'Select a client';

  function toggle(list: string[], set: (v: string[]) => void, id: string) {
    // Append on select so selection order survives — createProject marks
    // departmentIds[0] as primary.
    set(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  }

  const mutation = useMutation({
    mutationFn: createProject,
    onSuccess: (projectId) => {
      queryClient.invalidateQueries({ queryKey: qk.projects() });
      // @ts-expect-error — the /projects/[projectId] route does not exist until
      // Task 3 creates it. Delete this directive (not the call) in Task 3.
      router.replace({ pathname: '/projects/[projectId]', params: { projectId } });
    },
    onError: (e: Error) => Alert.alert('Could not create project', e.message),
  });

  function submit() {
    if (!clientId) return setError('Select a client');
    if (!name.trim()) return setError('Enter a project name');
    if (deptIds.length === 0) return setError('Select at least one department');
    if (!session?.user.id) return setError('No active session');
    setError(null);
    mutation.mutate({
      client_id: clientId,
      name: name.trim(),
      description,
      status,
      start_date: startDate,
      target_end_date: targetEndDate,
      departmentIds: deptIds,
      creativeProfileIds: creativeIds,
      userId: session.user.id,
    });
  }

  return (
    <Screen>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <ScreenHeader title="New project" onBack={() => router.back()} />

          <GlassCard>
            <View style={styles.form}>
              <Pressable onPress={() => setPicker('client')}>
                <Text style={styles.label}>CLIENT</Text>
                <Text style={clientId ? styles.value : styles.placeholder}>{clientName}</Text>
              </Pressable>

              <Input label="Name" value={name} onChangeText={setName} placeholder="Campaign name" />
              <Input
                label="Description"
                value={description}
                onChangeText={setDescription}
                placeholder="Optional"
              />

              <Pressable onPress={() => setPicker('status')}>
                <Text style={styles.label}>STATUS</Text>
                <Text style={styles.value}>{PROJECT_STATUS_LABELS[status]}</Text>
              </Pressable>

              <Input
                label="Start date"
                value={startDate}
                onChangeText={setStartDate}
                placeholder="YYYY-MM-DD"
              />
              <Input
                label="Target end date"
                value={targetEndDate}
                onChangeText={setTargetEndDate}
                placeholder="YYYY-MM-DD"
              />
            </View>
          </GlassCard>

          <GlassCard>
            <Text style={styles.label}>DEPARTMENTS</Text>
            <Text style={styles.hint}>The first one you pick becomes the primary department.</Text>
            <View style={styles.chipRow}>
              {(options?.departments ?? []).map((d) => {
                const index = deptIds.indexOf(d.id);
                const on = index >= 0;
                return (
                  <Pressable
                    key={d.id}
                    onPress={() => toggle(deptIds, setDeptIds, d.id)}
                    style={[
                      styles.chip,
                      on && { borderColor: DEPT_COLORS[d.slug] ?? '#fff', backgroundColor: 'rgba(255,255,255,0.10)' },
                    ]}
                  >
                    <Text style={[styles.chipText, on && styles.chipTextOn]}>
                      {index === 0 ? `${d.name} · primary` : d.name}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </GlassCard>

          <GlassCard>
            <Text style={styles.label}>CREATIVES</Text>
            <View style={styles.chipRow}>
              {(options?.creatives ?? []).map((c) => {
                const on = creativeIds.includes(c.profile_id);
                return (
                  <Pressable
                    key={c.profile_id}
                    onPress={() => toggle(creativeIds, setCreativeIds, c.profile_id)}
                    style={[styles.chip, on && styles.chipOn]}
                  >
                    <Text style={[styles.chipText, on && styles.chipTextOn]}>{c.full_name}</Text>
                  </Pressable>
                );
              })}
              {!isLoading && (options?.creatives.length ?? 0) === 0 && (
                <Text style={styles.hint}>No creatives available.</Text>
              )}
            </View>
          </GlassCard>

          {error && <Text style={styles.error}>{error}</Text>}

          <Button title="Create project" onPress={submit} loading={mutation.isPending} />
        </ScrollView>
      </KeyboardAvoidingView>

      <PickerSheet
        visible={picker === 'client'}
        title="Client"
        searchable
        selected={clientId}
        options={(options?.clients ?? []).map((c) => ({ value: c.id, label: c.company_name }))}
        onSelect={(v) => {
          setClientId(v);
          setPicker(null);
        }}
        onClose={() => setPicker(null)}
      />
      <PickerSheet
        visible={picker === 'status'}
        title="Status"
        selected={status}
        options={STATUSES.map((s) => ({ value: s, label: PROJECT_STATUS_LABELS[s] }))}
        onSelect={(v) => {
          setStatus(v as ProjectStatus);
          setPicker(null);
        }}
        onClose={() => setPicker(null)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { padding: 20, gap: 16, paddingBottom: 140 },
  form: { gap: 16 },
  label: {
    fontSize: 11,
    fontWeight: '500',
    color: theme.text.label,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  hint: { color: theme.text.dimmer, fontSize: 12, marginTop: 4 },
  value: { color: '#fff', fontSize: 15, marginTop: 6 },
  placeholder: { color: theme.text.dimmer, fontSize: 15, marginTop: 6 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  chip: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  chipOn: { borderColor: '#fafafa', backgroundColor: 'rgba(255,255,255,0.10)' },
  chipText: { color: theme.text.dim, fontSize: 13 },
  chipTextOn: { color: '#fff', fontWeight: '600' },
  error: { color: '#f87171', fontSize: 13 },
});
```

- [ ] **Step 5: Verify**

```bash
cd mobile && npx tsc --noEmit && npm test && npx expo start --clear
```

Expected: clean typecheck (the two `@ts-expect-error` directives are *used*, so
they neither error nor warn) and all suites still passing. In the simulator:

1. Sign in as an **executive** → Projects tab lists projects newest-updated first, with client name, department chips and a progress bar on any project that has tasks. A "New" action shows in the header.
2. Tap a project card → routes to a not-found screen. That is the expected state until Task 3.
3. Tap **New**, submit with no client → "Select a client". Fill client + name, no department → "Select at least one department".
4. Create a project with two departments and one creative → it appears at the top of the list on return, and in Supabase `project_departments` the first-picked department has `is_primary = true`.
5. Sign in as a **plain employee** → the same list renders (RLS scopes it) and no "New" action is shown.

- [ ] **Step 6: Commit**

```bash
git add mobile/app/\(employee\)/projects mobile/lib/queries/projects.ts
git commit -m "feat(mobile): add projects list and new project screen"
```

---

### Task 3: Project detail — status, moodboard, creatives

Ports `app/(admin)/admin/projects/[projectId]/page.tsx` plus its
`ProjectStatusSelect`, `MoodboardEditor`, `ProjectCreatives` children and
`actions.ts`.

Two independent role gates apply here and they are **not** the same:
`canManage = isExecutive(role)` controls the status control and the whole
creatives row; `canEditMoodboard = canManage || isCreativeEmployee(employee)`
controls only the moodboard field. A plain employee in the creatives department
can edit the moodboard but must never see the creatives-assignment row.

**Files:**
- Create: `mobile/app/(employee)/projects/[projectId]/index.tsx`
- Create: `mobile/lib/queries/project-detail.ts`
- Modify: `mobile/app/(employee)/projects/index.tsx` (remove one `@ts-expect-error`)
- Modify: `mobile/app/(employee)/projects/new.tsx` (remove one `@ts-expect-error`)

**Interfaces:**
- Consumes: `supabase`, `theme`, `Screen`, `GlassCard`, `Button`, `Input`, `Badge`, `ScreenHeader`, `PickerSheet`, `useAuth`, `qk`, and from `mobile/lib/data.ts`: `one`, `taskProgress`, `shortDate`, `type TaskProgressRow`. `isExecutive`, `PROJECT_STATUS_LABELS`, `DEPT_COLORS` from `@shared/rbac`.
- Produces:
  - route `/projects/[projectId]`
  - `useProjectDetail(projectId: string): UseQueryResult<ProjectDetail>`
  - `updateProjectStatus(projectId: string, status: ProjectStatus): Promise<void>`
  - `updateMoodboardUrl(projectId: string, url: string | null): Promise<void>`
  - `addProjectCreative(projectId: string, profileId: string): Promise<void>`
  - `removeProjectCreative(projectId: string, profileId: string): Promise<void>`
  - type `ProjectDetail`

- [ ] **Step 1: Write the project-detail query module**

All five selects are verbatim from porting brief §3. `updateMoodboardUrl` must
go through the `set_project_moodboard` RPC and **not** a plain
`.update()` on `projects` — the RPC is `SECURITY DEFINER`
(migration `0014_role_access_restrictions.sql:132-140`) and is the only path by
which a creative is permitted to write that column.

`mobile/lib/queries/project-detail.ts`:

```ts
import { useQuery } from '@tanstack/react-query';
import type { ProjectStatus } from '@shared/types';
import { supabase } from '../supabase';
import { qk } from './keys';
import { taskProgress, type TaskProgressRow } from '../data';

export type ProjectDetail = {
  project: {
    id: string;
    name: string;
    description: string | null;
    status: ProjectStatus;
    start_date: string | null;
    target_end_date: string | null;
    moodboard_url: string | null;
    clients: { company_name: string } | { company_name: string }[] | null;
    project_departments:
      | {
          department_id: string;
          is_primary: boolean;
          departments: { name: string; slug: string } | { name: string; slug: string }[] | null;
        }[]
      | null;
  };
  progress: { total: number; done: number };
  deliverableCount: number;
  assignedCreatives: { profile_id: string; full_name: string }[];
  availableCreatives: { profile_id: string; full_name: string }[];
};

function creativeName(row: any): string {
  const employee = Array.isArray(row.employees) ? row.employees[0] : row.employees;
  const profiles = Array.isArray(employee?.profiles) ? employee.profiles[0] : employee?.profiles;
  return profiles?.full_name ?? 'Unknown';
}

function employeeName(row: any): string {
  const profiles = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
  return profiles?.full_name ?? 'Unknown';
}

export function useProjectDetail(projectId: string) {
  return useQuery({
    queryKey: qk.project(projectId),
    queryFn: async (): Promise<ProjectDetail> => {
      const [projectRes, tasksRes, deliverablesRes, assignedRes, allCreativesRes] =
        await Promise.all([
          supabase
            .from('projects')
            .select('*, clients(company_name), project_departments(*, departments(name, slug))')
            .eq('id', projectId)
            .single(),
          supabase
            .from('tasks')
            .select('department_stages(is_terminal)')
            .eq('project_id', projectId),
          supabase
            .from('deliverables')
            .select('*', { count: 'exact', head: true })
            .eq('project_id', projectId),
          supabase
            .from('project_creatives')
            .select('profile_id, employees(profiles(full_name))')
            .eq('project_id', projectId),
          supabase
            .from('employees')
            .select('profile_id, profiles(full_name), employee_departments!inner(departments!inner(slug))')
            .eq('employee_departments.departments.slug', 'creatives'),
        ]);

      if (projectRes.error) throw projectRes.error;
      if (!projectRes.data) throw new Error('Project not found');
      if (tasksRes.error) throw tasksRes.error;
      if (deliverablesRes.error) throw deliverablesRes.error;
      if (assignedRes.error) throw assignedRes.error;
      if (allCreativesRes.error) throw allCreativesRes.error;

      // The task rows carry no project_id (the query is already .eq'd to this
      // project), so key them under `projectId` to reuse the same reducer the
      // projects list uses.
      const progressRows = (tasksRes.data ?? []).map((row: any) => ({
        project_id: projectId,
        department_stages: row.department_stages,
      })) as TaskProgressRow[];

      const assigned = (assignedRes.data ?? []).map((row: any) => ({
        profile_id: row.profile_id as string,
        full_name: creativeName(row),
      }));
      const assignedIds = new Set(assigned.map((c) => c.profile_id));

      return {
        project: projectRes.data as unknown as ProjectDetail['project'],
        progress: taskProgress(progressRows)[projectId] ?? { total: 0, done: 0 },
        deliverableCount: deliverablesRes.count ?? 0,
        assignedCreatives: assigned,
        availableCreatives: (allCreativesRes.data ?? [])
          .map((row: any) => ({
            profile_id: row.profile_id as string,
            full_name: employeeName(row),
          }))
          .filter((c) => !assignedIds.has(c.profile_id)),
      };
    },
  });
}

/** Web parity: the server action skips a no-op, then plain-updates one column. */
export async function updateProjectStatus(projectId: string, status: ProjectStatus) {
  const { error } = await supabase.from('projects').update({ status }).eq('id', projectId);
  if (error) throw error;
}

/**
 * Must stay an RPC. `set_project_moodboard` is SECURITY DEFINER and re-checks
 * `is_executive() OR (is_creative() AND can_see_project(id))` server-side; it
 * exists precisely so creatives can write this one column, which the general
 * projects-update policy denies them. A plain .update() here fails for every
 * creative.
 */
export async function updateMoodboardUrl(projectId: string, url: string | null) {
  const { error } = await supabase.rpc('set_project_moodboard', {
    p_project_id: projectId,
    p_url: url,
  });
  if (error) throw error;
}

export async function addProjectCreative(projectId: string, profileId: string) {
  const { error } = await supabase
    .from('project_creatives')
    .insert({ project_id: projectId, profile_id: profileId });
  if (error) throw error;
}

export async function removeProjectCreative(projectId: string, profileId: string) {
  const { error } = await supabase
    .from('project_creatives')
    .delete()
    .eq('project_id', projectId)
    .eq('profile_id', profileId);
  if (error) throw error;
}
```

- [ ] **Step 2: Write the project detail screen**

The status control is optimistic with a targeted rollback, matching the web's
`useTransition` behaviour: the badge shows the new status immediately and snaps
back with an alert if the write fails. The moodboard is edit-in-place with no
optimistic state (web parity — it only calls `setUrl` after success).

`mobile/app/(employee)/projects/[projectId]/index.tsx`:

```tsx
import { useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { ProjectStatus } from '@shared/types';
import { isExecutive, PROJECT_STATUS_LABELS, DEPT_COLORS } from '@shared/rbac';
import { Screen } from '../../../../components/ui/Screen';
import { GlassCard } from '../../../../components/ui/GlassCard';
import { Button } from '../../../../components/ui/Button';
import { Input } from '../../../../components/ui/Input';
import { Badge } from '../../../../components/ui/Badge';
import { ScreenHeader } from '../../../../components/ui/ScreenHeader';
import { PickerSheet } from '../../../../components/ui/PickerSheet';
import { useAuth } from '../../../../lib/auth';
import { one, shortDate, isCreativeEmployee } from '../../../../lib/data';
import { qk } from '../../../../lib/queries/keys';
import {
  useProjectDetail,
  updateProjectStatus,
  updateMoodboardUrl,
  addProjectCreative,
  removeProjectCreative,
} from '../../../../lib/queries/project-detail';
import { theme } from '../../../../lib/theme';

const STATUSES: ProjectStatus[] = ['planning', 'active', 'on_hold', 'completed', 'cancelled'];

export default function ProjectDetailScreen() {
  const { projectId } = useLocalSearchParams<{ projectId: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { employee } = useAuth();

  const canManage = isExecutive(employee?.role ?? 'employee');
  const canEditMoodboard = canManage || isCreativeEmployee(employee);

  const { data, isLoading, error } = useProjectDetail(projectId);

  // Optimistic mirror of the persisted status; null means "show the server's".
  const [pendingStatus, setPendingStatus] = useState<ProjectStatus | null>(null);
  const [statusPickerOpen, setStatusPickerOpen] = useState(false);
  const [creativePickerOpen, setCreativePickerOpen] = useState(false);
  const [editingMoodboard, setEditingMoodboard] = useState(false);
  const [moodboardDraft, setMoodboardDraft] = useState('');

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: qk.project(projectId) });

  const statusMutation = useMutation({
    mutationFn: (status: ProjectStatus) => updateProjectStatus(projectId, status),
    onSuccess: () => {
      setPendingStatus(null);
      invalidate();
      queryClient.invalidateQueries({ queryKey: qk.projects() });
    },
    onError: (e: Error) => {
      setPendingStatus(null); // targeted rollback: only this field reverts
      Alert.alert('Could not update status', e.message);
    },
  });

  const moodboardMutation = useMutation({
    mutationFn: (url: string | null) => updateMoodboardUrl(projectId, url),
    onSuccess: () => {
      setEditingMoodboard(false);
      invalidate();
    },
    onError: (e: Error) => Alert.alert('Could not save moodboard', e.message),
  });

  const addCreativeMutation = useMutation({
    mutationFn: (profileId: string) => addProjectCreative(projectId, profileId),
    onSuccess: invalidate,
    onError: (e: Error) => Alert.alert('Could not add creative', e.message),
  });

  const removeCreativeMutation = useMutation({
    mutationFn: (profileId: string) => removeProjectCreative(projectId, profileId),
    onSuccess: invalidate,
    onError: (e: Error) => Alert.alert('Could not remove creative', e.message),
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
  if (error || !data) {
    return (
      <Screen>
        <View style={styles.centered}>
          <Text style={styles.error}>{error?.message ?? 'Project not found'}</Text>
          <Button title="Back to projects" variant="ghost" onPress={() => router.back()} />
        </View>
      </Screen>
    );
  }

  const { project, progress, deliverableCount, assignedCreatives, availableCreatives } = data;
  const clientName = one(project.clients)?.company_name ?? '—';
  const status = pendingStatus ?? project.status;
  const depts = (project.project_departments ?? [])
    .map((pd) => one(pd.departments))
    .filter((d): d is { name: string; slug: string } => !!d);

  function chooseStatus(next: string) {
    setStatusPickerOpen(false);
    if (next === project.status) return; // web parity: skip the no-op write
    setPendingStatus(next as ProjectStatus); // optimistic
    statusMutation.mutate(next as ProjectStatus);
  }

  function openTasks() {
    // @ts-expect-error — the /projects/[projectId]/tasks route does not exist
    // until Task 4 creates it. Delete this directive (not the call) in Task 4.
    router.push({ pathname: '/projects/[projectId]/tasks', params: { projectId } });
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <ScreenHeader title={project.name} subtitle={clientName} onBack={() => router.back()} />

        <GlassCard>
          {project.description ? (
            <Text style={styles.description}>{project.description}</Text>
          ) : null}

          <View style={styles.statusRow}>
            {canManage ? (
              <Pressable onPress={() => setStatusPickerOpen(true)}>
                <Badge label={`${PROJECT_STATUS_LABELS[status]}  ▾`} />
              </Pressable>
            ) : (
              <Badge label={PROJECT_STATUS_LABELS[status]} />
            )}
            {depts.map((d) => (
              <Badge key={d.slug} label={d.name} color={DEPT_COLORS[d.slug]} />
            ))}
          </View>

          <View style={styles.dates}>
            <Text style={styles.meta}>Start {shortDate(project.start_date)}</Text>
            <Text style={styles.meta}>Due {shortDate(project.target_end_date)}</Text>
          </View>

          {canManage && (
            <View style={styles.creatives}>
              <Text style={styles.label}>CREATIVES</Text>
              <View style={styles.chipRow}>
                {assignedCreatives.map((c) => (
                  <Pressable
                    key={c.profile_id}
                    onPress={() => removeCreativeMutation.mutate(c.profile_id)}
                    style={styles.chip}
                  >
                    <Text style={styles.chipText}>{c.full_name}  ×</Text>
                  </Pressable>
                ))}
                {availableCreatives.length > 0 && (
                  <Pressable onPress={() => setCreativePickerOpen(true)} style={styles.chip}>
                    <Text style={styles.chipText}>+ Add</Text>
                  </Pressable>
                )}
              </View>
              {(addCreativeMutation.isPending || removeCreativeMutation.isPending) && (
                <Text style={styles.muted}>Saving…</Text>
              )}
            </View>
          )}
        </GlassCard>

        <GlassCard>
          <Text style={styles.label}>MOODBOARD</Text>
          {editingMoodboard ? (
            <View style={styles.moodboardForm}>
              <Input
                label="Link"
                value={moodboardDraft}
                onChangeText={setMoodboardDraft}
                placeholder="https://canva.com/…"
              />
              <Button
                title="Save"
                loading={moodboardMutation.isPending}
                onPress={() => moodboardMutation.mutate(moodboardDraft.trim() || null)}
              />
              <Button title="Cancel" variant="ghost" onPress={() => setEditingMoodboard(false)} />
            </View>
          ) : project.moodboard_url ? (
            <View style={styles.moodboardRow}>
              <Pressable
                style={styles.flex}
                onPress={() => Linking.openURL(project.moodboard_url!)}
              >
                <Text style={styles.link} numberOfLines={1}>
                  {project.moodboard_url}
                </Text>
              </Pressable>
              {canEditMoodboard && (
                <Pressable
                  onPress={() => {
                    setMoodboardDraft(project.moodboard_url ?? '');
                    setEditingMoodboard(true);
                  }}
                >
                  <Text style={styles.editText}>Edit</Text>
                </Pressable>
              )}
            </View>
          ) : canEditMoodboard ? (
            <Pressable
              onPress={() => {
                setMoodboardDraft('');
                setEditingMoodboard(true);
              }}
            >
              <Text style={styles.placeholderCard}>+ Link a moodboard</Text>
            </Pressable>
          ) : (
            <Text style={styles.muted}>No moodboard linked yet</Text>
          )}
        </GlassCard>

        <Pressable onPress={openTasks}>
          <GlassCard>
            <Text style={styles.tileTitle}>Tasks</Text>
            <Text style={styles.muted}>
              {progress.total > 0
                ? `${progress.done} / ${progress.total} done`
                : 'No tasks yet'}
            </Text>
          </GlassCard>
        </Pressable>

        <GlassCard>
          <Text style={styles.tileTitleSoon}>Deliverables · Soon</Text>
          <Text style={styles.muted}>{deliverableCount} total</Text>
        </GlassCard>

        <GlassCard>
          <Text style={styles.tileTitleSoon}>Activity · Soon</Text>
        </GlassCard>
      </ScrollView>

      <PickerSheet
        visible={statusPickerOpen}
        title="Project status"
        selected={status}
        options={STATUSES.map((s) => ({ value: s, label: PROJECT_STATUS_LABELS[s] }))}
        onSelect={chooseStatus}
        onClose={() => setStatusPickerOpen(false)}
      />
      <PickerSheet
        visible={creativePickerOpen}
        title="Add creative"
        options={availableCreatives.map((c) => ({ value: c.profile_id, label: c.full_name }))}
        onSelect={(profileId) => {
          setCreativePickerOpen(false);
          addCreativeMutation.mutate(profileId);
        }}
        onClose={() => setCreativePickerOpen(false)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 20, gap: 16, paddingBottom: 140 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  flex: { flex: 1 },
  description: { color: theme.text.label, fontSize: 14, marginBottom: 12 },
  statusRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' },
  dates: { flexDirection: 'row', gap: 16, marginTop: 12 },
  meta: { color: theme.text.dim, fontSize: 12 },
  creatives: { marginTop: 16, gap: 4 },
  label: {
    fontSize: 11,
    fontWeight: '500',
    color: theme.text.label,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  chip: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  chipText: { color: theme.colors.foreground, fontSize: 13 },
  moodboardForm: { gap: 12, marginTop: 12 },
  moodboardRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 8 },
  link: { color: '#a5b4fc', fontSize: 13 },
  editText: { color: theme.text.dim, fontSize: 13 },
  placeholderCard: {
    color: theme.text.dim,
    fontSize: 13,
    marginTop: 10,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: theme.colors.border,
    borderRadius: theme.radius,
    paddingVertical: 18,
    textAlign: 'center',
  },
  tileTitle: { color: '#fff', fontSize: 16, fontWeight: '600', marginBottom: 4 },
  tileTitleSoon: {
    color: theme.colors.mutedForeground,
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  muted: { color: theme.text.dim, fontSize: 13 },
  error: { color: '#f87171', fontSize: 13, textAlign: 'center' },
});
```

- [ ] **Step 3: Retire the two forward-reference directives from Task 2**

The `/projects/[projectId]` route now exists, so both `@ts-expect-error`
directives Task 2 left behind are stale — and a *stale* `@ts-expect-error` is
itself a compile error, which is why they were used instead of `as any`.

In `mobile/app/(employee)/projects/index.tsx`, delete these two comment lines
from `openProject`, leaving the `router.push` call:

```
    // @ts-expect-error — the /projects/[projectId] route does not exist until
    // Task 3 creates it. Delete this directive (not the call) in Task 3.
```

In `mobile/app/(employee)/projects/new.tsx`, delete the identical two lines from
the mutation's `onSuccess`, leaving the `router.replace` call.

- [ ] **Step 4: Verify**

```bash
cd mobile && npx tsc --noEmit && npm test && npx expo start --clear
```

Expected: clean typecheck — one live `@ts-expect-error` remains, on `openTasks`.
In the simulator:

1. As an **executive**: open a project → header shows name + client, status badge has a `▾` and opens the picker. Change the status → the badge updates immediately and the projects list shows the new status when you go back.
2. Still as an executive: the CREATIVES row is present; add one from the picker and remove it by tapping its chip.
3. Set a moodboard link, save, and confirm tapping it opens the browser.
4. Sign in as a **plain employee in the creatives department**: the status badge is read-only (no `▾`), the CREATIVES row is absent entirely, and the moodboard is still editable. Save a moodboard change and confirm it persists — that proves the RPC path, since a plain `.update()` would be rejected here.
5. Sign in as a **plain employee not in creatives**: status read-only, no creatives row, and the moodboard shows either the link (read-only) or "No moodboard linked yet".
6. Tap the Tasks tile → not-found screen. Expected until Task 4.

- [ ] **Step 5: Commit**

```bash
git add mobile/app/\(employee\)/projects mobile/lib/queries/project-detail.ts
git commit -m "feat(mobile): add project detail with status, moodboard and creatives"
```

---

### Task 4: Project task board — stage chips replace the kanban

Replaces `components/kanban/StageBoard.tsx` and ports
`app/(admin)/admin/projects/[projectId]/tasks/page.tsx`.

**The interaction, decided concretely.** One section per department the project
belongs to (a multi-department project stacks several sections vertically, same
as the web). Each section has a horizontally scrolling chip row: an "All" chip
showing the department's total, then one chip per stage in `position` order,
labelled with the stage name, badged with its live task count, tinted with
`department_stages.color` (fallback `#71717a`), and suffixed with a checkmark
glyph when `is_terminal`. Tapping a chip filters the list beneath it to that
stage; tapping the active chip again, or "All", clears the filter. Filter state
is per-section and lives in local component state. Moving a task happens in task
detail (Task 5), not here.

**Why nothing is lost.** The web board's only persisted effect from a drag is a
single-column write, `UPDATE tasks SET current_stage_id = … WHERE id = …`. There
is no position/order column on `tasks`, so within-column order was never
persisted; and a same-column drag in the web app fires a wasted no-op write and
then visually snaps back, because `setLocalTasks` patches a field without
reordering the array. That gesture has never worked, so the chips-and-picker
model reproduces every behaviour that actually exists. The one genuine
regression is interaction cost — "tap stage chip → find task → open picker"
instead of one drag. That is the accepted cost of a touch UI, not a gap.

**Files:**
- Create: `mobile/app/(employee)/projects/[projectId]/tasks/index.tsx`
- Create: `mobile/lib/queries/board.ts`
- Modify: `mobile/app/(employee)/projects/[projectId]/index.tsx` (remove one `@ts-expect-error`)

**Interfaces:**
- Consumes: `supabase`, `theme`, `Screen`, `GlassCard`, `Badge`, `ScreenHeader`, `useAuth`, `qk`, and from `mobile/lib/data.ts`: `one`, `countByStage`, `isTaskOverdue`, `shortDate`, `firstName`, `type StageLike`. `isExecutive`, `PRIORITY_LABELS` from `@shared/rbac`.
- Produces:
  - route `/projects/[projectId]/tasks`
  - `useBoard(projectId: string): UseQueryResult<Board>`
  - `useBoardMeta(deptIds: string[]): UseQueryResult<BoardMeta>`
  - types `Board`, `BoardMeta`, `BoardTask`, `BoardDepartment`

- [ ] **Step 1: Write the board query module**

Two dependent fetches, exactly like the web page's two sequential `Promise.all`
batches: batch 2 needs `deptIds` derived from batch 1. On mobile that becomes a
second hook with `enabled: deptIds.length > 0`. Every select is verbatim from
porting brief §4 — note `employees!task_creatives_profile_id_fkey(...)`, which
names the foreign key because `task_creatives` has more than one plausible join
path into `employees`.

`mobile/lib/queries/board.ts`:

```ts
import { useQuery } from '@tanstack/react-query';
import type { TaskPriority } from '@shared/types';
import { supabase } from '../supabase';
import { qk } from './keys';

export type BoardDepartment = { id: string; name: string; slug: string; is_primary: boolean };

export type BoardTask = {
  id: string;
  project_id: string;
  department_id: string;
  current_stage_id: string;
  title: string;
  priority: TaskPriority;
  start_date: string | null;
  due_date: string | null;
  assigned_to: string | null;
  department_stages:
    | { id: string; name: string; is_terminal: boolean; color: string | null }
    | { id: string; name: string; is_terminal: boolean; color: string | null }[]
    | null;
  employees: { profiles: { full_name: string } | null } | { profiles: { full_name: string } | null }[] | null;
  task_creatives:
    | { profile_id: string; employees: { profiles: { full_name: string } | null } | { profiles: { full_name: string } | null }[] | null }[]
    | null;
};

export type Board = {
  projectName: string;
  departments: BoardDepartment[];
  tasks: BoardTask[];
};

export function useBoard(projectId: string) {
  return useQuery({
    queryKey: qk.projectTasks(projectId),
    queryFn: async (): Promise<Board> => {
      const [projectRes, tasksRes] = await Promise.all([
        supabase
          .from('projects')
          .select('name, project_departments(department_id, is_primary, departments(id, name, slug))')
          .eq('id', projectId)
          .single(),
        supabase
          .from('tasks')
          .select('*, department_stages(*), departments(name), employees!assigned_to(profiles(full_name)), task_creatives(profile_id, employees!task_creatives_profile_id_fkey(profiles(full_name)))')
          .eq('project_id', projectId)
          .order('created_at'),
      ]);
      if (projectRes.error) throw projectRes.error;
      if (!projectRes.data) throw new Error('Project not found');
      if (tasksRes.error) throw tasksRes.error;

      const departments = ((projectRes.data as any).project_departments ?? [])
        .map((pd: any) => {
          const dept = Array.isArray(pd.departments) ? pd.departments[0] : pd.departments;
          if (!dept) return null;
          return {
            id: dept.id as string,
            name: dept.name as string,
            slug: dept.slug as string,
            is_primary: !!pd.is_primary,
          };
        })
        .filter(Boolean) as BoardDepartment[];

      return {
        projectName: (projectRes.data as any).name as string,
        departments,
        tasks: (tasksRes.data ?? []) as unknown as BoardTask[],
      };
    },
  });
}

export type BoardStage = {
  id: string;
  department_id: string;
  name: string;
  position: number;
  is_terminal: boolean;
  color: string | null;
};

export type BoardMeta = {
  stages: BoardStage[];
  employees: { profile_id: string; full_name: string; department_id: string }[];
};

/**
 * Batch 2 of the web page's two sequential fetches — it needs the department
 * ids that batch 1 produced, so it stays disabled until they arrive.
 */
export function useBoardMeta(deptIds: string[]) {
  return useQuery({
    queryKey: qk.boardMeta(deptIds),
    enabled: deptIds.length > 0,
    queryFn: async (): Promise<BoardMeta> => {
      const [stagesRes, employeesRes] = await Promise.all([
        supabase
          .from('department_stages')
          .select('*')
          .in('department_id', deptIds)
          .order('position'),
        supabase
          .from('employees')
          .select('profile_id, profiles(full_name), employee_departments!inner(department_id)')
          .in('employee_departments.department_id', deptIds),
      ]);
      if (stagesRes.error) throw stagesRes.error;
      if (employeesRes.error) throw employeesRes.error;

      const employees: BoardMeta['employees'] = [];
      for (const row of (employeesRes.data ?? []) as any[]) {
        const profiles = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
        const memberships = Array.isArray(row.employee_departments)
          ? row.employee_departments
          : [row.employee_departments].filter(Boolean);
        for (const m of memberships) {
          employees.push({
            profile_id: row.profile_id as string,
            full_name: profiles?.full_name ?? 'Unknown',
            department_id: m.department_id as string,
          });
        }
      }

      return { stages: (stagesRes.data ?? []) as BoardStage[], employees };
    },
  });
}
```

- [ ] **Step 2: Write the board screen**

`mobile/app/(employee)/projects/[projectId]/tasks/index.tsx`:

```tsx
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { isExecutive, PRIORITY_LABELS } from '@shared/rbac';
import { Screen } from '../../../../../components/ui/Screen';
import { GlassCard } from '../../../../../components/ui/GlassCard';
import { Badge } from '../../../../../components/ui/Badge';
import { ScreenHeader } from '../../../../../components/ui/ScreenHeader';
import { useAuth } from '../../../../../lib/auth';
import { one, countByStage, isTaskOverdue, shortDate, firstName } from '../../../../../lib/data';
import {
  useBoard,
  useBoardMeta,
  type BoardTask,
  type BoardStage,
} from '../../../../../lib/queries/board';
import { theme } from '../../../../../lib/theme';

const STAGE_FALLBACK_COLOR = '#71717a';

export default function BoardScreen() {
  const { projectId } = useLocalSearchParams<{ projectId: string }>();
  const router = useRouter();
  const { employee } = useAuth();
  const canManage = isExecutive(employee?.role ?? 'employee');

  const board = useBoard(projectId);
  const deptIds = useMemo(
    () => (board.data?.departments ?? []).map((d) => d.id),
    [board.data]
  );
  const meta = useBoardMeta(deptIds);

  // One selected stage per department section, keyed by department id.
  // null / absent = "All".
  const [selected, setSelected] = useState<Record<string, string | null>>({});

  function openTask(taskId: string) {
    // @ts-expect-error — the /projects/[projectId]/tasks/[taskId] route does not
    // exist until Task 5 creates it. Delete this directive (not the call) in Task 5.
    router.push({
      pathname: '/projects/[projectId]/tasks/[taskId]',
      params: { projectId, taskId },
    });
  }

  function newTask() {
    // @ts-expect-error — the /projects/[projectId]/tasks/new route does not
    // exist until Task 6 creates it. Delete this directive (not the call) in Task 6.
    router.push({ pathname: '/projects/[projectId]/tasks/new', params: { projectId } });
  }

  if (board.isLoading) {
    return (
      <Screen>
        <View style={styles.centered}>
          <Text style={styles.muted}>Loading…</Text>
        </View>
      </Screen>
    );
  }
  if (board.error || !board.data) {
    return (
      <Screen>
        <View style={styles.centered}>
          <Text style={styles.error}>{board.error?.message ?? 'Project not found'}</Text>
        </View>
      </Screen>
    );
  }

  const { projectName, departments, tasks } = board.data;
  const stages = meta.data?.stages ?? [];

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.scroll}>
        <ScreenHeader
          title="Tasks"
          subtitle={projectName}
          onBack={() => router.back()}
          right={
            canManage ? (
              <Pressable onPress={newTask} hitSlop={10}>
                <Text style={styles.newButton}>New</Text>
              </Pressable>
            ) : undefined
          }
        />

        {departments.length === 0 && (
          <Text style={styles.muted}>This project has no departments.</Text>
        )}

        {departments.map((dept) => {
          const deptTasks = tasks.filter((t) => t.department_id === dept.id);
          const deptStages = stages.filter((s) => s.department_id === dept.id);
          const counts = countByStage(deptStages as BoardStage[], deptTasks);
          const activeStage = selected[dept.id] ?? null;
          const visible = activeStage
            ? deptTasks.filter((t) => t.current_stage_id === activeStage)
            : deptTasks;

          return (
            <View key={dept.id} style={styles.section}>
              <Text style={styles.deptName}>
                {dept.name}
                {dept.is_primary ? ' · primary' : ''}
              </Text>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.chipRow}
              >
                <Chip
                  label="All"
                  count={deptTasks.length}
                  color="#fafafa"
                  active={activeStage === null}
                  onPress={() => setSelected((s) => ({ ...s, [dept.id]: null }))}
                />
                {counts.map(({ stage, count }) => (
                  <Chip
                    key={stage.id}
                    label={stage.is_terminal ? `${stage.name} ✓` : stage.name}
                    count={count}
                    color={stage.color ?? STAGE_FALLBACK_COLOR}
                    active={activeStage === stage.id}
                    onPress={() =>
                      setSelected((s) => ({
                        ...s,
                        [dept.id]: s[dept.id] === stage.id ? null : stage.id,
                      }))
                    }
                  />
                ))}
              </ScrollView>

              {meta.isLoading && deptStages.length === 0 && (
                <Text style={styles.muted}>Loading stages…</Text>
              )}

              {visible.length === 0 ? (
                <Text style={styles.muted}>
                  {deptTasks.length === 0 ? 'No tasks yet' : 'No tasks in this stage'}
                </Text>
              ) : (
                visible.map((task) => (
                  <TaskCard key={task.id} task={task} onPress={() => openTask(task.id)} />
                ))
              )}
            </View>
          );
        })}
      </ScrollView>
    </Screen>
  );
}

function Chip({
  label,
  count,
  color,
  active,
  onPress,
}: {
  label: string;
  count: number;
  color: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.chip,
        { borderColor: color },
        active && { backgroundColor: 'rgba(255,255,255,0.12)' },
      ]}
    >
      <Text style={[styles.chipText, active && styles.chipTextActive]}>
        {label} · {count}
      </Text>
    </Pressable>
  );
}

function TaskCard({ task, onPress }: { task: BoardTask; onPress: () => void }) {
  const stage = one(task.department_stages);
  const overdue = isTaskOverdue(task.due_date, !!stage?.is_terminal);
  const assignee = one(task.employees)?.profiles?.full_name;
  const creativeNames = (task.task_creatives ?? [])
    .map((tc) => firstName(one(tc.employees)?.profiles?.full_name))
    .filter((n) => n !== '—');

  return (
    <Pressable onPress={onPress}>
      <GlassCard style={styles.card}>
        <View style={styles.cardTop}>
          <Text style={styles.cardTitle} numberOfLines={2}>
            {overdue ? '⚠ ' : ''}
            {task.title}
          </Text>
          <Badge label={PRIORITY_LABELS[task.priority]} />
        </View>
        <View style={styles.cardMeta}>
          <Text style={overdue ? styles.overdue : styles.meta}>
            {shortDate(task.due_date)}
            {overdue ? ' · Overdue' : ''}
          </Text>
          {assignee ? <Text style={styles.meta}>{firstName(assignee)}</Text> : null}
          {creativeNames.length > 0 ? (
            <Text style={styles.meta}>{creativeNames.join(', ')}</Text>
          ) : null}
        </View>
      </GlassCard>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 20, gap: 20, paddingBottom: 140 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  newButton: { color: '#fff', fontSize: 15, fontWeight: '600' },
  section: { gap: 10 },
  deptName: { color: '#fff', fontSize: 15, fontWeight: '600' },
  chipRow: { gap: 8, paddingRight: 20 },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  chipText: { color: theme.text.dim, fontSize: 13 },
  chipTextActive: { color: '#fff', fontWeight: '600' },
  card: { marginTop: 2 },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  cardTitle: { color: '#fff', fontSize: 15, fontWeight: '600', flex: 1 },
  cardMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 8 },
  meta: { color: theme.text.dim, fontSize: 12 },
  overdue: { color: '#f87171', fontSize: 12 },
  muted: { color: theme.text.dim, fontSize: 13 },
  error: { color: '#f87171', fontSize: 13, textAlign: 'center' },
});
```

- [ ] **Step 3: Retire the forward-reference directive from Task 3**

In `mobile/app/(employee)/projects/[projectId]/index.tsx`, delete these two
comment lines from `openTasks`, leaving the `router.push` call:

```
    // @ts-expect-error — the /projects/[projectId]/tasks route does not exist
    // until Task 4 creates it. Delete this directive (not the call) in Task 4.
```

- [ ] **Step 4: Verify**

```bash
cd mobile && npx tsc --noEmit && npm test && npx expo start --clear
```

Expected: clean typecheck; two live `@ts-expect-error` directives remain in the
board screen (`openTask`, `newTask`). In the simulator:

1. Open a project with tasks → one section per department, each with an "All" chip and one chip per stage in position order. Chip counts sum to the "All" count.
2. Tap a stage chip → the list below narrows to that stage; the chip highlights. Tap it again → back to All. Filtering one department's section leaves the other section's filter untouched.
3. A terminal stage's chip shows a ✓. A task whose due date has passed and whose stage is non-terminal shows ⚠ and a red "· Overdue" date; a task in a terminal stage never does, however old.
4. As an executive a "New" action shows in the header; as a plain employee it does not. Both actions route to a not-found screen for now — expected until Tasks 5 and 6.
5. Open a **multi-department** project and confirm two stacked sections, each listing only its own department's tasks and its own department's stages.

- [ ] **Step 5: Commit**

```bash
git add mobile/app/\(employee\)/projects mobile/lib/queries/board.ts
git commit -m "feat(mobile): replace kanban board with stage chips and filtered task list"
```

---

### Task 5: Task detail — stage picker, edit, delete

Ports `components/kanban/EditTaskDialog.tsx`. This screen is where a task
changes stage, which is the interaction that replaced drag-and-drop.

**The move, decided concretely.** The stage row shows the current stage name and
opens a `PickerSheet` listing the department's stages in `position` order.
Picking a different one:
1. sets a local `pendingStageId` so the row shows the new stage **immediately**;
2. fires exactly one write — `supabase.from('tasks').update({ current_stage_id }).eq('id', taskId)` — the same single-column write the web board issues on drop;
3. on success clears `pendingStageId` and invalidates the task and the board;
4. on failure clears `pendingStageId` (so the row snaps back to the persisted stage — a targeted rollback of that one field, not a refetch) and shows an `Alert`.

Picking the stage it is already in is a no-op that fires no write. The web app
does fire a wasted write in that case, via the same-column drag path; that write
changes nothing (`OLD = NEW`), writes no `task_stage_history` row because
`log_task_stage_change()` guards on `IS DISTINCT FROM`, and produces no visible
effect. Not reproducing it is a fix, not a divergence.

A real stage change writes a `task_stage_history` row through that same trigger
and notifies **nobody** — `on_task_assigned` fires on `assigned_to` changes only.
That stays true here: moving a stage sends no notification.

**Files:**
- Create: `mobile/app/(employee)/projects/[projectId]/tasks/[taskId].tsx`
- Create: `mobile/lib/queries/task.ts`
- Modify: `mobile/app/(employee)/projects/[projectId]/tasks/index.tsx` (remove one `@ts-expect-error`)

**Interfaces:**
- Consumes: `supabase`, `theme`, `Screen`, `GlassCard`, `Button`, `Input`, `Badge`, `ScreenHeader`, `PickerSheet`, `useAuth`, `qk`, and from `mobile/lib/data.ts`: `one`, `shortDate`. `PRIORITY_LABELS` from `@shared/rbac`.
- Produces:
  - route `/projects/[projectId]/tasks/[taskId]`
  - `useTask(taskId: string): UseQueryResult<TaskDetail>`
  - `useTaskPickers(projectId: string, departmentId: string | undefined): UseQueryResult<TaskPickers>`
  - `useAvailabilityConflicts(args: { assignedTo: string | null; startDate: string; dueDate: string; excludeTaskId: string | null }): UseQueryResult<{ id: string; title: string }[]>`
  - `moveTaskStage(taskId: string, stageId: string): Promise<void>`
  - `saveTask(input: SaveTaskInput): Promise<void>`
  - `deleteTask(taskId: string): Promise<void>`
  - `isShootStage(stageName: string | null | undefined): boolean`
  - types `TaskDetail`, `TaskPickers`, `SaveTaskInput`

- [ ] **Step 1: Write the task query module**

`mobile/lib/queries/task.ts`:

```ts
import { useQuery } from '@tanstack/react-query';
import type { TaskPriority } from '@shared/types';
import { supabase } from '../supabase';
import { qk } from './keys';

export type TaskDetail = {
  id: string;
  project_id: string;
  department_id: string;
  current_stage_id: string;
  title: string;
  description: string | null;
  priority: TaskPriority;
  start_date: string | null;
  due_date: string | null;
  assigned_to: string | null;
  department_stages:
    | { id: string; name: string; is_terminal: boolean; color: string | null }
    | { id: string; name: string; is_terminal: boolean; color: string | null }[]
    | null;
  departments: { name: string } | { name: string }[] | null;
  employees: { profiles: { full_name: string } | null } | { profiles: { full_name: string } | null }[] | null;
  task_creatives: { profile_id: string }[] | null;
};

export function useTask(taskId: string) {
  return useQuery({
    queryKey: qk.task(taskId),
    queryFn: async (): Promise<TaskDetail> => {
      // Same select as the board's task query (porting brief §4), narrowed to
      // one row. The FK-disambiguated relation names are required verbatim.
      const { data, error } = await supabase
        .from('tasks')
        .select('*, department_stages(*), departments(name), employees!assigned_to(profiles(full_name)), task_creatives(profile_id, employees!task_creatives_profile_id_fkey(profiles(full_name)))')
        .eq('id', taskId)
        .single();
      if (error) throw error;
      if (!data) throw new Error('Task not found');
      return data as unknown as TaskDetail;
    },
  });
}

export type TaskPickers = {
  stages: { id: string; name: string; position: number; is_terminal: boolean; color: string | null }[];
  employees: { profile_id: string; full_name: string }[];
  projectCreatives: { profile_id: string; full_name: string }[];
};

/**
 * The board fetches stages and department members with `.in('department_id',
 * deptIds)` across every department on the project. A task belongs to exactly
 * one department, so this narrows the same two queries to `.eq(...)` — same
 * rows, one department's worth.
 */
export function useTaskPickers(projectId: string, departmentId: string | undefined) {
  return useQuery({
    queryKey: qk.taskPickers(projectId, departmentId ?? ''),
    enabled: !!departmentId,
    queryFn: async (): Promise<TaskPickers> => {
      const [stagesRes, employeesRes, creativesRes] = await Promise.all([
        supabase
          .from('department_stages')
          .select('*')
          .eq('department_id', departmentId!)
          .order('position'),
        supabase
          .from('employees')
          .select('profile_id, profiles(full_name), employee_departments!inner(department_id)')
          .eq('employee_departments.department_id', departmentId!),
        supabase
          .from('project_creatives')
          .select('profile_id, employees(profiles(full_name))')
          .eq('project_id', projectId),
      ]);
      if (stagesRes.error) throw stagesRes.error;
      if (employeesRes.error) throw employeesRes.error;
      if (creativesRes.error) throw creativesRes.error;

      const name = (row: any, nested = false) => {
        const source = nested
          ? Array.isArray(row.employees) ? row.employees[0] : row.employees
          : row;
        const profiles = Array.isArray(source?.profiles) ? source.profiles[0] : source?.profiles;
        return profiles?.full_name ?? 'Unknown';
      };

      return {
        stages: (stagesRes.data ?? []) as TaskPickers['stages'],
        employees: (employeesRes.data ?? []).map((row: any) => ({
          profile_id: row.profile_id as string,
          full_name: name(row),
        })),
        projectCreatives: (creativesRes.data ?? []).map((row: any) => ({
          profile_id: row.profile_id as string,
          full_name: name(row, true),
        })),
      };
    },
  });
}

/**
 * Overlapping-date-range check, verbatim from NewTaskDialog/EditTaskDialog:
 * any other task for the same assignee whose [start_date, due_date] window
 * intersects this one's. `excludeTaskId` is the task being edited (the web
 * adds `.neq('id', task.id)`); pass null when creating.
 *
 * This is a HARD BLOCK on web despite its advisory styling — `canSubmit`
 * requires `conflicting.length === 0`. Keep it blocking.
 */
export function useAvailabilityConflicts({
  assignedTo,
  startDate,
  dueDate,
  excludeTaskId,
}: {
  assignedTo: string | null;
  startDate: string;
  dueDate: string;
  excludeTaskId: string | null;
}) {
  return useQuery({
    queryKey: qk.taskConflicts(assignedTo ?? '', startDate, dueDate, excludeTaskId),
    enabled: !!assignedTo && !!startDate && !!dueDate,
    queryFn: async () => {
      let query = supabase
        .from('tasks')
        .select('id, title')
        .eq('assigned_to', assignedTo!)
        .not('start_date', 'is', null)
        .not('due_date', 'is', null)
        .lte('start_date', dueDate)
        .gte('due_date', startDate);
      if (excludeTaskId) query = query.neq('id', excludeTaskId);
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as { id: string; title: string }[];
    },
  });
}

/**
 * KNOWN FRAGILITY, reproduced deliberately for parity: whether a task gets a
 * single "shoot date" instead of start+due is decided by a case-insensitive
 * match on the stage NAME, not by any schema flag. Renaming a department's
 * "Shoot" stage silently changes this behaviour on both clients. Do not
 * "improve" it to a column unless the web app changes at the same time, or the
 * two clients will disagree about which stage gets single-date treatment.
 */
export function isShootStage(stageName: string | null | undefined): boolean {
  return (stageName ?? '').toLowerCase() === 'shoot';
}

/** The stage move. One column, one row — identical to the web board's drop write. */
export async function moveTaskStage(taskId: string, stageId: string) {
  const { error } = await supabase
    .from('tasks')
    .update({ current_stage_id: stageId })
    .eq('id', taskId);
  if (error) throw error;
}

export type SaveTaskInput = {
  taskId: string;
  title: string;
  description: string;
  priority: TaskPriority;
  assigned_to: string | null;
  current_stage_id: string;
  start_date: string;
  due_date: string;
  isShoot: boolean;
  creativesToAdd: string[];
  creativesToRemove: string[];
};

/**
 * Web parity, including the order: the task row first, then creative ADDITIONS
 * before REMOVALS, so a failed insert never leaves the task stripped of its
 * existing collaborators.
 */
export async function saveTask(input: SaveTaskInput) {
  const { error } = await supabase
    .from('tasks')
    .update({
      title: input.title,
      description: input.description || null,
      priority: input.priority,
      assigned_to: input.assigned_to || null,
      current_stage_id: input.current_stage_id,
      start_date: input.start_date || null,
      due_date: input.isShoot ? input.start_date || null : input.due_date || null,
    })
    .eq('id', input.taskId);
  if (error) throw error;

  if (input.creativesToAdd.length > 0) {
    const { error: addError } = await supabase
      .from('task_creatives')
      .insert(input.creativesToAdd.map((profile_id) => ({ task_id: input.taskId, profile_id })));
    if (addError) throw addError;
  }
  if (input.creativesToRemove.length > 0) {
    const { error: removeError } = await supabase
      .from('task_creatives')
      .delete()
      .eq('task_id', input.taskId)
      .in('profile_id', input.creativesToRemove);
    if (removeError) throw removeError;
  }
}

export async function deleteTask(taskId: string) {
  const { error } = await supabase.from('tasks').delete().eq('id', taskId);
  if (error) throw error;
}
```

- [ ] **Step 2: Write the task detail screen**

`mobile/app/(employee)/projects/[projectId]/tasks/[taskId].tsx`:

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
import type { TaskPriority } from '@shared/types';
import { PRIORITY_LABELS } from '@shared/rbac';
import { Screen } from '../../../../../components/ui/Screen';
import { GlassCard } from '../../../../../components/ui/GlassCard';
import { Button } from '../../../../../components/ui/Button';
import { Input } from '../../../../../components/ui/Input';
import { ScreenHeader } from '../../../../../components/ui/ScreenHeader';
import { PickerSheet } from '../../../../../components/ui/PickerSheet';
import { one } from '../../../../../lib/data';
import { qk } from '../../../../../lib/queries/keys';
import {
  useTask,
  useTaskPickers,
  useAvailabilityConflicts,
  moveTaskStage,
  saveTask,
  deleteTask,
  isShootStage,
} from '../../../../../lib/queries/task';
import { theme } from '../../../../../lib/theme';

const PRIORITIES: TaskPriority[] = ['low', 'medium', 'high', 'urgent'];
const STAGE_FALLBACK_COLOR = '#71717a';

export default function TaskDetailScreen() {
  const { projectId, taskId } = useLocalSearchParams<{ projectId: string; taskId: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();

  const task = useTask(taskId);
  const pickers = useTaskPickers(projectId, task.data?.department_id);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [assignedTo, setAssignedTo] = useState<string | null>(null);
  const [startDate, setStartDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [creativeIds, setCreativeIds] = useState<string[]>([]);
  const [originalCreativeIds, setOriginalCreativeIds] = useState<string[]>([]);
  // Optimistic stage while a move is in flight; null = show the persisted one.
  const [pendingStageId, setPendingStageId] = useState<string | null>(null);
  const [picker, setPicker] = useState<'stage' | 'priority' | 'assignee' | null>(null);

  useEffect(() => {
    // Keyed on the task ROW IDENTITY, not on `task.data` — that object is a new
    // reference after every background refetch and every invalidation, and
    // re-running this would overwrite whatever the user has typed since the
    // screen loaded. Seeding the form once per task id is the whole intent.
    const row = task.data;
    if (!row) return;
    setTitle(row.title);
    setDescription(row.description ?? '');
    setPriority(row.priority);
    setAssignedTo(row.assigned_to);
    setStartDate(row.start_date ?? '');
    setDueDate(row.due_date ?? '');
    const ids = (row.task_creatives ?? []).map((tc) => tc.profile_id);
    setCreativeIds(ids);
    setOriginalCreativeIds(ids);
  }, [task.data?.id]);

  const stages = pickers.data?.stages ?? [];
  const persistedStageId = task.data?.current_stage_id ?? '';
  const stageId = pendingStageId ?? persistedStageId;
  const stage = stages.find((s) => s.id === stageId) ?? one(task.data?.department_stages ?? null);
  const shoot = isShootStage(stage?.name);

  const conflicts = useAvailabilityConflicts({
    assignedTo,
    startDate,
    dueDate: shoot ? startDate : dueDate,
    excludeTaskId: taskId,
  });
  const conflicting = conflicts.data ?? [];

  const moveMutation = useMutation({
    mutationFn: (nextStageId: string) => moveTaskStage(taskId, nextStageId),
    onSuccess: () => {
      setPendingStageId(null);
      queryClient.invalidateQueries({ queryKey: qk.task(taskId) });
      queryClient.invalidateQueries({ queryKey: qk.projectTasks(projectId) });
      queryClient.invalidateQueries({ queryKey: qk.project(projectId) });
    },
    onError: (e: Error) => {
      // Targeted rollback of just this field — the row snaps back to the
      // persisted stage without a refetch, matching the web board.
      setPendingStageId(null);
      Alert.alert('Could not move task', e.message);
    },
  });

  const saveMutation = useMutation({
    mutationFn: saveTask,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.task(taskId) });
      queryClient.invalidateQueries({ queryKey: qk.projectTasks(projectId) });
      queryClient.invalidateQueries({ queryKey: qk.project(projectId) });
      queryClient.invalidateQueries({ queryKey: qk.allTasks() });
      router.back();
    },
    onError: (e: Error) => Alert.alert('Could not save task', e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteTask(taskId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.projectTasks(projectId) });
      queryClient.invalidateQueries({ queryKey: qk.project(projectId) });
      queryClient.invalidateQueries({ queryKey: qk.allTasks() });
      router.back();
    },
    onError: (e: Error) => Alert.alert('Could not delete task', e.message),
  });

  if (task.isLoading) {
    return (
      <Screen>
        <View style={styles.centered}>
          <Text style={styles.muted}>Loading…</Text>
        </View>
      </Screen>
    );
  }
  if (task.error || !task.data) {
    return (
      <Screen>
        <View style={styles.centered}>
          <Text style={styles.error}>{task.error?.message ?? 'Task not found'}</Text>
        </View>
      </Screen>
    );
  }

  function chooseStage(nextStageId: string) {
    setPicker(null);
    if (nextStageId === persistedStageId) return; // no write for a no-op move
    setPendingStageId(nextStageId); // optimistic
    moveMutation.mutate(nextStageId);
  }

  function confirmDelete() {
    Alert.alert('Delete task', `Delete "${task.data!.title}"? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteMutation.mutate() },
    ]);
  }

  const canSave =
    title.trim().length > 0 &&
    startDate.length > 0 &&
    (shoot || dueDate.length > 0) &&
    conflicting.length === 0;

  function submit() {
    saveMutation.mutate({
      taskId,
      title: title.trim(),
      description,
      priority,
      assigned_to: assignedTo,
      current_stage_id: stageId,
      start_date: startDate,
      due_date: dueDate,
      isShoot: shoot,
      creativesToAdd: creativeIds.filter((id) => !originalCreativeIds.includes(id)),
      creativesToRemove: originalCreativeIds.filter((id) => !creativeIds.includes(id)),
    });
  }

  const assigneeName =
    pickers.data?.employees.find((e) => e.profile_id === assignedTo)?.full_name ?? 'Unassigned';

  return (
    <Screen>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <ScreenHeader
            title="Task"
            subtitle={one(task.data.departments)?.name ?? undefined}
            onBack={() => router.back()}
          />

          <GlassCard>
            <Pressable onPress={() => setPicker('stage')}>
              <Text style={styles.label}>STAGE</Text>
              <View style={styles.stageRow}>
                <View
                  style={[
                    styles.dot,
                    { backgroundColor: stage?.color ?? STAGE_FALLBACK_COLOR },
                  ]}
                />
                <Text style={styles.value}>
                  {stage?.name ?? '—'}
                  {stage?.is_terminal ? ' ✓' : ''}
                </Text>
                {moveMutation.isPending && <Text style={styles.muted}>Moving…</Text>}
              </View>
            </Pressable>
          </GlassCard>

          <GlassCard>
            <View style={styles.form}>
              <Input label="Title" value={title} onChangeText={setTitle} placeholder="Task title" />
              <Input
                label="Description"
                value={description}
                onChangeText={setDescription}
                placeholder="Optional"
              />

              <Pressable onPress={() => setPicker('priority')}>
                <Text style={styles.label}>PRIORITY</Text>
                <Text style={styles.value}>{PRIORITY_LABELS[priority]}</Text>
              </Pressable>

              <Pressable onPress={() => setPicker('assignee')}>
                <Text style={styles.label}>ASSIGNEE</Text>
                <Text style={styles.value}>{assigneeName}</Text>
              </Pressable>

              {shoot ? (
                <Input
                  label="Shoot date"
                  value={startDate}
                  onChangeText={setStartDate}
                  placeholder="YYYY-MM-DD"
                />
              ) : (
                <>
                  <Input
                    label="Start date"
                    value={startDate}
                    onChangeText={setStartDate}
                    placeholder="YYYY-MM-DD"
                  />
                  <Input
                    label="Due date"
                    value={dueDate}
                    onChangeText={setDueDate}
                    placeholder="YYYY-MM-DD"
                  />
                </>
              )}
            </View>
          </GlassCard>

          <GlassCard>
            <Text style={styles.label}>CREATIVES</Text>
            <View style={styles.chipRow}>
              {(pickers.data?.projectCreatives ?? []).map((c) => {
                const on = creativeIds.includes(c.profile_id);
                return (
                  <Pressable
                    key={c.profile_id}
                    onPress={() =>
                      setCreativeIds((ids) =>
                        ids.includes(c.profile_id)
                          ? ids.filter((x) => x !== c.profile_id)
                          : [...ids, c.profile_id]
                      )
                    }
                    style={[styles.chip, on && styles.chipOn]}
                  >
                    <Text style={[styles.chipText, on && styles.chipTextOn]}>{c.full_name}</Text>
                  </Pressable>
                );
              })}
              {(pickers.data?.projectCreatives.length ?? 0) === 0 && (
                <Text style={styles.muted}>No creatives on this project.</Text>
              )}
            </View>
          </GlassCard>

          {conflicting.length > 0 && (
            <GlassCard>
              <Text style={styles.conflictTitle}>Assignee is booked</Text>
              {conflicting.map((c) => (
                <Text key={c.id} style={styles.conflictRow}>
                  · {c.title}
                </Text>
              ))}
              <Text style={styles.muted}>
                Change the assignee or the dates before saving.
              </Text>
            </GlassCard>
          )}

          <Button
            title="Save changes"
            onPress={submit}
            disabled={!canSave}
            loading={saveMutation.isPending}
          />
          <Button title="Delete task" variant="ghost" onPress={confirmDelete} />
        </ScrollView>
      </KeyboardAvoidingView>

      <PickerSheet
        visible={picker === 'stage'}
        title="Move to stage"
        selected={stageId}
        options={stages.map((s) => ({
          value: s.id,
          label: s.is_terminal ? `${s.name} ✓` : s.name,
          color: s.color ?? STAGE_FALLBACK_COLOR,
        }))}
        onSelect={chooseStage}
        onClose={() => setPicker(null)}
      />
      <PickerSheet
        visible={picker === 'priority'}
        title="Priority"
        selected={priority}
        options={PRIORITIES.map((p) => ({ value: p, label: PRIORITY_LABELS[p] }))}
        onSelect={(v) => {
          setPriority(v as TaskPriority);
          setPicker(null);
        }}
        onClose={() => setPicker(null)}
      />
      <PickerSheet
        visible={picker === 'assignee'}
        title="Assignee"
        selected={assignedTo ?? 'unassigned'}
        options={[
          { value: 'unassigned', label: 'Unassigned' },
          ...(pickers.data?.employees ?? []).map((e) => ({
            value: e.profile_id,
            label: e.full_name,
          })),
        ]}
        onSelect={(v) => {
          setAssignedTo(v === 'unassigned' ? null : v);
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
  stageRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  chip: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  chipOn: { borderColor: '#fafafa', backgroundColor: 'rgba(255,255,255,0.10)' },
  chipText: { color: theme.text.dim, fontSize: 13 },
  chipTextOn: { color: '#fff', fontWeight: '600' },
  conflictTitle: { color: '#fbbf24', fontSize: 14, fontWeight: '600', marginBottom: 6 },
  conflictRow: { color: theme.colors.foreground, fontSize: 13 },
  muted: { color: theme.text.dim, fontSize: 12, marginTop: 6 },
  error: { color: '#f87171', fontSize: 13, textAlign: 'center' },
});
```

- [ ] **Step 3: Retire the forward-reference directive from Task 4**

In `mobile/app/(employee)/projects/[projectId]/tasks/index.tsx`, delete these two
comment lines from `openTask`, leaving the `router.push` call:

```
    // @ts-expect-error — the /projects/[projectId]/tasks/[taskId] route does not
    // exist until Task 5 creates it. Delete this directive (not the call) in Task 5.
```

Leave the directive in `newTask` — Task 6 removes that one.

- [ ] **Step 4: Verify**

```bash
cd mobile && npx tsc --noEmit && npm test && npx expo start --clear
```

In the simulator:

1. Open a task from the board → the STAGE row shows its current stage with the stage's colour dot.
2. Tap STAGE, pick a **different** stage → the row updates instantly, and going back to the board shows the task under the new stage's chip with both chip counts adjusted.
3. Tap STAGE and pick the stage it is **already in** → the sheet closes and nothing is written (no "Moving…", no refetch).
4. Turn on airplane mode, move the stage → an alert appears and the row snaps back to the original stage. No refetch, no other field disturbed.
5. Edit the title and save → the board shows the new title. Toggle a creative on and one off in the same save and confirm both landed in `task_creatives`.
6. Assign the task to someone who already has a task overlapping these dates → the "Assignee is booked" panel lists it and **Save changes is disabled**. Change the dates so they no longer overlap → the panel clears and Save re-enables.
7. Open a task in a stage literally named "Shoot" → one "Shoot date" field, no due date. Save and confirm `due_date` equals `start_date` in the database.
8. Delete a task → native confirm; cancelling changes nothing, confirming removes it from the board.

- [ ] **Step 5: Commit**

```bash
git add mobile/app/\(employee\)/projects mobile/lib/queries/task.ts
git commit -m "feat(mobile): add task detail with stage picker, edit and delete"
```

---

### Task 6: New Task (executive only)

Ports `.../tasks/NewTaskDialog.tsx`. Reuses `useBoard` (Task 4) for the
project's departments and `useTaskPickers` / `useAvailabilityConflicts` /
`isShootStage` (Task 5) for everything else, so this task adds one screen and
one mutation.

`new.tsx` sits next to `[taskId].tsx`; Expo Router prefers the static segment,
so `/projects/x/tasks/new` resolves here and not to the task-detail route.

**Files:**
- Create: `mobile/app/(employee)/projects/[projectId]/tasks/new.tsx`
- Modify: `mobile/lib/queries/task.ts` (add `createTask`)
- Modify: `mobile/app/(employee)/projects/[projectId]/tasks/index.tsx` (remove the last `@ts-expect-error`)

**Interfaces:**
- Consumes: `supabase`, `theme`, `Screen`, `GlassCard`, `Button`, `Input`, `ScreenHeader`, `PickerSheet`, `qk`, `useBoard` from `mobile/lib/queries/board.ts`, and `useTaskPickers`, `useAvailabilityConflicts`, `isShootStage` from `mobile/lib/queries/task.ts`. `PRIORITY_LABELS` from `@shared/rbac`.
- Produces:
  - route `/projects/[projectId]/tasks/new`
  - `createTask(input: CreateTaskInput): Promise<string>` — resolves to the new task id
  - type `CreateTaskInput`

- [ ] **Step 1: Add the create mutation**

Append to `mobile/lib/queries/task.ts`:

```ts
export type CreateTaskInput = {
  project_id: string;
  department_id: string;
  /** The department's lowest-position stage — new tasks always start there. */
  current_stage_id: string;
  title: string;
  description: string;
  priority: TaskPriority;
  start_date: string;
  due_date: string;
  isShoot: boolean;
  assigned_to: string | null;
  creativeProfileIds: string[];
  userId: string;
};

export async function createTask(input: CreateTaskInput): Promise<string> {
  const { data, error } = await supabase
    .from('tasks')
    .insert({
      project_id: input.project_id,
      department_id: input.department_id,
      current_stage_id: input.current_stage_id,
      title: input.title,
      description: input.description || null,
      priority: input.priority,
      start_date: input.start_date,
      due_date: input.isShoot ? input.start_date : input.due_date,
      assigned_to: input.assigned_to || null,
      created_by: input.userId,
    })
    .select('id')
    .single();
  if (error) throw error;
  if (!data) throw new Error('Task insert returned no row');

  const taskId = data.id as string;
  if (input.creativeProfileIds.length > 0) {
    const { error: creativesError } = await supabase
      .from('task_creatives')
      .insert(input.creativeProfileIds.map((profile_id) => ({ task_id: taskId, profile_id })));
    if (creativesError) throw creativesError;
  }
  return taskId;
}
```

Note there is **no rollback here**, matching the web: a failed `task_creatives`
insert leaves the task in place. That differs from `createProject`, which does
roll back — the difference is in the source, so keep it.

- [ ] **Step 2: Write the new-task screen**

`mobile/app/(employee)/projects/[projectId]/tasks/new.tsx`:

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
import type { TaskPriority } from '@shared/types';
import { PRIORITY_LABELS } from '@shared/rbac';
import { Screen } from '../../../../../components/ui/Screen';
import { GlassCard } from '../../../../../components/ui/GlassCard';
import { Button } from '../../../../../components/ui/Button';
import { Input } from '../../../../../components/ui/Input';
import { ScreenHeader } from '../../../../../components/ui/ScreenHeader';
import { PickerSheet } from '../../../../../components/ui/PickerSheet';
import { useAuth } from '../../../../../lib/auth';
import { qk } from '../../../../../lib/queries/keys';
import { useBoard } from '../../../../../lib/queries/board';
import {
  createTask,
  useTaskPickers,
  useAvailabilityConflicts,
  isShootStage,
} from '../../../../../lib/queries/task';
import { theme } from '../../../../../lib/theme';

const PRIORITIES: TaskPriority[] = ['low', 'medium', 'high', 'urgent'];

export default function NewTaskScreen() {
  const { projectId } = useLocalSearchParams<{ projectId: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { session } = useAuth();

  const board = useBoard(projectId);
  const departments = board.data?.departments ?? [];

  const [deptId, setDeptId] = useState<string | null>(null);

  useEffect(() => {
    // Default to the project's first department once they load. Keyed on the
    // joined id list rather than the array reference, which is new on every
    // refetch; and it only ever sets state while `deptId` is still null, so a
    // user's explicit choice is never overwritten.
    if (!deptId && departments.length > 0) setDeptId(departments[0].id);
  }, [departments.map((d) => d.id).join(','), deptId]);

  const pickers = useTaskPickers(projectId, deptId ?? undefined);
  const firstStage = pickers.data?.stages[0] ?? null;
  const shoot = isShootStage(firstStage?.name);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [assignedTo, setAssignedTo] = useState<string | null>(null);
  const [startDate, setStartDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [creativeIds, setCreativeIds] = useState<string[]>([]);
  const [picker, setPicker] = useState<'dept' | 'priority' | 'assignee' | null>(null);

  const conflicts = useAvailabilityConflicts({
    assignedTo,
    startDate,
    dueDate: shoot ? startDate : dueDate,
    excludeTaskId: null,
  });
  const conflicting = conflicts.data ?? [];

  const mutation = useMutation({
    mutationFn: createTask,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.projectTasks(projectId) });
      queryClient.invalidateQueries({ queryKey: qk.project(projectId) });
      queryClient.invalidateQueries({ queryKey: qk.projects() });
      queryClient.invalidateQueries({ queryKey: qk.allTasks() });
      router.back();
    },
    onError: (e: Error) => Alert.alert('Could not create task', e.message),
  });

  const canSubmit =
    !!deptId &&
    !!firstStage &&
    !!session?.user.id &&
    title.trim().length > 0 &&
    startDate.length > 0 &&
    (shoot || dueDate.length > 0) &&
    conflicting.length === 0;

  function submit() {
    if (!canSubmit) return;
    mutation.mutate({
      project_id: projectId,
      department_id: deptId!,
      current_stage_id: firstStage!.id,
      title: title.trim(),
      description,
      priority,
      start_date: startDate,
      due_date: dueDate,
      isShoot: shoot,
      assigned_to: assignedTo,
      creativeProfileIds: creativeIds,
      userId: session!.user.id,
    });
  }

  const deptName = departments.find((d) => d.id === deptId)?.name ?? 'Select a department';
  const assigneeName =
    pickers.data?.employees.find((e) => e.profile_id === assignedTo)?.full_name ?? 'Unassigned';

  return (
    <Screen>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <ScreenHeader title="New task" onBack={() => router.back()} />

          <GlassCard>
            <View style={styles.form}>
              <Pressable onPress={() => setPicker('dept')}>
                <Text style={styles.label}>DEPARTMENT</Text>
                <Text style={styles.value}>{deptName}</Text>
              </Pressable>

              <View>
                <Text style={styles.label}>STARTING STAGE</Text>
                <Text style={styles.value}>{firstStage?.name ?? '—'}</Text>
                <Text style={styles.muted}>
                  New tasks always start in the department's first stage.
                </Text>
              </View>

              <Input label="Title" value={title} onChangeText={setTitle} placeholder="Task title" />
              <Input
                label="Description"
                value={description}
                onChangeText={setDescription}
                placeholder="Optional"
              />

              <Pressable onPress={() => setPicker('priority')}>
                <Text style={styles.label}>PRIORITY</Text>
                <Text style={styles.value}>{PRIORITY_LABELS[priority]}</Text>
              </Pressable>

              <Pressable onPress={() => setPicker('assignee')}>
                <Text style={styles.label}>ASSIGNEE</Text>
                <Text style={styles.value}>{assigneeName}</Text>
              </Pressable>

              {shoot ? (
                <Input
                  label="Shoot date"
                  value={startDate}
                  onChangeText={setStartDate}
                  placeholder="YYYY-MM-DD"
                />
              ) : (
                <>
                  <Input
                    label="Start date"
                    value={startDate}
                    onChangeText={setStartDate}
                    placeholder="YYYY-MM-DD"
                  />
                  <Input
                    label="Due date"
                    value={dueDate}
                    onChangeText={setDueDate}
                    placeholder="YYYY-MM-DD"
                  />
                </>
              )}
            </View>
          </GlassCard>

          <GlassCard>
            <Text style={styles.label}>CREATIVES</Text>
            <View style={styles.chipRow}>
              {(pickers.data?.projectCreatives ?? []).map((c) => {
                const on = creativeIds.includes(c.profile_id);
                return (
                  <Pressable
                    key={c.profile_id}
                    onPress={() =>
                      setCreativeIds((ids) =>
                        ids.includes(c.profile_id)
                          ? ids.filter((x) => x !== c.profile_id)
                          : [...ids, c.profile_id]
                      )
                    }
                    style={[styles.chip, on && styles.chipOn]}
                  >
                    <Text style={[styles.chipText, on && styles.chipTextOn]}>{c.full_name}</Text>
                  </Pressable>
                );
              })}
              {(pickers.data?.projectCreatives.length ?? 0) === 0 && (
                <Text style={styles.muted}>No creatives on this project.</Text>
              )}
            </View>
          </GlassCard>

          {conflicting.length > 0 && (
            <GlassCard>
              <Text style={styles.conflictTitle}>Assignee is booked</Text>
              {conflicting.map((c) => (
                <Text key={c.id} style={styles.conflictRow}>
                  · {c.title}
                </Text>
              ))}
              <Text style={styles.muted}>Change the assignee or the dates before saving.</Text>
            </GlassCard>
          )}

          <Button
            title="Create task"
            onPress={submit}
            disabled={!canSubmit}
            loading={mutation.isPending}
          />
        </ScrollView>
      </KeyboardAvoidingView>

      <PickerSheet
        visible={picker === 'dept'}
        title="Department"
        selected={deptId}
        options={departments.map((d) => ({ value: d.id, label: d.name }))}
        onSelect={(v) => {
          setDeptId(v);
          // The stage and employee lists are department-scoped, so a department
          // change invalidates the current assignee choice.
          setAssignedTo(null);
          setPicker(null);
        }}
        onClose={() => setPicker(null)}
      />
      <PickerSheet
        visible={picker === 'priority'}
        title="Priority"
        selected={priority}
        options={PRIORITIES.map((p) => ({ value: p, label: PRIORITY_LABELS[p] }))}
        onSelect={(v) => {
          setPriority(v as TaskPriority);
          setPicker(null);
        }}
        onClose={() => setPicker(null)}
      />
      <PickerSheet
        visible={picker === 'assignee'}
        title="Assignee"
        selected={assignedTo ?? 'unassigned'}
        options={[
          { value: 'unassigned', label: 'Unassigned' },
          ...(pickers.data?.employees ?? []).map((e) => ({
            value: e.profile_id,
            label: e.full_name,
          })),
        ]}
        onSelect={(v) => {
          setAssignedTo(v === 'unassigned' ? null : v);
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
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  chip: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  chipOn: { borderColor: '#fafafa', backgroundColor: 'rgba(255,255,255,0.10)' },
  chipText: { color: theme.text.dim, fontSize: 13 },
  chipTextOn: { color: '#fff', fontWeight: '600' },
  conflictTitle: { color: '#fbbf24', fontSize: 14, fontWeight: '600', marginBottom: 6 },
  conflictRow: { color: theme.colors.foreground, fontSize: 13 },
  muted: { color: theme.text.dim, fontSize: 12, marginTop: 6 },
});
```

- [ ] **Step 3: Retire the last forward-reference directive**

In `mobile/app/(employee)/projects/[projectId]/tasks/index.tsx`, delete these two
comment lines from `newTask`, leaving the `router.push` call:

```
    // @ts-expect-error — the /projects/[projectId]/tasks/new route does not
    // exist until Task 6 creates it. Delete this directive (not the call) in Task 6.
```

After this step there must be **zero** `@ts-expect-error` directives under
`mobile/app/(employee)/projects/`. Confirm with:

```bash
cd mobile && grep -rn "ts-expect-error" "app/(employee)/projects"
```

Expected: no output.

- [ ] **Step 4: Verify**

```bash
cd mobile && npx tsc --noEmit && npm test && npx expo start --clear
```

In the simulator, as an **executive**:

1. Open a board → **New** → the department defaults to the project's first department and STARTING STAGE shows that department's lowest-position stage.
2. On a multi-department project, switch department → the starting stage, the assignee list and the assignee selection all update.
3. Submit with an empty title → Create is disabled. Fill title but leave the due date empty (non-shoot department) → still disabled.
4. Pick an assignee with an overlapping booking → the conflict panel lists it and Create stays disabled.
5. Create a task → it appears on the board under the first stage's chip, and the project detail's task progress increments.
6. On a department whose first stage is named "Shoot", only "Shoot date" shows; after creating, `due_date` equals `start_date` in the database.
7. As a **plain employee**, the board shows no **New** action.

- [ ] **Step 5: Commit**

```bash
git add mobile/app/\(employee\)/projects mobile/lib/queries/task.ts
git commit -m "feat(mobile): add new task screen with availability conflict blocking"
```

---

### Task 7: My Tasks

Ports `app/(admin)/admin/tasks/page.tsx` + `TasksList.tsx`. One query, no role
branch in the data: RLS decides what comes back (team members get only their own
assigned tasks; executives and creatives get every task in projects they can
see). `isExecutive` gates only the assignee filter and the heading text.

**Files:**
- Replace: `mobile/app/(employee)/tasks.tsx`
- Create: `mobile/lib/queries/all-tasks.ts`

**Interfaces:**
- Consumes: `supabase`, `theme`, `Screen`, `GlassCard`, `Badge`, `ScreenHeader`, `PickerSheet`, `useAuth`, `qk`, and from `mobile/lib/data.ts`: `one`, `shortDate`, `firstName`, `distinctAssignees`. `isExecutive`, `PRIORITY_LABELS` from `@shared/rbac`.
- Produces:
  - the `/tasks` tab screen
  - `useAllTasks(): UseQueryResult<AllTasksRow[]>`
  - type `AllTasksRow`

- [ ] **Step 1: Write the query module**

`mobile/lib/queries/all-tasks.ts`:

```ts
import { useQuery } from '@tanstack/react-query';
import type { TaskPriority } from '@shared/types';
import { supabase } from '../supabase';
import { qk } from './keys';

export type AllTasksRow = {
  id: string;
  title: string;
  priority: TaskPriority;
  due_date: string | null;
  project_id: string;
  assigned_to: string | null;
  projects: { name: string } | { name: string }[] | null;
  departments: { name: string } | { name: string }[] | null;
  department_stages:
    | { name: string; is_terminal: boolean }
    | { name: string; is_terminal: boolean }[]
    | null;
  employees: { profiles: { full_name: string } | null } | { profiles: { full_name: string } | null }[] | null;
};

export function useAllTasks() {
  return useQuery({
    queryKey: qk.allTasks(),
    queryFn: async (): Promise<AllTasksRow[]> => {
      // Deliberately role-agnostic — no .eq('assigned_to', …) here. RLS scopes
      // the result set; the same query text serves every role.
      const { data, error } = await supabase
        .from('tasks')
        .select('id, title, priority, due_date, project_id, assigned_to, projects(name), departments(name), department_stages(name, is_terminal), employees!assigned_to(profiles(full_name))')
        .order('due_date', { ascending: true, nullsFirst: false });
      if (error) throw error;
      return (data ?? []) as unknown as AllTasksRow[];
    },
  });
}
```

- [ ] **Step 2: Write the screen**

The assignee filter is plain local `useState` — web parity, since `TasksList.tsx`
already uses local state rather than a URL param. Its options come from the
assignees present in the fetched rows, not a separate employees query.

Replace `mobile/app/(employee)/tasks.tsx` entirely:

```tsx
import { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { isExecutive, PRIORITY_LABELS } from '@shared/rbac';
import { Screen } from '../../components/ui/Screen';
import { GlassCard } from '../../components/ui/GlassCard';
import { Badge } from '../../components/ui/Badge';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { PickerSheet } from '../../components/ui/PickerSheet';
import { useAuth } from '../../lib/auth';
import { one, shortDate, firstName, distinctAssignees } from '../../lib/data';
import { useAllTasks, type AllTasksRow } from '../../lib/queries/all-tasks';
import { theme } from '../../lib/theme';

export default function TasksScreen() {
  const router = useRouter();
  const { employee } = useAuth();
  const canFilter = isExecutive(employee?.role ?? 'employee');
  const { data, isLoading, error } = useAllTasks();
  const rows = useMemo(() => data ?? [], [data]);

  const [assignee, setAssignee] = useState<string>('all');
  const [pickerOpen, setPickerOpen] = useState(false);

  const assignees = useMemo(() => distinctAssignees(rows), [rows]);
  const visible = useMemo(() => {
    if (assignee === 'all') return rows;
    if (assignee === 'unassigned') return rows.filter((r) => r.assigned_to === null);
    return rows.filter((r) => r.assigned_to === assignee);
  }, [rows, assignee]);

  const showFilter = canFilter && assignees.length > 1;
  const filterLabel =
    assignee === 'all'
      ? 'All Tasks'
      : assignee === 'unassigned'
        ? 'Unassigned'
        : (assignees.find((a) => a.id === assignee)?.name ?? 'All Tasks');

  return (
    <Screen>
      <FlatList
        contentContainerStyle={styles.list}
        data={visible}
        keyExtractor={(t) => t.id}
        ListHeaderComponent={
          <ScreenHeader
            title={canFilter ? 'All Tasks' : 'My Tasks'}
            right={
              showFilter ? (
                <Pressable onPress={() => setPickerOpen(true)} hitSlop={10}>
                  <Text style={styles.filterButton}>{filterLabel}</Text>
                </Pressable>
              ) : undefined
            }
          />
        }
        ListEmptyComponent={
          isLoading ? (
            <Text style={styles.muted}>Loading…</Text>
          ) : error ? (
            <Text style={styles.error}>{error.message}</Text>
          ) : rows.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>No tasks</Text>
            </View>
          ) : (
            <Text style={styles.muted}>No tasks match this filter</Text>
          )
        }
        renderItem={({ item }) => (
          <TaskRow
            task={item}
            onPress={() =>
              router.push({
                pathname: '/projects/[projectId]/tasks',
                params: { projectId: item.project_id },
              })
            }
          />
        )}
      />

      <PickerSheet
        visible={pickerOpen}
        title="Filter by assignee"
        selected={assignee}
        options={[
          { value: 'all', label: 'All Tasks' },
          { value: 'unassigned', label: 'Unassigned' },
          ...assignees.map((a) => ({ value: a.id, label: a.name })),
        ]}
        onSelect={(v) => {
          setAssignee(v);
          setPickerOpen(false);
        }}
        onClose={() => setPickerOpen(false)}
      />
    </Screen>
  );
}

function TaskRow({ task, onPress }: { task: AllTasksRow; onPress: () => void }) {
  const stage = one(task.department_stages);
  const done = !!stage?.is_terminal;
  const subtitle = [
    one(task.projects)?.name,
    one(task.departments)?.name,
    stage?.name,
  ]
    .filter(Boolean)
    .join(' · ');
  const assignee = one(task.employees)?.profiles?.full_name;

  return (
    <Pressable onPress={onPress}>
      <GlassCard>
        <View style={styles.rowTop}>
          <Text style={[styles.title, done && styles.titleDone]} numberOfLines={2}>
            {task.title}
          </Text>
          <Badge label={PRIORITY_LABELS[task.priority]} />
        </View>
        <Text style={styles.subtitle} numberOfLines={1}>
          {subtitle}
        </Text>
        <View style={styles.rowMeta}>
          <Text style={styles.meta}>{shortDate(task.due_date)}</Text>
          <Text style={styles.meta}>{assignee ? firstName(assignee) : 'Unassigned'}</Text>
        </View>
      </GlassCard>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  list: { padding: 20, gap: 12, paddingBottom: 120 },
  filterButton: { color: '#fff', fontSize: 14, fontWeight: '600' },
  rowTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  title: { color: '#fff', fontSize: 15, fontWeight: '600', flex: 1 },
  titleDone: { color: theme.colors.mutedForeground, textDecorationLine: 'line-through' },
  subtitle: { color: theme.text.dim, fontSize: 12, marginTop: 6 },
  rowMeta: { flexDirection: 'row', gap: 16, marginTop: 8 },
  meta: { color: theme.text.dimmer, fontSize: 12 },
  empty: { alignItems: 'center', paddingVertical: 60 },
  emptyTitle: { color: '#fff', fontSize: 16, fontWeight: '600' },
  muted: { color: theme.text.dim, fontSize: 13, textAlign: 'center', paddingVertical: 24 },
  error: { color: '#f87171', fontSize: 13, textAlign: 'center', paddingVertical: 40 },
});
```

- [ ] **Step 3: Verify**

```bash
cd mobile && npx tsc --noEmit && npm test && npx expo start --clear
```

In the simulator:

1. As an **executive**: the Tasks tab is headed "All Tasks", sorted by due date with undated tasks last, and a filter action shows when more than one assignee appears. Filter to one person, then to "Unassigned", then back to "All Tasks".
2. Filter to a person with no visible tasks → "No tasks match this filter" inline, not the whole-screen empty state.
3. As a **plain employee**: the heading reads "My Tasks", no filter action, and only their own tasks appear — the query text is identical, so this is RLS doing the scoping.
4. Tap any row → the project's board opens. Go back → the Tasks tab is where you left it.
5. Tasks in a terminal stage render struck through and dimmed.

- [ ] **Step 4: Commit**

```bash
git add mobile/app/\(employee\)/tasks.tsx mobile/lib/queries/all-tasks.ts
git commit -m "feat(mobile): add my tasks screen with assignee filter"
```

---

### Task 8: Dashboard — executive and plain-employee variants

Ports `app/(admin)/admin/dashboard/page.tsx`. `isExecutive(role)` selects
between **two completely separate screens**. They share no query and no metric —
do not try to parameterise one component for both.

**Filter state, decided.** The executive department filter is local
`useState` in the dashboard screen: not persisted, not global, reset on every
screen entry. This follows the porting brief's recommendation and matches the
web, where `dept_id` is a search param scoped to that single page — navigating
to Projects drops it and reloading the dashboard without the param resets to
"All Departments". Only one screen in the entire app reads this filter today, so
a store would be premature. The filter is threaded into the query key
(`['dashboard','exec',deptId]`) because it reshapes four of the six queries
server-side; that plumbing is required regardless of where the state lives.

**Files:**
- Replace: `mobile/app/(employee)/dashboard.tsx`
- Create: `mobile/components/dashboard/ExecutiveDashboard.tsx`
- Create: `mobile/components/dashboard/EmployeeDashboard.tsx`
- Create: `mobile/lib/queries/dashboard.ts`

**Interfaces:**
- Consumes: `supabase`, `theme`, `Screen`, `GlassCard`, `Badge`, `ScreenHeader`, `PickerSheet`, `useAuth`, `qk`, and from `mobile/lib/data.ts`: `one`, `shortDate`, `relativeTime`, `distinctClientCount`. `isExecutive`, `PROJECT_STATUS_LABELS`, `PRIORITY_LABELS`, `DELIVERABLE_STATUS_LABELS` from `@shared/rbac`.
- Produces:
  - the `/dashboard` tab screen
  - `useExecutiveDashboard(deptId: string | null): UseQueryResult<ExecutiveDashboardData>`
  - `useEmployeeDashboard(userId: string): UseQueryResult<EmployeeDashboardData>`
  - `<ExecutiveDashboard>` — Props: `{}`
  - `<EmployeeDashboard>` — Props: `{ userId: string }`
  - types `ExecutiveDashboardData`, `EmployeeDashboardData`

- [ ] **Step 1: Write the dashboard query module**

Six queries in one `Promise.all`, four of them branching on whether a department
filter is active. All select strings are verbatim from porting brief §1. Two
details that are easy to get wrong and produce silently wrong numbers:

- The filtered **client** count is a distinct count over `projects.client_id`, not a row count — a client with two projects in the department would otherwise be counted twice.
- The **open task** count uses `department_stages!current_stage_id!inner(is_terminal)`. The FK is named explicitly because `tasks` has more than one join path into `department_stages`, and `!inner` is what lets `.eq('department_stages.is_terminal', false)` filter rather than be ignored.

`mobile/lib/queries/dashboard.ts`:

```ts
import { useQuery } from '@tanstack/react-query';
import type { ProjectStatus, TaskPriority, DeliverableStatus } from '@shared/types';
import { supabase } from '../supabase';
import { qk } from './keys';
import { distinctClientCount } from '../data';

export type ExecutiveDashboardData = {
  departments: { id: string; name: string }[];
  clientCount: number;
  projectCount: number;
  openTaskCount: number;
  activity: {
    id: string;
    action: string;
    created_at: string;
    profiles: { full_name: string } | { full_name: string }[] | null;
  }[];
  recentProjects: {
    id: string;
    name: string;
    status: ProjectStatus;
    clients: { company_name: string } | { company_name: string }[] | null;
  }[];
};

export function useExecutiveDashboard(deptId: string | null) {
  return useQuery({
    queryKey: qk.dashboardExec(deptId),
    queryFn: async (): Promise<ExecutiveDashboardData> => {
      const [deptsRes, clientsRes, projectCountRes, openTasksRes, activityRes, recentRes] =
        await Promise.all([
          supabase.from('departments').select('id, name').order('name'),

          deptId
            ? supabase
                .from('project_departments')
                .select('projects!inner(client_id)')
                .eq('department_id', deptId)
            : supabase.from('clients').select('*', { count: 'exact', head: true }),

          deptId
            ? supabase
                .from('project_departments')
                .select('*', { count: 'exact', head: true })
                .eq('department_id', deptId)
            : supabase.from('projects').select('*', { count: 'exact', head: true }),

          deptId
            ? supabase
                .from('tasks')
                .select('*, department_stages!current_stage_id!inner(is_terminal)', {
                  count: 'exact',
                  head: true,
                })
                .eq('department_id', deptId)
                .eq('department_stages.is_terminal', false)
            : supabase
                .from('tasks')
                .select('*, department_stages!current_stage_id!inner(is_terminal)', {
                  count: 'exact',
                  head: true,
                })
                .eq('department_stages.is_terminal', false),

          // Activity is never department-filtered — always agency-wide.
          supabase
            .from('activity_log')
            .select('*, profiles(full_name)')
            .order('created_at', { ascending: false })
            .limit(8),

          deptId
            ? supabase
                .from('projects')
                .select('*, clients(company_name), project_departments!inner(department_id)')
                .eq('project_departments.department_id', deptId)
                .order('updated_at', { ascending: false })
                .limit(5)
            : supabase
                .from('projects')
                .select('*, clients(company_name)')
                .order('updated_at', { ascending: false })
                .limit(5),
        ]);

      if (deptsRes.error) throw deptsRes.error;
      if (clientsRes.error) throw clientsRes.error;
      if (projectCountRes.error) throw projectCountRes.error;
      if (openTasksRes.error) throw openTasksRes.error;
      if (activityRes.error) throw activityRes.error;
      if (recentRes.error) throw recentRes.error;

      return {
        departments: (deptsRes.data ?? []) as { id: string; name: string }[],
        // Filtered: distinct clients across the department's projects.
        // Unfiltered: the head-count the query already returned.
        clientCount: deptId
          ? distinctClientCount((clientsRes.data ?? []) as any[])
          : (clientsRes.count ?? 0),
        projectCount: projectCountRes.count ?? 0,
        openTaskCount: openTasksRes.count ?? 0,
        activity: (activityRes.data ?? []) as unknown as ExecutiveDashboardData['activity'],
        recentProjects: (recentRes.data ?? []) as unknown as ExecutiveDashboardData['recentProjects'],
      };
    },
  });
}

export type EmployeeDashboardData = {
  tasks: {
    id: string;
    title: string;
    priority: TaskPriority;
    due_date: string | null;
    project_id: string;
    projects: { name: string } | { name: string }[] | null;
    department_stages:
      | { name: string; is_terminal: boolean }
      | { name: string; is_terminal: boolean }[]
      | null;
  }[];
  deliverables: {
    id: string;
    title: string;
    status: DeliverableStatus;
    updated_at: string;
    project_id: string;
    projects: { name: string } | { name: string }[] | null;
  }[];
};

export function useEmployeeDashboard(userId: string) {
  return useQuery({
    queryKey: qk.dashboardEmployee(userId),
    queryFn: async (): Promise<EmployeeDashboardData> => {
      const [tasksRes, deliverablesRes] = await Promise.all([
        // Note: unlike the executive open-task count, this query does NOT
        // filter terminal stages server-side. The screen filters them out
        // client-side, matching the web component.
        supabase
          .from('tasks')
          .select('id, title, priority, due_date, project_id, projects(name), department_stages!current_stage_id(name, is_terminal)')
          .eq('assigned_to', userId)
          .order('due_date', { ascending: true, nullsFirst: false }),
        supabase
          .from('deliverables')
          .select('id, title, status, updated_at, project_id, projects(name)')
          .eq('submitted_by', userId)
          .order('updated_at', { ascending: false })
          .limit(10),
      ]);
      if (tasksRes.error) throw tasksRes.error;
      if (deliverablesRes.error) throw deliverablesRes.error;
      return {
        tasks: (tasksRes.data ?? []) as unknown as EmployeeDashboardData['tasks'],
        deliverables: (deliverablesRes.data ?? []) as unknown as EmployeeDashboardData['deliverables'],
      };
    },
  });
}
```

- [ ] **Step 2: Write the executive dashboard**

`mobile/components/dashboard/ExecutiveDashboard.tsx`:

```tsx
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { PROJECT_STATUS_LABELS } from '@shared/rbac';
import { Screen } from '../ui/Screen';
import { GlassCard } from '../ui/GlassCard';
import { Badge } from '../ui/Badge';
import { ScreenHeader } from '../ui/ScreenHeader';
import { PickerSheet } from '../ui/PickerSheet';
import { one, relativeTime } from '../../lib/data';
import { useExecutiveDashboard } from '../../lib/queries/dashboard';
import { theme } from '../../lib/theme';

export function ExecutiveDashboard() {
  const router = useRouter();
  // Local, per-screen, not persisted — web parity (see the task preamble).
  const [deptId, setDeptId] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  const { data, isLoading, error } = useExecutiveDashboard(deptId);
  const deptName = deptId
    ? (data?.departments.find((d) => d.id === deptId)?.name ?? 'Department')
    : 'All Departments';
  const filtered = !!deptId;

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.scroll}>
        <ScreenHeader
          title="Dashboard"
          right={
            <Pressable onPress={() => setPickerOpen(true)} hitSlop={10}>
              <Text style={styles.filterButton}>{deptName}</Text>
            </Pressable>
          }
        />

        {error && <Text style={styles.error}>{error.message}</Text>}

        <View style={styles.tiles}>
          <Tile
            label={filtered ? 'Dept Clients' : 'Total Clients'}
            value={isLoading ? '—' : String(data?.clientCount ?? 0)}
          />
          <Tile
            label={filtered ? 'Dept Projects' : 'Active Projects'}
            value={isLoading ? '—' : String(data?.projectCount ?? 0)}
          />
          <Tile
            label="Open Tasks"
            value={isLoading ? '—' : String(data?.openTaskCount ?? 0)}
          />
        </View>

        <Text style={styles.sectionTitle}>Recent Projects</Text>
        {(data?.recentProjects.length ?? 0) === 0 ? (
          <GlassCard>
            <Text style={styles.muted}>No projects yet</Text>
          </GlassCard>
        ) : (
          data!.recentProjects.map((p) => (
            <Pressable
              key={p.id}
              onPress={() =>
                router.push({ pathname: '/projects/[projectId]', params: { projectId: p.id } })
              }
            >
              <GlassCard>
                <View style={styles.rowTop}>
                  <Text style={styles.rowTitle} numberOfLines={1}>
                    {p.name}
                  </Text>
                  <Badge label={PROJECT_STATUS_LABELS[p.status]} />
                </View>
                <Text style={styles.muted}>{one(p.clients)?.company_name ?? '—'}</Text>
              </GlassCard>
            </Pressable>
          ))
        )}

        <Text style={styles.sectionTitle}>Activity</Text>
        {(data?.activity.length ?? 0) === 0 ? (
          <GlassCard>
            <Text style={styles.muted}>No activity yet</Text>
          </GlassCard>
        ) : (
          <GlassCard>
            {data!.activity.map((a) => (
              <View key={a.id} style={styles.activityRow}>
                <Text style={styles.activityText} numberOfLines={2}>
                  <Text style={styles.actor}>
                    {one(a.profiles)?.full_name ?? 'Someone'}{' '}
                  </Text>
                  {a.action}
                </Text>
                <Text style={styles.meta}>{relativeTime(a.created_at)}</Text>
              </View>
            ))}
          </GlassCard>
        )}
      </ScrollView>

      <PickerSheet
        visible={pickerOpen}
        title="Department"
        selected={deptId ?? 'all'}
        options={[
          { value: 'all', label: 'All Departments' },
          ...(data?.departments ?? []).map((d) => ({ value: d.id, label: d.name })),
        ]}
        onSelect={(v) => {
          setDeptId(v === 'all' ? null : v);
          setPickerOpen(false);
        }}
        onClose={() => setPickerOpen(false)}
      />
    </Screen>
  );
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <GlassCard style={styles.tile}>
      <Text style={styles.tileValue}>{value}</Text>
      <Text style={styles.tileLabel}>{label}</Text>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 20, gap: 12, paddingBottom: 120 },
  filterButton: { color: '#fff', fontSize: 14, fontWeight: '600' },
  tiles: { gap: 12 },
  tile: { paddingVertical: 18 },
  tileValue: { color: '#fff', fontSize: 28, fontWeight: '700', letterSpacing: -1 },
  tileLabel: { color: theme.text.dim, fontSize: 12, marginTop: 4 },
  sectionTitle: { color: '#fff', fontSize: 15, fontWeight: '600', marginTop: 12 },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowTitle: { color: '#fff', fontSize: 15, fontWeight: '600', flex: 1 },
  activityRow: {
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
  },
  activityText: { color: theme.colors.foreground, fontSize: 13 },
  actor: { fontWeight: '600', color: '#fff' },
  meta: { color: theme.text.dimmer, fontSize: 11, marginTop: 2 },
  muted: { color: theme.text.dim, fontSize: 13 },
  error: { color: '#f87171', fontSize: 13 },
});
```

- [ ] **Step 3: Write the plain-employee dashboard**

Open tasks are filtered client-side to non-terminal stages, matching the web
component (its query does not filter them server-side). Deliverable rows are
**not** tappable — the web links them to `/admin/projects/:id/deliverables`, a
screen that arrives in Phase 3, so they carry the same dimmed "Soon" treatment
used elsewhere rather than a dead tap target.

`mobile/components/dashboard/EmployeeDashboard.tsx`:

```tsx
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { DELIVERABLE_STATUS_LABELS, PRIORITY_LABELS } from '@shared/rbac';
import { Screen } from '../ui/Screen';
import { GlassCard } from '../ui/GlassCard';
import { Badge } from '../ui/Badge';
import { ScreenHeader } from '../ui/ScreenHeader';
import { one, shortDate } from '../../lib/data';
import { useEmployeeDashboard } from '../../lib/queries/dashboard';
import { theme } from '../../lib/theme';

export function EmployeeDashboard({ userId }: { userId: string }) {
  const router = useRouter();
  const { data, isLoading, error } = useEmployeeDashboard(userId);

  // Web parity: the query returns every assigned task; the terminal ones are
  // dropped here rather than in SQL.
  const openTasks = (data?.tasks ?? []).filter(
    (t) => !one(t.department_stages)?.is_terminal
  );

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.scroll}>
        <ScreenHeader title="Dashboard" />

        {error && <Text style={styles.error}>{error.message}</Text>}

        <View style={styles.sectionHead}>
          <Text style={styles.sectionTitle}>My Tasks</Text>
          <Badge label={String(openTasks.length)} />
        </View>

        {isLoading ? (
          <Text style={styles.muted}>Loading…</Text>
        ) : openTasks.length === 0 ? (
          <GlassCard>
            <Text style={styles.muted}>No open tasks assigned to you</Text>
          </GlassCard>
        ) : (
          openTasks.map((task) => (
            <Pressable
              key={task.id}
              onPress={() =>
                router.push({
                  pathname: '/projects/[projectId]/tasks',
                  params: { projectId: task.project_id },
                })
              }
            >
              <GlassCard>
                <View style={styles.rowTop}>
                  <Text style={styles.rowTitle} numberOfLines={2}>
                    {task.title}
                  </Text>
                  <Badge label={PRIORITY_LABELS[task.priority]} />
                </View>
                <Text style={styles.subtitle} numberOfLines={1}>
                  {[one(task.projects)?.name, one(task.department_stages)?.name]
                    .filter(Boolean)
                    .join(' · ')}
                </Text>
                <Text style={styles.meta}>{shortDate(task.due_date)}</Text>
              </GlassCard>
            </Pressable>
          ))
        )}

        <Text style={styles.sectionTitleSoon}>Approval Status · Soon</Text>
        {(data?.deliverables.length ?? 0) === 0 ? (
          <GlassCard>
            <Text style={styles.muted}>Nothing submitted yet</Text>
          </GlassCard>
        ) : (
          <GlassCard>
            {data!.deliverables.map((d) => (
              <View key={d.id} style={styles.deliverableRow}>
                <View style={styles.flex}>
                  <Text style={styles.rowTitle} numberOfLines={1}>
                    {d.title}
                  </Text>
                  <Text style={styles.subtitle} numberOfLines={1}>
                    {one(d.projects)?.name ?? '—'}
                  </Text>
                </View>
                <Badge label={DELIVERABLE_STATUS_LABELS[d.status]} />
              </View>
            ))}
          </GlassCard>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 20, gap: 12, paddingBottom: 120 },
  flex: { flex: 1 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  sectionTitle: { color: '#fff', fontSize: 15, fontWeight: '600' },
  sectionTitleSoon: {
    color: theme.colors.mutedForeground,
    fontSize: 15,
    fontWeight: '600',
    marginTop: 16,
  },
  rowTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  rowTitle: { color: '#fff', fontSize: 15, fontWeight: '600', flex: 1 },
  subtitle: { color: theme.text.dim, fontSize: 12, marginTop: 4 },
  meta: { color: theme.text.dimmer, fontSize: 12, marginTop: 6 },
  deliverableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
  },
  muted: { color: theme.text.dim, fontSize: 13 },
  error: { color: '#f87171', fontSize: 13 },
});
```

- [ ] **Step 4: Write the branching tab screen**

Replace `mobile/app/(employee)/dashboard.tsx` entirely:

```tsx
import { isExecutive } from '@shared/rbac';
import { ExecutiveDashboard } from '../../components/dashboard/ExecutiveDashboard';
import { EmployeeDashboard } from '../../components/dashboard/EmployeeDashboard';
import { Placeholder } from '../../components/ui/Placeholder';
import { useAuth } from '../../lib/auth';

export default function Dashboard() {
  const { session, employee } = useAuth();

  if (isExecutive(employee?.role ?? 'employee')) return <ExecutiveDashboard />;
  // The employee variant is keyed entirely on the signed-in user id; without a
  // session there is nothing to query. SessionGate makes this unreachable in
  // practice, so it just needs to not crash.
  if (!session?.user.id) return <Placeholder title="Dashboard" />;
  return <EmployeeDashboard userId={session.user.id} />;
}
```

- [ ] **Step 5: Verify**

```bash
cd mobile && npx tsc --noEmit && npm test && npx expo start --clear
```

In the simulator:

1. As an **executive**: three stat tiles, Recent Projects (max 5) and Activity (max 8). Tap a recent project → project detail opens.
2. Open the department filter and pick a department → the tile labels change to "Dept Clients" / "Dept Projects", all three numbers change, Recent Projects narrows to that department, and **Activity does not change** (it is never department-filtered).
3. Pick a department in which one client has two or more projects, and check the Dept Clients tile counts that client once — cross-check with `SELECT count(DISTINCT client_id)` in the Supabase SQL editor.
4. Switch to another tab and back → the filter has reset to "All Departments". That is intended, not a bug.
5. As a **plain employee**: an entirely different screen — "My Tasks" with a count badge, tasks in terminal stages excluded, each row tappable through to that project's board; then "Approval Status · Soon" listing submitted deliverables with status badges and no tap target.
6. With no open tasks: "No open tasks assigned to you". With nothing submitted: "Nothing submitted yet".

- [ ] **Step 6: Commit**

```bash
git add mobile/app/\(employee\)/dashboard.tsx mobile/components/dashboard mobile/lib/queries/dashboard.ts
git commit -m "feat(mobile): add executive and employee dashboard variants"
```

---

### Task 9: Make the More screen's inert rows look inert

`mobile/app/(employee)/more.tsx` renders Clients, Team, Stages, Profile and
Notifications as `<Text>` rows styled like live navigation but wired to nothing.
Those destinations land in Phase 3. Until then the appearance should match the
behaviour: muted foreground, and a "Soon" affix. Six lines, no new components,
no new tap handlers.

**Files:**
- Modify: `mobile/app/(employee)/more.tsx`

**Interfaces:**
- Consumes: `theme` (already imported in the file)
- Produces: nothing new

- [ ] **Step 1: Add the "Soon" affix to the five rows**

Replace this block:

```tsx
          {exec && <Text style={styles.row}>Clients</Text>}
          {exec && <Text style={styles.row}>Team</Text>}
          {exec && <Text style={styles.row}>Stages</Text>}
          <Text style={styles.row}>Profile</Text>
          <Text style={styles.row}>Notifications</Text>
```

with:

```tsx
          {exec && <Text style={styles.row}>Clients · Soon</Text>}
          {exec && <Text style={styles.row}>Team · Soon</Text>}
          {exec && <Text style={styles.row}>Stages · Soon</Text>}
          <Text style={styles.row}>Profile · Soon</Text>
          <Text style={styles.row}>Notifications · Soon</Text>
```

- [ ] **Step 2: Dim the row colour**

In the same file's `StyleSheet.create`, change the `row` entry from:

```tsx
  row: { color: theme.colors.foreground, fontSize: 15, paddingVertical: 10 },
```

to:

```tsx
  row: { color: theme.colors.mutedForeground, fontSize: 15, paddingVertical: 10 },
```

- [ ] **Step 3: Verify**

```bash
cd mobile && npx tsc --noEmit && npx expo start --clear
```

In the simulator: the More tab's rows read dimmer than the name/role card above
them, each ends in "· Soon", and the executive-only rows still only appear for
executives. Sign out still works.

- [ ] **Step 4: Commit**

```bash
git add mobile/app/\(employee\)/more.tsx
git commit -m "fix(mobile): show More screen's unimplemented rows as pending"
```

---

## Phase 2 Done When

- [ ] `npm test` passes — the 7 Phase 1 suites plus `data.test.ts`
- [ ] `npx tsc --noEmit` is clean inside `mobile/`
- [ ] `grep -rn "ts-expect-error" mobile/app --include=*.tsx` returns nothing under `(employee)/projects`
- [ ] `grep -ri "service_role\|createAdminClient" mobile/ --exclude-dir=node_modules` returns nothing
- [ ] An **executive** can: see the exec dashboard and filter it by department; open a recent project from it; list projects; create a project with several departments and a creative; open a project, change its status, set a moodboard, add and remove creatives; open its board, filter by stage chip, create a task, open a task, move it between stages, edit it and delete it; see "All Tasks" with a working assignee filter
- [ ] A **plain employee in the creatives department** can: see the employee dashboard; list and open projects; edit a project's moodboard; view the board and their own tasks; and never sees the status control, the creatives row, "New Project" or "New Task"
- [ ] A **plain employee not in creatives** sees the same as above minus moodboard editing
- [ ] A **client** signing in still lands in the client portal, untouched by this phase
- [ ] Moving a task to a different stage writes a `task_stage_history` row and sends no notification; moving it to the stage it is already in writes nothing at all

## Judgement calls made in this plan

- **Stage board → chips + picker.** Specified in Task 4 (chips, counts, tap-to-filter, per-department sections) and Task 5 (picker, optimistic move, targeted rollback). Nothing of substance is lost: the web's only persisted drag effect is a one-column write, and its same-column reorder never worked. Accepted regression: interaction cost.
- **Filters stay local per-screen state.** Following the porting brief. The dashboard's `dept_id` is `useState` in `ExecutiveDashboard`, threaded into the query key; it resets on screen entry, matching the web's per-page search param. My Tasks' assignee filter was already local state on the web. No store, no persistence.
- **Data layer.** Hooks in `mobile/lib/queries/*.ts`, keys centralised in `keys.ts`, invalidation in `onSuccess`, no wrapper over the Supabase client. Documented at the top of this plan so Phases 3–5 inherit it.
- **No FlashList.** RN's `FlatList` is already virtualized and already installed; a phone-scale project or task list does not justify a new dependency. Revisit only if a real list proves slow.
- **`isCreativeEmployee` is duplicated, not shared.** It lives in `lib/auth/guards.ts`, which imports `next/navigation` and the server Supabase client and therefore cannot resolve under Metro. Task 1 copies it into `mobile/lib/data.ts` with a comment naming the source and a test pinning the semantics. Role *tier* checks still come from `@shared/rbac`.
- **The same-column no-op write is not reproduced.** The web fires it; it changes nothing, logs nothing, and shows nothing. Skipping it is a fix.
- **Deliverables and Activity are visible but inert.** Project detail's tiles and the employee dashboard's Approval Status panel show their real counts and rows but are not tappable, because their destinations are Phase 3. Same dimmed "· Soon" treatment as the More screen.

## Carried into later phases

- Native date pickers. Dates are `YYYY-MM-DD` text inputs in this phase — the web uses `<input type="date">`, and adding a picker dependency for four optional fields was not worth it. Revisit in Phase 6 polish.
- `DEPT_COLORS` exists both in `mobile/lib/theme.ts` (unused) and in `@shared/rbac` (used by this phase). Delete the theme copy in Phase 6 rather than mid-phase.
- Realtime task/board updates. Reads refetch on invalidation and on TanStack Query's default focus behaviour; live subscription is Phase 5 alongside push.
- Project detail's Deliverables and Activity tiles become real navigation in Phase 3, at which point the "· Soon" affixes come off both there and on the More screen.

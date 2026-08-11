/**
 * Every query key in the app. Hierarchical, broadest segment first, so an
 * invalidation of ['project', id] also clears ['project', id, 'tasks'].
 * Never inline a key at a call site — mutations in one file invalidate keys
 * owned by another, and string drift between them fails silently.
 */
export const qk = {
  /**
   * Both dashboards at once. Every dashboard metric is derived from the whole
   * project/task table, so any project or task mutation makes both stale — and
   * with no focusManager wiring, no RefreshControl and permanently-mounted tab
   * screens, invalidation is their ONLY refresh path.
   */
  dashboards: () => ['dashboard'] as const,
  dashboardExec: (deptId: string | null) => ['dashboard', 'exec', deptId] as const,
  dashboardEmployee: (userId: string) => ['dashboard', 'employee', userId] as const,

  projects: () => ['projects'] as const,
  projectFormOptions: () => ['projects', 'form-options'] as const,

  project: (projectId: string) => ['project', projectId] as const,
  projectTasks: (projectId: string) => ['project', projectId, 'tasks'] as const,
  // Both nested under `project` so the existing qk.project(id) invalidation in
  // the deliverable and task mutations cascades here without new call sites.
  projectDeliverables: (projectId: string) =>
    ['project', projectId, 'deliverables'] as const,
  projectActivity: (projectId: string) => ['project', projectId, 'activity'] as const,
  // Sorted so the same set of department ids in a different order shares one
  // cache entry — `[...deptIds]` avoids mutating the caller's array in place.
  boardMeta: (deptIds: string[]) => ['board-meta', [...deptIds].sort().join(',')] as const,

  task: (taskId: string) => ['task', taskId] as const,
  // Nested under `project` (like projectTasks) because its `projectCreatives`
  // comes from `project_creatives` — adding or removing a creative on the
  // project detail screen invalidates `project(id)` and must cascade here, or
  // the task forms keep offering the old creative list.
  taskPickers: (projectId: string, deptId: string) =>
    ['project', projectId, 'task-pickers', deptId] as const,
  taskConflicts: (
    assignedTo: string,
    startDate: string,
    dueDate: string,
    excludeTaskId: string | null
  ) => ['task-conflicts', assignedTo, startDate, dueDate, excludeTaskId] as const,

  allTasks: () => ['tasks'] as const,

  clients: () => ['clients'] as const,
  // Quotes live under the client that owns them, so a quote mutation
  // invalidating client(id) refreshes the detail screen's quote list for free.
  client: (clientId: string) => ['client', clientId] as const,
};

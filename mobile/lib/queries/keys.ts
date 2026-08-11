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
  // Sorted so the same set of department ids in a different order shares one
  // cache entry — `[...deptIds]` avoids mutating the caller's array in place.
  boardMeta: (deptIds: string[]) => ['board-meta', [...deptIds].sort().join(',')] as const,

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

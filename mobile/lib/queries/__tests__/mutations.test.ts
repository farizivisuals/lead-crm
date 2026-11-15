/**
 * Exercises the mutation CONTROL FLOW that has never run against a real
 * database: createProject's two rollback branches, and saveTask's deliberate
 * additions-before-removals ordering.
 *
 * A hand-rolled recorder stands in for the Supabase client — just enough of the
 * builder chain to observe what would be sent and in what order, which is
 * exactly what these branches get wrong when they get wrong.
 *
 * SCOPE: this does not cover RLS rejection or Postgres trigger side effects.
 * Those still need a live run against a real project.
 */

type Call = { table: string; op: 'insert' | 'update' | 'delete'; payload?: any; filters?: string[] };

// Must be `mock`-prefixed: jest.mock's factory may only reach out-of-scope
// variables whose names begin with "mock".
let mockClient: any;
let calls: Call[];

jest.mock('../../supabase', () => ({
  get supabase() {
    return mockClient;
  },
}));

import { createProject } from '../projects';
import { saveTask } from '../task';

/** A Supabase builder step is both awaitable and further chainable. */
function step<T>(value: T, extra: Record<string, unknown> = {}) {
  return {
    ...extra,
    then: (resolve: (v: T) => unknown, reject?: (e: unknown) => unknown) =>
      Promise.resolve(value).then(resolve, reject),
  };
}

/** `failures` keys are `<table>.<op>`, e.g. 'project_departments.insert'. */
function recordInto(failures: Record<string, Error> = {}) {
  calls = [];
  const fail = (key: string) => failures[key] ?? null;

  mockClient = {
    from(table: string) {
      return {
        insert(payload: unknown) {
          calls.push({ table, op: 'insert', payload });
          const error = fail(`${table}.insert`);
          const res = { data: error ? null : { id: 'project-1' }, error };
          return step(res, { select: () => ({ single: async () => res }) });
        },
        update(payload: unknown) {
          calls.push({ table, op: 'update', payload });
          return { eq: () => step({ error: fail(`${table}.update`) }) };
        },
        delete() {
          const filters: string[] = [];
          calls.push({ table, op: 'delete', filters });
          const chain: any = {
            eq(col: string, val: string) {
              filters.push(`${col}=${val}`);
              return step({ error: fail(`${table}.delete`) }, chain);
            },
            in(col: string, vals: string[]) {
              filters.push(`${col} in [${vals.join(',')}]`);
              return step({ error: fail(`${table}.delete`) }, chain);
            },
          };
          return chain;
        },
      };
    },
  };
}

const projectInput = {
  client_id: 'client-1',
  name: 'Campaign',
  description: '',
  status: 'planning' as const,
  start_date: '',
  target_end_date: '',
  departmentIds: ['dept-video', 'dept-photo'],
  creativeProfileIds: ['creative-1'],
  userId: 'user-1',
};

describe('createProject', () => {
  it('marks only the FIRST selected department primary', async () => {
    recordInto();
    await createProject(projectInput);

    const depts = calls.find((c) => c.table === 'project_departments');
    expect(depts!.payload).toEqual([
      { project_id: 'project-1', department_id: 'dept-video', is_primary: true },
      { project_id: 'project-1', department_id: 'dept-photo', is_primary: false },
    ]);
  });

  it('rolls the project back when the departments insert fails', async () => {
    // Never executed against a real database. Without the rollback this leaves
    // an orphaned project with no departments — which then renders broken in
    // the projects list, because project_departments drives the dept chips.
    recordInto({ 'project_departments.insert': new Error('dept boom') });

    await expect(createProject(projectInput)).rejects.toThrow('dept boom');

    const del = calls.find((c) => c.op === 'delete');
    expect(del).toBeDefined();
    expect(del!.table).toBe('projects');
    expect(del!.filters).toEqual(['id=project-1']);
  });

  it('rolls the project back when the creatives insert fails', async () => {
    recordInto({ 'project_creatives.insert': new Error('creatives boom') });

    await expect(createProject(projectInput)).rejects.toThrow('creatives boom');

    const del = calls.find((c) => c.op === 'delete');
    expect(del!.table).toBe('projects');
    expect(del!.filters).toEqual(['id=project-1']);
  });

  it('does not touch project_creatives when none were selected', async () => {
    recordInto();
    await createProject({ ...projectInput, creativeProfileIds: [] });

    expect(calls.some((c) => c.table === 'project_creatives')).toBe(false);
    expect(calls.some((c) => c.op === 'delete')).toBe(false);
  });
});

const taskInput = {
  taskId: 'task-1',
  title: 'Edit',
  description: '',
  priority: 'medium' as const,
  assigned_to: null,
  current_stage_id: 'stage-1',
  start_date: '2026-08-11',
  due_date: '2026-08-20',
  isShoot: false,
  creativesToAdd: ['creative-new'],
  creativesToRemove: ['creative-old'],
};

describe('saveTask', () => {
  it('adds collaborators BEFORE removing any', async () => {
    // Deliberate ordering: if the insert fails, the task must not already have
    // been stripped of the collaborators it had.
    recordInto();
    await saveTask(taskInput);

    const creativeOps = calls.filter((c) => c.table === 'task_creatives').map((c) => c.op);
    expect(creativeOps).toEqual(['insert', 'delete']);
  });

  it('stops before removing anything when the addition fails', async () => {
    recordInto({ 'task_creatives.insert': new Error('add boom') });

    await expect(saveTask(taskInput)).rejects.toThrow('add boom');
    expect(calls.some((c) => c.table === 'task_creatives' && c.op === 'delete')).toBe(false);
  });

  it('collapses a shoot task onto its start date', async () => {
    recordInto();
    await saveTask({ ...taskInput, isShoot: true });

    const update = calls.find((c) => c.op === 'update');
    expect(update!.payload.due_date).toBe('2026-08-11');
  });
});

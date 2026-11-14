/**
 * removeProjectDepartment's guards: never drop the last department, never drop
 * one that still has tasks, and hand "primary" on when the primary goes.
 */

let mockClient: any;
let ops: string[];

jest.mock('../../supabase', () => ({
  get supabase() {
    return mockClient;
  },
}));

import { removeProjectDepartment, type AssignedDepartment } from '../project-detail';

/** Chainable + awaitable builder that resolves to `value`. */
function chain(value: unknown): any {
  const c: any = {
    eq: () => c,
    then: (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) =>
      Promise.resolve(value).then(res, rej),
  };
  return c;
}

function mockDb(taskCount: number) {
  ops = [];
  mockClient = {
    from: (table: string) => ({
      select: () => chain({ count: taskCount, error: null }),
      delete: () => {
        ops.push(`${table}.delete`);
        return chain({ error: null });
      },
      update: (payload: any) => {
        ops.push(`${table}.update:${JSON.stringify(payload)}`);
        return chain({ error: null });
      },
    }),
  };
}

const video: AssignedDepartment = { department_id: 'v', name: 'Video', slug: 'video', is_primary: true };
const photo: AssignedDepartment = { department_id: 'p', name: 'Photo', slug: 'photo', is_primary: false };

describe('removeProjectDepartment', () => {
  it('refuses to remove the only department', async () => {
    mockDb(0);
    await expect(removeProjectDepartment('proj', video, [video])).rejects.toThrow('at least one');
    expect(ops).toEqual([]);
  });

  it('refuses a department that still has tasks', async () => {
    mockDb(3);
    await expect(removeProjectDepartment('proj', photo, [video, photo])).rejects.toThrow('3 tasks');
    expect(ops).toEqual([]);
  });

  it('removes a non-primary department without touching primary', async () => {
    mockDb(0);
    await removeProjectDepartment('proj', photo, [video, photo]);
    expect(ops).toEqual(['project_departments.delete']);
  });

  it('promotes another department when the primary is removed', async () => {
    mockDb(0);
    await removeProjectDepartment('proj', video, [video, photo]);
    expect(ops).toEqual(['project_departments.delete', 'project_departments.update:{"is_primary":true}']);
  });
});

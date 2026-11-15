/** fetchLinkedTasks: the shoot task an edit follows, and the edits following a shoot. */

let mockClient: any;
let queries: string[];

jest.mock('../../supabase', () => ({
  get supabase() {
    return mockClient;
  },
}));

import { fetchLinkedTasks } from '../task';

function mockDb(rows: Record<string, { id: string; title: string }[]>) {
  queries = [];
  mockClient = {
    from: () => ({
      select: () => ({
        eq: (col: string, val: string) => {
          queries.push(`${col}=${val}`);
          return Promise.resolve({ data: rows[`${col}=${val}`] ?? [], error: null });
        },
      }),
    }),
  };
}

describe('fetchLinkedTasks', () => {
  it('returns the shoot task for an edit task', async () => {
    mockDb({ 'id=shoot': [{ id: 'shoot', title: 'Brand Film' }] });
    const res = await fetchLinkedTasks('edit', 'shoot');
    expect(res.shoot).toEqual({ id: 'shoot', title: 'Brand Film' });
    expect(res.edits).toEqual([]);
  });

  it('returns the edit tasks for a shoot task', async () => {
    mockDb({
      'follows_task_id=shoot': [
        { id: 'e1', title: 'Brand Film — Edit (Ali)' },
        { id: 'e2', title: 'Brand Film — Edit (Sara)' },
      ],
    });
    const res = await fetchLinkedTasks('shoot', null);
    expect(res.shoot).toBeNull();
    expect(res.edits.map((e) => e.id)).toEqual(['e1', 'e2']);
    expect(queries).toEqual(['follows_task_id=shoot']);
  });
});

/**
 * Shared task filters (lib/task-filters.ts), used by the web and mobile
 * calendars and "my tasks" lists.
 */
import { taskKinds, isMine, myTaskFilter, type KindInput } from '@shared/task-filters';

// Video: Pre-production 1, Shoot 2, Post-production 3, Delivered 4.
const SHOOT_POS = { video: 2 };

function t(over: Partial<KindInput> & { id: string }): KindInput {
  return { follows_task_id: null, department_id: 'video', ...over };
}

describe('taskKinds', () => {
  it('a Video/Photo task is a shoot at any stage — its dates are the shoot booking', () => {
    expect(taskKinds([t({ id: 'a' })], SHOOT_POS).get('a')).toBe('shoot');
  });

  it('a linked edit task is an edit wherever it sits', () => {
    const k = taskKinds([t({ id: 's' }), t({ id: 'e', follows_task_id: 's' })], SHOOT_POS);
    expect(k.get('s')).toBe('shoot');
    expect(k.get('e')).toBe('edit');
  });

  it('a department with no Shoot stage is neither', () => {
    expect(taskKinds([t({ id: 'a', department_id: 'pr' })], SHOOT_POS).get('a')).toBe('other');
  });
});

describe('isMine', () => {
  it('counts tasks assigned to me', () => {
    expect(isMine({ assignedTo: 'me', creativeIds: [] }, 'me')).toBe(true);
  });
  it('counts tasks I am a creative on', () => {
    expect(isMine({ assignedTo: 'shooter', creativeIds: ['me'] }, 'me')).toBe(true);
  });
  it('ignores everyone else', () => {
    expect(isMine({ assignedTo: 'shooter', creativeIds: ['ayah'] }, 'me')).toBe(false);
  });
});

describe('myTaskFilter', () => {
  function db(rows: { task_id: string }[] | null, error: unknown = null) {
    const calls: unknown[][] = [];
    const chain = {
      select: (...a: unknown[]) => (calls.push(['select', ...a]), chain),
      eq: (...a: unknown[]) => (calls.push(['eq', ...a]), Promise.resolve({ data: rows, error })),
    };
    return { calls, from: (table: string) => (calls.push(['from', table]), chain) };
  }

  it('includes tasks I am a creative on', async () => {
    const d = db([{ task_id: 't1' }, { task_id: 't2' }]);
    await expect(myTaskFilter(d, 'me')).resolves.toBe('assigned_to.eq.me,id.in.(t1,t2)');
    expect(d.calls).toContainEqual(['from', 'task_creatives']);
    expect(d.calls).toContainEqual(['eq', 'profile_id', 'me']);
  });

  it('falls back to assigned only when I am on no tasks as a creative', async () => {
    await expect(myTaskFilter(db([]), 'me')).resolves.toBe('assigned_to.eq.me');
  });

  it('throws when the lookup fails', async () => {
    await expect(myTaskFilter(db(null, new Error('nope')), 'me')).rejects.toThrow('nope');
  });
});

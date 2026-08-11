jest.mock('../../supabase', () => ({ supabase: {} }));

import {
  toCalendarTask,
  filterByAssignee,
  type CalendarTaskRow,
  type CalendarTask,
} from '../calendar';

const row = (over: Partial<CalendarTaskRow>): CalendarTaskRow => ({
  id: 't1',
  title: 'Edit the reel',
  start_date: '2026-08-11',
  due_date: '2026-08-13',
  assigned_to: 'user-1',
  project_id: 'p1',
  department_stages: { color: '#a78bfa' },
  ...over,
});

describe('toCalendarTask', () => {
  it('spans start_date to due_date', () => {
    const t = toCalendarTask(row({}))!;
    expect(t.day).toBe('2026-08-11');
    expect(t.endDay).toBe('2026-08-13');
    expect(t.color).toBe('#a78bfa');
  });

  it('falls back to the other date when one is missing', () => {
    // The query keeps a task with only one of the two dates, so each must
    // stand in for the other or the bar has no width.
    const onlyDue = toCalendarTask(row({ start_date: null, due_date: '2026-08-20' }))!;
    expect(onlyDue.day).toBe('2026-08-20');
    expect(onlyDue.endDay).toBe('2026-08-20');

    const onlyStart = toCalendarTask(row({ start_date: '2026-08-02', due_date: null }))!;
    expect(onlyStart.day).toBe('2026-08-02');
    expect(onlyStart.endDay).toBe('2026-08-02');
  });

  it('drops a task with no dates at all', () => {
    expect(toCalendarTask(row({ start_date: null, due_date: null }))).toBeNull();
  });

  it('clamps a due date that precedes the start', () => {
    // A negative span would make the lane packer lay out a zero-width bar.
    const t = toCalendarTask(row({ start_date: '2026-08-20', due_date: '2026-08-01' }))!;
    expect(t.endDay).toBe('2026-08-20');
  });

  it('uses the view’s indigo fallback when the stage has no colour', () => {
    expect(toCalendarTask(row({ department_stages: { color: null } }))!.color).toBe('#6366f1');
    expect(toCalendarTask(row({ department_stages: null }))!.color).toBe('#6366f1');
  });

  it('unwraps the stage embed when Supabase returns it as an array', () => {
    const t = toCalendarTask(row({ department_stages: [{ color: '#34d399' }] }))!;
    expect(t.color).toBe('#34d399');
  });
});

describe('filterByAssignee', () => {
  const tasks = [
    { assignedTo: 'me' },
    { assignedTo: 'someone-else' },
    { assignedTo: null },
  ] as CalendarTask[];

  it('keeps everything in "all" scope, including unassigned', () => {
    expect(filterByAssignee(tasks, 'all', 'me')).toHaveLength(3);
  });

  it('keeps only this user’s tasks in "mine" scope', () => {
    const mine = filterByAssignee(tasks, 'mine', 'me');
    expect(mine).toHaveLength(1);
    expect(mine[0].assignedTo).toBe('me');
  });

  it('shows nothing rather than everything when the user id is missing', () => {
    // Failing open here would quietly show the whole agency's tasks under a
    // filter labelled "My tasks".
    expect(filterByAssignee(tasks, 'mine', undefined)).toHaveLength(0);
  });
});

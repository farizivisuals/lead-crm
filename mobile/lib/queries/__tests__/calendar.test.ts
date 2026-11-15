jest.mock('../../supabase', () => ({ supabase: {} }));

import {
  toCalendarTask,
  filterByAssignee,
  calendarAssignees,
  filterByKind,
  toCalendarProject,
  filterProjects,
  type CalendarTaskRow,
  type CalendarTask,
  type CalendarProject,
} from '../calendar';

const row = (over: Partial<CalendarTaskRow>): CalendarTaskRow => ({
  id: 't1',
  title: 'Edit the reel',
  start_date: '2026-08-11',
  due_date: '2026-08-13',
  assigned_to: 'user-1',
  project_id: 'p1',
  department_stages: { color: '#a78bfa' },
  employees: { profiles: { full_name: 'Quintin' } },
  follows_task_id: null,
  department_id: 'video',
  task_creatives: [],
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

  it('carries the creatives on the task', () => {
    const t = toCalendarTask(
      row({ task_creatives: [{ profile_id: 'ayah', employees: { profiles: { full_name: 'Ayah' } } }] })
    )!;
    expect(t.creatives).toEqual([{ id: 'ayah', name: 'Ayah' }]);
    expect(t.kind).toBe('other');
  });

  it('unwraps the stage embed when Supabase returns it as an array', () => {
    const t = toCalendarTask(row({ department_stages: [{ color: '#34d399' }] }))!;
    expect(t.color).toBe('#34d399');
  });
});

describe('filterByAssignee', () => {
  const tasks = [
    { assignedTo: 'me', creatives: [] },
    { assignedTo: 'someone-else', creatives: [] },
    { assignedTo: null, creatives: [] },
  ] as unknown as CalendarTask[];

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

  it('treats any other scope as the profile id being viewed', () => {
    const theirs = filterByAssignee(tasks, 'someone-else', 'me');
    expect(theirs).toHaveLength(1);
    expect(theirs[0].assignedTo).toBe('someone-else');
  });

  it('counts tasks the person is a creative on', () => {
    const shoot = { assignedTo: 'shooter', creatives: [{ id: 'me', name: 'Me' }] } as unknown as CalendarTask;
    expect(filterByAssignee([shoot], 'mine', 'me')).toEqual([shoot]);
    expect(filterByAssignee([shoot], 'me', 'boss')).toEqual([shoot]);
  });

  it('never leaks unassigned work into a named person’s view', () => {
    expect(filterByAssignee(tasks, 'someone-else', 'me').some((t) => !t.assignedTo)).toBe(false);
  });
});

describe('calendarAssignees', () => {
  const tasks = [
    { assignedTo: 'b', assigneeName: 'Quintin', creatives: [] },
    { assignedTo: 'a', assigneeName: 'Anwar', creatives: [{ id: 'c', name: 'Ayah' }] },
    { assignedTo: 'b', assigneeName: 'Quintin', creatives: [] },
    { assignedTo: null, assigneeName: null, creatives: [] },
  ] as unknown as CalendarTask[];

  it('lists each person once, name-sorted, skipping unassigned, including creatives', () => {
    expect(calendarAssignees(tasks)).toEqual([
      { id: 'a', name: 'Anwar' },
      { id: 'c', name: 'Ayah' },
      { id: 'b', name: 'Quintin' },
    ]);
  });

  it('falls back to a placeholder rather than dropping a nameless assignee', () => {
    // A task assigned to someone whose profile embed failed must still be
    // reachable in the picker, or their workload silently vanishes.
    const orphan = [{ assignedTo: 'x', assigneeName: null, creatives: [] }] as unknown as CalendarTask[];
    expect(calendarAssignees(orphan)).toEqual([{ id: 'x', name: 'Unknown' }]);
  });
});

describe('filterByKind', () => {
  const tasks = [
    { id: 's', kind: 'shoot' },
    { id: 'e', kind: 'edit' },
    { id: 'o', kind: 'other' },
  ] as CalendarTask[];

  it('keeps every task for "tasks"', () => {
    expect(filterByKind(tasks, 'tasks')).toHaveLength(3);
  });
  it('keeps only shoots or only edits', () => {
    expect(filterByKind(tasks, 'shoot').map((t) => t.id)).toEqual(['s']);
    expect(filterByKind(tasks, 'edit').map((t) => t.id)).toEqual(['e']);
  });
});

describe('projects', () => {
  it('spans start to target end, falling back to the other date', () => {
    const p = toCalendarProject({ id: 'p1', name: 'Clan', start_date: '2026-11-01', target_end_date: '2026-11-30', project_creatives: [{ profile_id: 'ayah' }] })!;
    expect(p).toMatchObject({ id: 'p1', projectId: 'p1', title: 'Clan', day: '2026-11-01', endDay: '2026-11-30', creativeIds: ['ayah'] });
    expect(toCalendarProject({ id: 'p2', name: 'X', start_date: null, target_end_date: '2026-11-09', project_creatives: [] })!.day).toBe('2026-11-09');
    expect(toCalendarProject({ id: 'p3', name: 'Y', start_date: null, target_end_date: null, project_creatives: [] })).toBeNull();
  });

  const projects = [
    { id: 'p1', projectId: 'p1', creativeIds: ['ayah'] },
    { id: 'p2', projectId: 'p2', creativeIds: [] },
    { id: 'p3', projectId: 'p3', creativeIds: [] },
  ] as unknown as CalendarProject[];
  const tasks = [{ projectId: 'p2', assignedTo: 'ayah', creatives: [] }] as unknown as CalendarTask[];

  it('shows every project in "all" scope', () => {
    expect(filterProjects(projects, tasks, 'all', 'me')).toHaveLength(3);
  });
  it("shows a person's projects: creative on it, or holding a task in it", () => {
    expect(filterProjects(projects, tasks, 'ayah', 'boss').map((p) => p.id)).toEqual(['p1', 'p2']);
    expect(filterProjects(projects, tasks, 'mine', 'ayah').map((p) => p.id)).toEqual(['p1', 'p2']);
  });
  it('shows nothing when the user id is missing', () => {
    expect(filterProjects(projects, tasks, 'mine', undefined)).toHaveLength(0);
  });
});

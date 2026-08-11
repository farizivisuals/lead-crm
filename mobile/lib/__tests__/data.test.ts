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

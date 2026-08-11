jest.mock('../../supabase', () => ({ supabase: {} }));

import {
  dayKey,
  monthRange,
  groupByDay,
  splitCarriedOver,
  type CalendarEvent,
} from '../calendar';

const event = (over: Partial<CalendarEvent>): CalendarEvent => ({
  entity_id: 'e1',
  entity_type: 'task',
  title: 'Task',
  start: '2026-08-11',
  end: null,
  color: null,
  department_id: null,
  client_id: null,
  project_id: 'p1',
  ...over,
});

describe('dayKey', () => {
  it('handles both formats the RPC actually returns', () => {
    // Projects and tasks come back as plain dates; deliverables as timestamps.
    expect(dayKey('2026-07-15')).toBe('2026-07-15');
    expect(dayKey('2026-06-11 10:41:45.971904+00')).toBe('2026-06-11');
  });

  it('does not shift the day, which parsing as a Date would', () => {
    // new Date('2026-01-01') is UTC midnight; rendered west of UTC that is
    // 2025-12-31. Slicing keeps the day the database meant.
    expect(dayKey('2026-01-01')).toBe('2026-01-01');
  });
});

describe('monthRange', () => {
  it('zero-pads and ends on the real last day', () => {
    expect(monthRange(2026, 0)).toEqual({ start: '2026-01-01', end: '2026-01-31' });
    expect(monthRange(2026, 8)).toEqual({ start: '2026-09-01', end: '2026-09-30' });
  });

  it('gets February right in a leap year and a common year', () => {
    expect(monthRange(2024, 1).end).toBe('2024-02-29');
    expect(monthRange(2026, 1).end).toBe('2026-02-28');
  });
});

describe('groupByDay', () => {
  it('buckets by day ascending regardless of input order', () => {
    const groups = groupByDay([
      event({ entity_id: 'b', start: '2026-08-12', title: 'Later' }),
      event({ entity_id: 'a', start: '2026-08-11', title: 'Earlier' }),
    ]);
    expect(groups.map((g) => g.day)).toEqual(['2026-08-11', '2026-08-12']);
  });

  it('puts a timestamped deliverable in the same bucket as a plain-date task', () => {
    const groups = groupByDay([
      event({ entity_id: 't', start: '2026-08-11', title: 'Task' }),
      event({
        entity_id: 'd',
        entity_type: 'deliverable',
        start: '2026-08-11 18:55:27.099832+00',
        title: 'Deliverable',
      }),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].events.map((e) => e.title)).toEqual(['Deliverable', 'Task']);
  });
});

describe('splitCarriedOver', () => {
  it('separates events that started before the month being viewed', () => {
    // The RPC includes anything OVERLAPPING the range, so browsing August also
    // returns a project that started in July. It is real August work, but
    // filing it under a July header while the screen says August reads as a bug.
    const { carriedOver, days } = splitCarriedOver(
      [
        event({ entity_id: 'spans', start: '2026-07-15', title: 'Started in July' }),
        event({ entity_id: 'inside', start: '2026-08-02', title: 'Starts in August' }),
      ],
      '2026-08-01'
    );
    expect(carriedOver.map((e) => e.title)).toEqual(['Started in July']);
    expect(days.map((d) => d.day)).toEqual(['2026-08-02']);
  });

  it('treats an event starting exactly on the first of the month as within it', () => {
    const { carriedOver, days } = splitCarriedOver(
      [event({ start: '2026-08-01' })],
      '2026-08-01'
    );
    expect(carriedOver).toHaveLength(0);
    expect(days).toHaveLength(1);
  });
});

jest.mock('../../supabase', () => ({ supabase: {} }));

import { dayKey, toGridEvent, type CalendarEvent } from '../calendar';

const row = (over: Partial<CalendarEvent>): CalendarEvent => ({
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
    expect(dayKey('2026-08-05 18:55:27.099832+00')).toBe('2026-08-05');
  });

  it('does not shift the day, which parsing as a Date would', () => {
    // new Date('2026-01-01') is UTC midnight; rendered west of UTC that is
    // 2025-12-31. Slicing keeps the day the database meant.
    expect(dayKey('2026-01-01')).toBe('2026-01-01');
  });
});

describe('toGridEvent', () => {
  it('collapses a null end onto the start day', () => {
    // Deliverables have no end and must occupy exactly one cell.
    const e = toGridEvent(row({ entity_type: 'deliverable', start: '2026-08-05 18:55:27+00' }));
    expect(e.day).toBe('2026-08-05');
    expect(e.endDay).toBe('2026-08-05');
  });

  it('keeps a real span for a project', () => {
    const e = toGridEvent(row({ entity_type: 'project', start: '2026-07-15', end: '2026-08-03' }));
    expect(e.day).toBe('2026-07-15');
    expect(e.endDay).toBe('2026-08-03');
  });

  it('clamps an end that precedes the start', () => {
    // A negative span would make the lane packer compute span <= 0 and lay out
    // a bar of zero or negative width. Bad data must not break the grid.
    const e = toGridEvent(row({ start: '2026-08-10', end: '2026-08-01' }));
    expect(e.endDay).toBe('2026-08-10');
  });

  it('namespaces the id by type, so a task and a project cannot collide', () => {
    const t = toGridEvent(row({ entity_type: 'task', entity_id: 'same' }));
    const p = toGridEvent(row({ entity_type: 'project', entity_id: 'same' }));
    expect(t.id).not.toBe(p.id);
  });
});

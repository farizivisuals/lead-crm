/** Shared task time slots (lib/task-time.ts). */
import { slotsOverlap, timeErrors, normalizeTime, timeRange, bookingClashes, readTimes, type Slot } from '@shared/task-time';

const day = (start_time: string | null, end_time: string | null, date = '2026-11-20'): Slot => ({
  start_date: date,
  due_date: date,
  start_time,
  end_time,
});

describe('slotsOverlap', () => {
  it('a morning and an afternoon shoot on the same day do not clash', () => {
    expect(slotsOverlap(day('09:00', '12:00'), day('13:00', '16:00'))).toBe(false);
  });
  it('back-to-back slots do not clash', () => {
    expect(slotsOverlap(day('09:00', '12:00'), day('12:00', '15:00'))).toBe(false);
  });
  it('overlapping times clash', () => {
    expect(slotsOverlap(day('09:00', '12:00'), day('11:00', '14:00'))).toBe(true);
  });
  it('a task with no times takes the whole day', () => {
    expect(slotsOverlap(day(null, null), day('13:00', '16:00'))).toBe(true);
  });
  it('different days never clash', () => {
    expect(slotsOverlap(day('09:00', '12:00'), day('09:00', '12:00', '2026-11-21'))).toBe(false);
  });
  it('a multi-day task with times runs from its first day start to its last day end', () => {
    const edit: Slot = { start_date: '2026-11-20', due_date: '2026-11-22', start_time: '14:00', end_time: '10:00' };
    expect(slotsOverlap(edit, day('09:00', '12:00', '2026-11-21'))).toBe(true);
    expect(slotsOverlap(edit, day('09:00', '12:00', '2026-11-20'))).toBe(false);
    expect(slotsOverlap(edit, day('11:00', '12:00', '2026-11-22'))).toBe(false);
  });
  it('reads Postgres times with seconds', () => {
    expect(slotsOverlap(day('09:00:00', '12:00:00'), day('11:30', '13:00'))).toBe(true);
  });
});

describe('timeErrors', () => {
  it('accepts both times or neither', () => {
    expect(timeErrors(day(null, null))).toBeNull();
    expect(timeErrors(day('09:00', '12:00'))).toBeNull();
  });
  it('wants both times', () => {
    expect(timeErrors(day('09:00', null))).toBe('Add an end time');
    expect(timeErrors(day(null, '12:00'))).toBe('Add a start time');
  });
  it('wants the end after the start on a one-day task', () => {
    expect(timeErrors(day('12:00', '09:00'))).toBe('End time must be after start time');
    expect(timeErrors(day('12:00', '12:00'))).toBe('End time must be after start time');
  });
  it('lets a multi-day task end earlier in the day than it started', () => {
    expect(timeErrors({ start_date: '2026-11-20', due_date: '2026-11-21', start_time: '14:00', end_time: '10:00' })).toBeNull();
  });
});

describe('normalizeTime', () => {
  it('pads hours and accepts a bare hour', () => {
    expect(normalizeTime('9:00')).toBe('09:00');
    expect(normalizeTime('9')).toBe('09:00');
    expect(normalizeTime(' 13:30 ')).toBe('13:30');
  });
  it('treats blank as no time', () => {
    expect(normalizeTime('')).toBeNull();
  });
  it('rejects nonsense', () => {
    expect(normalizeTime('25:00')).toBe('invalid');
    expect(normalizeTime('9:75')).toBe('invalid');
    expect(normalizeTime('noon')).toBe('invalid');
  });
});

describe('timeRange', () => {
  it('formats a slot, dropping seconds', () => {
    expect(timeRange('09:00:00', '12:00:00')).toBe('09:00–12:00');
  });
  it('is empty with no times', () => {
    expect(timeRange(null, null)).toBe('');
  });
});

describe('bookingClashes', () => {
  function db(rows: unknown[]) {
    const calls: unknown[][] = [];
    const chain: any = {
      then: (resolve: (v: unknown) => void) => resolve({ data: rows, error: null }),
    };
    for (const m of ['select', 'eq', 'not', 'lte', 'gte', 'neq']) {
      chain[m] = (...a: unknown[]) => (calls.push([m, ...a]), chain);
    }
    return { calls, from: (t: string) => (calls.push(['from', t]), chain) };
  }

  it('warns once they already have 2 tasks then, listing only the overlapping ones', async () => {
    const d = db([
      { id: 'a', title: 'Brev shoot', ...day('09:00:00', '12:00:00') },
      { id: 'c', title: 'Photo shoot', ...day('10:00:00', '11:30:00') },
      { id: 'b', title: 'Zill photos', ...day('13:00:00', '16:00:00') },
    ]);
    const clashes = await bookingClashes(d, 'dawood', day('10:00', '11:00'), null);
    expect(clashes).toEqual([
      { id: 'a', title: 'Brev shoot', when: '09:00–12:00' },
      { id: 'c', title: 'Photo shoot', when: '10:00–11:30' },
    ]);
    expect(d.calls).toContainEqual(['eq', 'assigned_to', 'dawood']);
  });

  it('says nothing when they have just 1 other task then (2 at once is fine)', async () => {
    const d = db([
      { id: 'a', title: 'Brev shoot', ...day('09:00:00', '12:00:00') },
      { id: 'b', title: 'Zill photos', ...day('13:00:00', '16:00:00') },
    ]);
    expect(await bookingClashes(d, 'dawood', day('10:00', '11:00'), null)).toEqual([]);
  });

  it('skips the task being edited', async () => {
    const d = db([]);
    await bookingClashes(d, 'dawood', day('10:00', '11:00'), 't1');
    expect(d.calls).toContainEqual(['neq', 'id', 't1']);
  });
});

describe('readTimes (mobile text fields)', () => {
  it('normalises typed times', () => {
    expect(readTimes('9', '12:30', '2026-11-20', '2026-11-20')).toEqual({ start_time: '09:00', end_time: '12:30', problem: null });
  });
  it('blank means all day', () => {
    expect(readTimes('', '', '2026-11-20', '2026-11-20')).toEqual({ start_time: null, end_time: null, problem: null });
  });
  it('explains a bad time', () => {
    expect(readTimes('noon', '', '2026-11-20', '2026-11-20').problem).toBe('Use times like 09:00 or 13:30');
    expect(readTimes('12:00', '9:00', '2026-11-20', '2026-11-20').problem).toBe('End time must be after start time');
  });
});

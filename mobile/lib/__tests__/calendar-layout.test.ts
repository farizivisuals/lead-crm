import {
  monthGrid,
  gridRange,
  layoutWeek,
  eventsOnDay,
  addDays,
  daysBetween,
  type LaidOutEvent,
} from '../calendar-layout';

const ev = (id: string, day: string, endDay = day): LaidOutEvent => ({
  id,
  title: id,
  day,
  endDay,
  color: null,
});

describe('monthGrid', () => {
  it('always returns 6 whole Sunday-first weeks', () => {
    const weeks = monthGrid(2026, 7); // August 2026
    expect(weeks).toHaveLength(6);
    expect(weeks.every((w) => w.length === 7)).toBe(true);
    // Aug 1 2026 is a Saturday, so the grid opens on Sun Jul 26.
    expect(weeks[0][0]).toBe('2026-07-26');
    expect(weeks[0][6]).toBe('2026-08-01');
  });

  it('covers the whole month even when it starts on a Sunday', () => {
    // Nov 2026 starts on a Sunday — the grid must not skip a leading week.
    const weeks = monthGrid(2026, 10);
    expect(weeks[0][0]).toBe('2026-11-01');
    expect(weeks.flat()).toContain('2026-11-30');
  });

  it('gridRange spans the visible grid, not just the month', () => {
    // The query must cover adjacent-month cells or their bars render blank.
    expect(gridRange(2026, 7)).toEqual({ start: '2026-07-26', end: '2026-09-05' });
  });
});

describe('date arithmetic', () => {
  it('crosses month and year boundaries', () => {
    expect(addDays('2026-08-31', 1)).toBe('2026-09-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('handles a leap day', () => {
    expect(addDays('2024-02-28', 1)).toBe('2024-02-29');
    expect(daysBetween('2024-02-28', '2024-03-01')).toBe(2);
  });
});

describe('layoutWeek', () => {
  const week = monthGrid(2026, 7)[1]; // Sun 2026-08-02 .. Sat 2026-08-08

  it('spans a multi-day event across cells', () => {
    const [seg] = layoutWeek([ev('a', '2026-08-03', '2026-08-05')], week, 3).segments;
    expect(seg.startIndex).toBe(1);
    expect(seg.span).toBe(3);
    expect(seg.continuesLeft).toBe(false);
    expect(seg.continuesRight).toBe(false);
  });

  it('clips an event that began before the week and flags it', () => {
    // This is what replaces the "Started earlier, still running" group: a
    // project running in from last week is simply a bar with a flat left edge.
    const [seg] = layoutWeek([ev('a', '2026-07-30', '2026-08-04')], week, 3).segments;
    expect(seg.startIndex).toBe(0);
    expect(seg.span).toBe(3);
    expect(seg.continuesLeft).toBe(true);
    expect(seg.continuesRight).toBe(false);
  });

  it('flags an event running past the week end', () => {
    const [seg] = layoutWeek([ev('a', '2026-08-07', '2026-08-20')], week, 3).segments;
    expect(seg.span).toBe(2);
    expect(seg.continuesRight).toBe(true);
  });

  it('gives overlapping events separate lanes', () => {
    const { segments } = layoutWeek(
      [ev('a', '2026-08-03', '2026-08-05'), ev('b', '2026-08-04', '2026-08-06')],
      week,
      3
    );
    expect(new Set(segments.map((s) => s.lane)).size).toBe(2);
  });

  it('reuses a lane when two events do not overlap', () => {
    const { segments } = layoutWeek(
      [ev('a', '2026-08-02', '2026-08-03'), ev('b', '2026-08-06', '2026-08-07')],
      week,
      3
    );
    expect(segments.every((s) => s.lane === 0)).toBe(true);
  });

  it('puts the longest bar in the top lane so it reads as one bar', () => {
    const { segments } = layoutWeek(
      [ev('short', '2026-08-04'), ev('long', '2026-08-02', '2026-08-08')],
      week,
      3
    );
    expect(segments.find((s) => s.event.id === 'long')!.lane).toBe(0);
    expect(segments.find((s) => s.event.id === 'short')!.lane).toBe(1);
  });

  it('counts hidden bars per day instead of drawing them', () => {
    const many = [
      ev('a', '2026-08-04'),
      ev('b', '2026-08-04'),
      ev('c', '2026-08-04'),
      ev('d', '2026-08-04'),
      ev('e', '2026-08-04'),
    ];
    const { segments, overflow } = layoutWeek(many, week, 3);
    expect(segments).toHaveLength(3);
    expect(overflow[2]).toBe(2); // Tue index 2 hides two
    expect(overflow[0]).toBe(0);
  });

  it('ignores events from other weeks entirely', () => {
    const { segments } = layoutWeek([ev('a', '2026-09-20')], week, 3);
    expect(segments).toHaveLength(0);
  });

  it('reports zero lanes for an empty week so the row can collapse', () => {
    // A week reserving full height with nothing in it pushed the detail panel
    // off the bottom of the screen.
    const layout = layoutWeek([], week, 3);
    expect(layout.laneCount).toBe(0);
    expect(layout.hasOverflow).toBe(false);
  });

  it('reports only the lanes actually used', () => {
    const layout = layoutWeek([ev('a', '2026-08-03'), ev('b', '2026-08-06')], week, 3);
    expect(layout.laneCount).toBe(1); // both fit lane 0, they do not overlap
  });

  it('flags overflow so the row can reserve a "+N" line', () => {
    const many = ['a', 'b', 'c', 'd'].map((id) => ev(id, '2026-08-04'));
    const layout = layoutWeek(many, week, 3);
    expect(layout.laneCount).toBe(3);
    expect(layout.hasOverflow).toBe(true);
  });
});

describe('eventsOnDay', () => {
  it('includes a multi-day event on every day it covers', () => {
    const events = [ev('span', '2026-08-03', '2026-08-05'), ev('other', '2026-08-09')];
    expect(eventsOnDay(events, '2026-08-04').map((e) => e.id)).toEqual(['span']);
    expect(eventsOnDay(events, '2026-08-06')).toHaveLength(0);
  });
});

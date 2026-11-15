/**
 * Month-grid layout: turns a flat event list into positioned bars.
 *
 * All of this is pure string/index arithmetic on 'YYYY-MM-DD' keys. Nothing
 * here parses a Date from a plain date string — that reads as UTC midnight and
 * renders a day early west of UTC, which is the bug this whole screen kept
 * hitting.
 */

export type LaidOutEvent = {
  id: string;
  title: string;
  day: string;
  /** Inclusive last day. Same as `day` for a single-day event. */
  endDay: string;
  color: string | null;
};

/** One bar: which lane it sits in, where it starts, how many cells it covers. */
export type Segment<E extends LaidOutEvent> = {
  event: E;
  lane: number;
  startIndex: number;
  span: number;
  /** True when the event began before this week — draw the left edge flat. */
  continuesLeft: boolean;
  /** True when it runs past this week's end. */
  continuesRight: boolean;
};

export type WeekLayout<E extends LaidOutEvent> = {
  days: string[];
  segments: Segment<E>[];
  /** Hidden-bar count per day index, for the "+N" marker. */
  overflow: number[];
  /**
   * Lanes this week actually uses. Rows size to this rather than to maxLanes,
   * so an empty week collapses instead of reserving four lanes of blank space
   * and pushing the detail panel off-screen.
   */
  laneCount: number;
  /** True when any day needs a "+N" row beneath the bars. */
  hasOverflow: boolean;
};

const DAY_MS = 86_400_000;

/** 'YYYY-MM-DD' -> UTC epoch ms. Explicitly UTC so no local offset creeps in. */
export function dayToUtc(day: string): number {
  const [y, m, d] = day.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

/** UTC epoch ms -> 'YYYY-MM-DD'. */
export function utcToDay(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export function addDays(day: string, n: number): string {
  return utcToDay(dayToUtc(day) + n * DAY_MS);
}

export function daysBetween(from: string, to: string): number {
  return Math.round((dayToUtc(to) - dayToUtc(from)) / DAY_MS);
}

/**
 * The full grid a month is drawn on: whole weeks, Sunday-first, including the
 * adjacent-month days that fill the first and last rows. Always 6 rows, so the
 * grid does not change height as you page between months.
 */
export function monthGrid(year: number, month: number): string[][] {
  const first = new Date(Date.UTC(year, month, 1));
  const gridStart = utcToDay(first.getTime() - first.getUTCDay() * DAY_MS);
  const weeks: string[][] = [];
  for (let w = 0; w < 6; w++) {
    weeks.push(Array.from({ length: 7 }, (_, d) => addDays(gridStart, w * 7 + d)));
  }
  return weeks;
}

/** First and last day the grid shows — what the query range must cover. */
export function gridRange(year: number, month: number): { start: string; end: string } {
  const weeks = monthGrid(year, month);
  return { start: weeks[0][0], end: weeks[5][6] };
}

/**
 * Places one week's bars.
 *
 * Longer events are laid out first so a multi-day bar takes a low lane and the
 * single-day chips flow underneath it, which is what makes a spanning event
 * readable as one continuous bar rather than a staircase.
 */
export function layoutWeek<E extends LaidOutEvent>(
  events: E[],
  days: string[],
  maxLanes: number
): WeekLayout<E> {
  const weekStart = days[0];
  const weekEnd = days[days.length - 1];

  const clipped = events
    .filter((e) => e.day <= weekEnd && e.endDay >= weekStart)
    .map((e) => {
      const startIndex = Math.max(0, daysBetween(weekStart, e.day));
      const endIndex = Math.min(days.length - 1, daysBetween(weekStart, e.endDay));
      return {
        event: e,
        startIndex,
        span: endIndex - startIndex + 1,
        continuesLeft: e.day < weekStart,
        continuesRight: e.endDay > weekEnd,
      };
    })
    .sort((a, b) => b.span - a.span || a.startIndex - b.startIndex || a.event.id.localeCompare(b.event.id));

  // lanes[i] holds the day indices already occupied in lane i.
  const lanes: boolean[][] = [];
  const segments: Segment<E>[] = [];
  const overflow = new Array(days.length).fill(0);

  for (const c of clipped) {
    let lane = 0;
    for (;;) {
      if (!lanes[lane]) lanes[lane] = new Array(days.length).fill(false);
      const free = lanes[lane]
        .slice(c.startIndex, c.startIndex + c.span)
        .every((taken) => !taken);
      if (free) break;
      lane++;
    }
    for (let i = c.startIndex; i < c.startIndex + c.span; i++) lanes[lane][i] = true;

    if (lane < maxLanes) {
      segments.push({ ...c, lane });
    } else {
      for (let i = c.startIndex; i < c.startIndex + c.span; i++) overflow[i]++;
    }
  }

  const laneCount = segments.reduce((max, s) => Math.max(max, s.lane + 1), 0);
  return { days, segments, overflow, laneCount, hasOverflow: overflow.some((n) => n > 0) };
}

/** Every event touching a given day, for the detail panel below the grid. */
export function eventsOnDay<E extends LaidOutEvent>(events: E[], day: string): E[] {
  return events
    .filter((e) => e.day <= day && e.endDay >= day)
    .sort((a, b) => a.day.localeCompare(b.day) || a.title.localeCompare(b.title));
}

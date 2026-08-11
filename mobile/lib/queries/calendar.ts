import { useQuery } from '@tanstack/react-query';
import { supabase } from '../supabase';
import { qk } from './keys';
import { gridRange, type LaidOutEvent } from '../calendar-layout';

export type CalendarEvent = {
  entity_id: string;
  entity_type: 'project' | 'task' | 'deliverable';
  title: string;
  start: string;
  end: string | null;
  color: string | null;
  department_id: string | null;
  client_id: string | null;
  project_id: string | null;
};

/** A month-grid event: the raw row plus the day keys the grid positions it by. */
export type GridEvent = LaidOutEvent & { source: CalendarEvent };

/**
 * get_calendar_events returns `start` as TEXT, and the formats are NOT uniform:
 * projects and tasks come back as plain dates ("2026-07-15") while deliverables
 * come back as full timestamps ("2026-08-05 18:55:27+00"). Slicing the first ten
 * characters is deliberate — `new Date(...)` on a plain date string parses as
 * UTC midnight and then renders in local time, dragging events onto the
 * previous day for anyone west of UTC.
 */
export function dayKey(start: string): string {
  return start.slice(0, 10);
}

/** Deliverables have no `end`; they occupy a single cell. */
export function toGridEvent(e: CalendarEvent): GridEvent {
  const day = dayKey(e.start);
  const endDay = e.end ? dayKey(e.end) : day;
  return {
    id: `${e.entity_type}-${e.entity_id}`,
    title: e.title,
    day,
    // A malformed row with end before start would produce a negative span and
    // break the lane packer; clamp instead of trusting the data.
    endDay: endDay < day ? day : endDay,
    color: e.color,
    source: e,
  };
}

export function useCalendar(year: number, month: number) {
  // The grid shows adjacent-month days in its first and last rows, so the
  // query must cover the whole grid — not just the month, or those cells
  // render blank.
  const { start, end } = gridRange(year, month);
  return useQuery({
    queryKey: qk.calendar(start),
    queryFn: async (): Promise<GridEvent[]> => {
      // SECURITY INVOKER, so RLS scopes this to what the caller can see.
      const { data, error } = await supabase.rpc('get_calendar_events', {
        p_start: start,
        p_end: end,
      });
      if (error) throw error;
      return ((data ?? []) as CalendarEvent[]).map(toGridEvent);
    },
  });
}

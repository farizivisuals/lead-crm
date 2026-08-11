import { useQuery } from '@tanstack/react-query';
import { supabase } from '../supabase';
import { qk } from './keys';

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

export type DayGroup = { day: string; events: CalendarEvent[] };

/**
 * get_calendar_events returns `start` as TEXT, and the formats are NOT uniform:
 * projects and tasks come back as plain dates ("2026-07-15") while deliverables
 * come back as full timestamps ("2026-06-11 10:41:45.971904+00"). Slicing the
 * first ten characters is deliberate — `new Date(...)` on a plain date string
 * parses as UTC midnight and then renders in local time, which drags events
 * onto the previous day for anyone west of UTC.
 */
export function dayKey(start: string): string {
  return start.slice(0, 10);
}

/** Zero-padded YYYY-MM-DD for the first and last day of a month. */
export function monthRange(year: number, month: number): { start: string; end: string } {
  const pad = (n: number) => String(n).padStart(2, '0');
  // Day 0 of the next month is the last day of this one.
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return {
    start: `${year}-${pad(month + 1)}-01`,
    end: `${year}-${pad(month + 1)}-${pad(lastDay)}`,
  };
}

/** Groups events under their day, days ascending, each day's events by title. */
export function groupByDay(events: CalendarEvent[]): DayGroup[] {
  const byDay = new Map<string, CalendarEvent[]>();
  for (const event of events) {
    const key = dayKey(event.start);
    const bucket = byDay.get(key);
    if (bucket) bucket.push(event);
    else byDay.set(key, [event]);
  }
  return [...byDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, dayEvents]) => ({
      day,
      events: [...dayEvents].sort((a, b) => a.title.localeCompare(b.title)),
    }));
}

export function useCalendar(year: number, month: number) {
  const { start, end } = monthRange(year, month);
  return useQuery({
    queryKey: qk.calendar(start),
    queryFn: async (): Promise<CalendarEvent[]> => {
      // SECURITY INVOKER, so RLS scopes this to what the caller can see.
      const { data, error } = await supabase.rpc('get_calendar_events', {
        p_start: start,
        p_end: end,
      });
      if (error) throw error;
      return (data ?? []) as CalendarEvent[];
    },
  });
}

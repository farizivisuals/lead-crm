import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen } from '../../components/ui/Screen';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { useCalendar, type GridEvent } from '../../lib/queries/calendar';
import {
  monthGrid,
  layoutWeek,
  eventsOnDay,
  utcToDay,
} from '../../lib/calendar-layout';
import { theme } from '../../lib/theme';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const TYPE_LABELS: Record<GridEvent['source']['entity_type'], string> = {
  project: 'Project',
  task: 'Task',
  deliverable: 'Deliverable',
};

const FALLBACK_COLOR = '#71717a';
/** Bars per cell before the rest collapse into "+N". Four rows fit the cell. */
const MAX_LANES = 4;
const LANE_HEIGHT = 15;
/** Extra line a week reserves when any day collapses bars into "+N". */
const OVERFLOW_HEIGHT = 12;

export default function CalendarScreen() {
  const router = useRouter();
  const todayKey = utcToDay(Date.now());

  const [year, setYear] = useState(() => new Date().getFullYear());
  const [month, setMonth] = useState(() => new Date().getMonth());
  const [selected, setSelected] = useState(todayKey);

  const { data, isLoading, error } = useCalendar(year, month);
  const events = useMemo(() => data ?? [], [data]);

  const weeks = useMemo(() => monthGrid(year, month), [year, month]);
  const layouts = useMemo(
    () => weeks.map((days) => layoutWeek(events, days, MAX_LANES)),
    [weeks, events]
  );
  const selectedEvents = useMemo(() => eventsOnDay(events, selected), [events, selected]);

  function shift(by: number) {
    const next = month + by;
    if (next < 0) {
      setMonth(11);
      setYear((y) => y - 1);
    } else if (next > 11) {
      setMonth(0);
      setYear((y) => y + 1);
    } else {
      setMonth(next);
    }
  }

  function open(event: GridEvent) {
    const src = event.source;
    const projectId = src.entity_type === 'project' ? src.entity_id : src.project_id;
    if (!projectId) return;
    router.push({ pathname: '/projects/[projectId]', params: { projectId } });
  }

  return (
    <Screen>
      <View style={styles.root}>
        <ScreenHeader
          title="Calendar"
          right={
            <Pressable onPress={() => { setYear(new Date().getFullYear()); setMonth(new Date().getMonth()); setSelected(todayKey); }} hitSlop={10}>
              <Text style={styles.today}>Today</Text>
            </Pressable>
          }
        />

        <View style={styles.monthBar}>
          <Pressable onPress={() => shift(-1)} hitSlop={14}>
            <Text style={styles.arrow}>‹</Text>
          </Pressable>
          <Text style={styles.month}>
            {MONTHS[month]} {year}
          </Text>
          <Pressable onPress={() => shift(1)} hitSlop={14}>
            <Text style={styles.arrow}>›</Text>
          </Pressable>
        </View>

        <View style={styles.weekdayRow}>
          {WEEKDAYS.map((d) => (
            <Text key={d} style={styles.weekday}>
              {d}
            </Text>
          ))}
        </View>

        {error ? <Text style={styles.error}>{error.message}</Text> : null}

        <View style={styles.grid}>
          {layouts.map((week, wi) => (
            <View key={wi} style={styles.week}>
              {/* Day numbers and the tap targets sit underneath the bars. */}
              <View style={styles.dayNumbers}>
                {week.days.map((day) => {
                  const inMonth = Number(day.slice(5, 7)) === month + 1;
                  const isToday = day === todayKey;
                  const isSelected = day === selected;
                  return (
                    <Pressable key={day} style={styles.dayCell} onPress={() => setSelected(day)}>
                      <View
                        style={[
                          styles.dayNumberWrap,
                          isToday && styles.todayWrap,
                          isSelected && !isToday && styles.selectedWrap,
                        ]}
                      >
                        <Text
                          style={[
                            styles.dayNumber,
                            !inMonth && styles.dayNumberOutside,
                            (isToday || isSelected) && styles.dayNumberActive,
                          ]}
                        >
                          {Number(day.slice(8, 10))}
                        </Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>

              {/* Bars are absolutely positioned so one can span several cells.
                  Height follows the lanes this week actually uses, so empty
                  weeks collapse and the detail panel keeps its room. */}
              <View
                style={{
                  height:
                    week.laneCount * LANE_HEIGHT + (week.hasOverflow ? OVERFLOW_HEIGHT : 0),
                  marginTop: week.laneCount > 0 ? 2 : 0,
                }}
              >
                {week.segments.map((seg) => (
                  <Pressable
                    key={`${seg.event.id}-${seg.startIndex}`}
                    onPress={() => open(seg.event)}
                    style={[
                      styles.bar,
                      {
                        top: seg.lane * LANE_HEIGHT,
                        left: `${(seg.startIndex / 7) * 100}%`,
                        width: `${(seg.span / 7) * 100}%`,
                        backgroundColor: (seg.event.color ?? FALLBACK_COLOR) + '33',
                        borderLeftColor: seg.event.color ?? FALLBACK_COLOR,
                      },
                      seg.continuesLeft && styles.barContinuesLeft,
                      seg.continuesRight && styles.barContinuesRight,
                    ]}
                  >
                    <Text style={styles.barText} numberOfLines={1}>
                      {seg.event.title}
                    </Text>
                  </Pressable>
                ))}
                {week.overflow.map((count, i) =>
                  count > 0 ? (
                    <Text
                      key={`ov-${i}`}
                      style={[styles.overflow, { left: `${(i / 7) * 100}%`, top: week.laneCount * LANE_HEIGHT }]}
                    >
                      +{count}
                    </Text>
                  ) : null
                )}
              </View>
            </View>
          ))}
        </View>

        {/* Detail panel for the selected day. */}
        <View style={styles.panel}>
          <View style={styles.panelHead}>
            <Text style={styles.panelTitle}>{formatDay(selected)}</Text>
            {selected === todayKey ? <Text style={styles.today}>Today</Text> : null}
          </View>
          <ScrollView contentContainerStyle={styles.panelScroll}>
            {isLoading ? (
              <Text style={styles.muted}>Loading…</Text>
            ) : selectedEvents.length === 0 ? (
              <Text style={styles.muted}>Nothing on this day</Text>
            ) : (
              selectedEvents.map((event) => (
                <Pressable key={event.id} onPress={() => open(event)} style={styles.detailRow}>
                  <View
                    style={[styles.dot, { borderColor: event.color ?? FALLBACK_COLOR }]}
                  />
                  <View style={styles.flex}>
                    <Text style={styles.detailTitle} numberOfLines={1}>
                      {event.title}
                    </Text>
                    <Text style={styles.detailMeta}>
                      {TYPE_LABELS[event.source.entity_type]}
                      {event.endDay !== event.day
                        ? ` · ${formatShort(event.day)} – ${formatShort(event.endDay)}`
                        : ''}
                    </Text>
                  </View>
                </Pressable>
              ))
            )}
          </ScrollView>
        </View>
      </View>
    </Screen>
  );
}

/** Built from the parts so a plain date never shifts a day by timezone. */
function formatDay(day: string): string {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', {
    weekday: 'short',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  });
}

function formatShort(day: string): string {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  });
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: 12 },
  today: { color: theme.text.label, fontSize: 13, fontWeight: '600' },
  monthBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    marginBottom: 8,
  },
  arrow: { color: '#fff', fontSize: 26, paddingHorizontal: 14 },
  month: { color: '#fff', fontSize: 16, fontWeight: '600' },
  weekdayRow: { flexDirection: 'row' },
  weekday: {
    flex: 1,
    textAlign: 'center',
    color: theme.text.dimmer,
    fontSize: 10,
    fontWeight: '500',
    paddingBottom: 4,
  },
  grid: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.colors.border },
  week: {
    minHeight: 44,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
    paddingBottom: 2,
  },
  dayNumbers: { flexDirection: 'row' },
  dayCell: { flex: 1, alignItems: 'center', paddingTop: 4 },
  dayNumberWrap: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  todayWrap: { backgroundColor: '#6366f1' },
  selectedWrap: { backgroundColor: theme.colors.glassStrong },
  dayNumber: { color: theme.colors.foreground, fontSize: 12, fontWeight: '500' },
  dayNumberOutside: { color: theme.text.dimmer },
  dayNumberActive: { color: '#fff', fontWeight: '700' },
  bar: {
    position: 'absolute',
    height: LANE_HEIGHT - 2,
    borderRadius: 3,
    borderLeftWidth: 2,
    paddingHorizontal: 3,
    justifyContent: 'center',
  },
  // A bar running in from the previous week loses its rounded leading edge, so
  // it reads as one continuous run rather than a new event each Sunday.
  barContinuesLeft: { borderTopLeftRadius: 0, borderBottomLeftRadius: 0, borderLeftWidth: 0 },
  barContinuesRight: { borderTopRightRadius: 0, borderBottomRightRadius: 0 },
  barText: { color: '#fff', fontSize: 9, fontWeight: '500' },
  overflow: { position: 'absolute', color: theme.text.dim, fontSize: 9, paddingLeft: 4 },
  panel: {
    flex: 1,
    marginTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.border,
  },
  panelHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 4,
  },
  panelTitle: { color: '#fff', fontSize: 15, fontWeight: '600' },
  panelScroll: { paddingBottom: 120, gap: 2 },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingHorizontal: 4 },
  dot: { width: 16, height: 16, borderRadius: 8, borderWidth: 2 },
  flex: { flex: 1 },
  detailTitle: { color: '#fff', fontSize: 15, fontWeight: '600' },
  detailMeta: { color: theme.text.dim, fontSize: 12, marginTop: 2 },
  muted: { color: theme.text.dim, fontSize: 13, paddingHorizontal: 4, paddingVertical: 12 },
  error: { color: '#f87171', fontSize: 13, paddingVertical: 6 },
});

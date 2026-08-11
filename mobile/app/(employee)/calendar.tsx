import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen } from '../../components/ui/Screen';
import { GlassCard } from '../../components/ui/GlassCard';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import {
  useCalendar,
  groupByDay,
  type CalendarEvent,
} from '../../lib/queries/calendar';
import { theme } from '../../lib/theme';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const TYPE_LABELS: Record<CalendarEvent['entity_type'], string> = {
  project: 'Project',
  task: 'Task',
  deliverable: 'Deliverable',
};

const FALLBACK_COLOR = '#71717a';

export default function CalendarScreen() {
  const router = useRouter();
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());

  const { data, isLoading, error } = useCalendar(year, month);
  const groups = groupByDay(data ?? []);

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

  function open(event: CalendarEvent) {
    // Tasks and deliverables both resolve to the project that owns them; the
    // board and the deliverables list are one tap further in.
    const projectId = event.entity_type === 'project' ? event.entity_id : event.project_id;
    if (!projectId) return;
    router.push({ pathname: '/projects/[projectId]', params: { projectId } });
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.scroll}>
        <ScreenHeader title="Calendar" />

        <View style={styles.monthBar}>
          <Pressable onPress={() => shift(-1)} hitSlop={12}>
            <Text style={styles.arrow}>‹</Text>
          </Pressable>
          <Text style={styles.month}>
            {MONTHS[month]} {year}
          </Text>
          <Pressable onPress={() => shift(1)} hitSlop={12}>
            <Text style={styles.arrow}>›</Text>
          </Pressable>
        </View>

        {error ? <Text style={styles.error}>{error.message}</Text> : null}

        {isLoading ? (
          <Text style={styles.muted}>Loading…</Text>
        ) : error ? null : groups.length === 0 ? (
          <GlassCard>
            <Text style={styles.muted}>Nothing scheduled this month</Text>
          </GlassCard>
        ) : (
          groups.map((group) => (
            <View key={group.day} style={styles.dayBlock}>
              <Text style={styles.dayLabel}>{formatDay(group.day)}</Text>
              {group.events.map((event) => (
                <Pressable key={`${event.entity_type}-${event.entity_id}`} onPress={() => open(event)}>
                  <GlassCard>
                    <View style={styles.eventRow}>
                      <View
                        style={[styles.dot, { backgroundColor: event.color ?? FALLBACK_COLOR }]}
                      />
                      <Text style={styles.title} numberOfLines={2}>
                        {event.title}
                      </Text>
                    </View>
                    <Text style={styles.type}>{TYPE_LABELS[event.entity_type]}</Text>
                  </GlassCard>
                </Pressable>
              ))}
            </View>
          ))
        )}
      </ScrollView>
    </Screen>
  );
}

/** "2026-08-11" -> "Tue 11 August". Built from the parts so no timezone shift. */
function formatDay(day: string): string {
  const [y, m, d] = day.split('-').map(Number);
  const weekday = new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', {
    weekday: 'short',
    timeZone: 'UTC',
  });
  return `${weekday} ${d} ${MONTHS[m - 1]}`;
}

const styles = StyleSheet.create({
  scroll: { padding: 20, gap: 12, paddingBottom: 140 },
  monthBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  arrow: { color: '#fff', fontSize: 28, fontWeight: '400', paddingHorizontal: 12 },
  month: { color: '#fff', fontSize: 17, fontWeight: '600' },
  dayBlock: { gap: 8, marginTop: 8 },
  dayLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: theme.text.label,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  eventRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  title: { color: '#fff', fontSize: 15, fontWeight: '600', flex: 1 },
  type: { color: theme.text.dim, fontSize: 12, marginTop: 6 },
  muted: { color: theme.text.dim, fontSize: 13 },
  error: { color: '#f87171', fontSize: 13 },
});

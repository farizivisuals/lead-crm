import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen } from '../../components/ui/Screen';
import { GlassCard } from '../../components/ui/GlassCard';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { useAuth } from '../../lib/auth';
import { useClientId, usePortalCalendar, type PortalCalendarEvent } from '../../lib/queries/portal';
import { theme } from '../../lib/theme';

const KIND_LABELS: Record<PortalCalendarEvent['kind'], string> = {
  project: 'Project deadline',
  task: 'Task due',
  deliverable: 'Deliverable shared',
};

const FALLBACK_COLOR = '#71717a';

export default function ClientCalendar() {
  const router = useRouter();
  const { session } = useAuth();
  const context = useClientId(session?.user.id);
  const { data, isLoading, error } = usePortalCalendar(context.data?.clientId);

  const events = data ?? [];
  const days = [...new Set(events.map((e) => e.day))];

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.scroll}>
        <ScreenHeader title="Calendar" subtitle={context.data?.companyName} />

        {context.error ? <Text style={styles.error}>{context.error.message}</Text> : null}
        {error ? <Text style={styles.error}>{error.message}</Text> : null}

        {context.isLoading || isLoading ? (
          <Text style={styles.muted}>Loading…</Text>
        ) : context.error || error ? null : events.length === 0 ? (
          <GlassCard>
            <Text style={styles.muted}>Nothing scheduled</Text>
          </GlassCard>
        ) : (
          days.map((day) => (
            <View key={day} style={styles.dayBlock}>
              <Text style={styles.dayLabel}>{formatDay(day)}</Text>
              {events
                .filter((e) => e.day === day)
                .map((event) => (
                  <Pressable
                    key={event.id}
                    onPress={() =>
                      router.push({
                        pathname: '/projects/[projectId]',
                        params: { projectId: event.projectId },
                      })
                    }
                  >
                    <GlassCard>
                      <View style={styles.eventRow}>
                        <View
                          style={[styles.dot, { backgroundColor: event.color ?? FALLBACK_COLOR }]}
                        />
                        <Text style={styles.title} numberOfLines={2}>
                          {event.title}
                        </Text>
                      </View>
                      <Text style={styles.kind}>{KIND_LABELS[event.kind]}</Text>
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

const styles = StyleSheet.create({
  scroll: { padding: 20, gap: 12, paddingBottom: 140 },
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
  kind: { color: theme.text.dim, fontSize: 12, marginTop: 6 },
  muted: { color: theme.text.dim, fontSize: 13 },
  error: { color: '#f87171', fontSize: 13 },
});

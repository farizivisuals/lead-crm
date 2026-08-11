import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { DELIVERABLE_STATUS_LABELS, PRIORITY_LABELS } from '@shared/rbac';
import { Screen } from '../ui/Screen';
import { GlassCard } from '../ui/GlassCard';
import { Badge } from '../ui/Badge';
import { ScreenHeader } from '../ui/ScreenHeader';
import { one, shortDate } from '../../lib/data';
import { useEmployeeDashboard } from '../../lib/queries/dashboard';
import { theme } from '../../lib/theme';

export function EmployeeDashboard({ userId }: { userId: string }) {
  const router = useRouter();
  const { data, isLoading, error } = useEmployeeDashboard(userId);

  // Web parity: the query returns every assigned task; the terminal ones are
  // dropped here rather than in SQL.
  const openTasks = (data?.tasks ?? []).filter(
    (t) => !one(t.department_stages)?.is_terminal
  );

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.scroll}>
        <ScreenHeader title="Dashboard" />

        {error && <Text style={styles.error}>{error.message}</Text>}

        <View style={styles.sectionHead}>
          <Text style={styles.sectionTitle}>My Tasks</Text>
          <Badge label={String(openTasks.length)} />
        </View>

        {isLoading ? (
          <Text style={styles.muted}>Loading…</Text>
        ) : openTasks.length === 0 ? (
          <GlassCard>
            <Text style={styles.muted}>No open tasks assigned to you</Text>
          </GlassCard>
        ) : (
          openTasks.map((task) => (
            <Pressable
              key={task.id}
              onPress={() =>
                router.push({
                  pathname: '/projects/[projectId]/tasks',
                  params: { projectId: task.project_id },
                })
              }
            >
              <GlassCard>
                <View style={styles.rowTop}>
                  <Text style={styles.rowTitle} numberOfLines={2}>
                    {task.title}
                  </Text>
                  <Badge label={PRIORITY_LABELS[task.priority]} />
                </View>
                <Text style={styles.subtitle} numberOfLines={1}>
                  {[one(task.projects)?.name, one(task.department_stages)?.name]
                    .filter(Boolean)
                    .join(' · ')}
                </Text>
                <Text style={styles.meta}>{shortDate(task.due_date)}</Text>
              </GlassCard>
            </Pressable>
          ))
        )}

        <Text style={styles.sectionTitleSoon}>Approval Status · Soon</Text>
        {(data?.deliverables.length ?? 0) === 0 ? (
          <GlassCard>
            <Text style={styles.muted}>Nothing submitted yet</Text>
          </GlassCard>
        ) : (
          <GlassCard>
            {data!.deliverables.map((d) => (
              <View key={d.id} style={styles.deliverableRow}>
                <View style={styles.flex}>
                  <Text style={styles.rowTitle} numberOfLines={1}>
                    {d.title}
                  </Text>
                  <Text style={styles.subtitle} numberOfLines={1}>
                    {one(d.projects)?.name ?? '—'}
                  </Text>
                </View>
                <Badge label={DELIVERABLE_STATUS_LABELS[d.status]} />
              </View>
            ))}
          </GlassCard>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 20, gap: 12, paddingBottom: 120 },
  flex: { flex: 1 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  sectionTitle: { color: '#fff', fontSize: 15, fontWeight: '600' },
  sectionTitleSoon: {
    color: theme.colors.mutedForeground,
    fontSize: 15,
    fontWeight: '600',
    marginTop: 16,
  },
  rowTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  rowTitle: { color: '#fff', fontSize: 15, fontWeight: '600', flex: 1 },
  subtitle: { color: theme.text.dim, fontSize: 12, marginTop: 4 },
  meta: { color: theme.text.dimmer, fontSize: 12, marginTop: 6 },
  deliverableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
  },
  muted: { color: theme.text.dim, fontSize: 13 },
  error: { color: '#f87171', fontSize: 13 },
});

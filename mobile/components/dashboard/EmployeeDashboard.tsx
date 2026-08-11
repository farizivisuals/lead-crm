import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { DELIVERABLE_STATUS_LABELS, PRIORITY_LABELS } from '@shared/rbac';
import { Screen } from '../ui/Screen';
import { GlassCard } from '../ui/GlassCard';
import { Badge } from '../ui/Badge';
import { ScreenHeader } from '../ui/ScreenHeader';
import { isTaskOverdue, one, shortDate } from '../../lib/data';
import { useEmployeeDashboard } from '../../lib/queries/dashboard';
import {
  DELIVERABLE_STATUS_COLORS,
  PRIORITY_COLORS,
  theme,
  withAlpha,
} from '../../lib/theme';

export function EmployeeDashboard({ userId }: { userId: string }) {
  const router = useRouter();
  const { data, isLoading, error } = useEmployeeDashboard(userId);

  // Web parity: the query returns every assigned task; the terminal ones are
  // dropped here rather than in SQL.
  const openTasks = (data?.tasks ?? []).filter(
    (t) => !one(t.department_stages)?.is_terminal
  );
  const overdueCount = openTasks.filter((t) =>
    isTaskOverdue(t.due_date, one(t.department_stages)?.is_terminal ?? false)
  ).length;
  const inReviewCount = (data?.deliverables ?? []).filter(
    (d) => d.status === 'internal_review' || d.status === 'client_review'
  ).length;

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.scroll}>
        <ScreenHeader
          title="My Work"
          subtitle={new Date().toLocaleDateString(undefined, {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
          })}
        />

        {error && <Text style={styles.error}>{error.message}</Text>}

        <View style={styles.chips}>
          <StatChip
            icon="checklist"
            color={theme.colors.accent}
            value={isLoading ? '—' : String(openTasks.length)}
            label="Open"
          />
          <StatChip
            icon="exclamationmark.triangle"
            color={overdueCount > 0 ? theme.colors.danger : theme.colors.success}
            value={isLoading ? '—' : String(overdueCount)}
            label="Overdue"
          />
          <StatChip
            icon="paperplane"
            color={theme.colors.review}
            value={isLoading ? '—' : String(inReviewCount)}
            label="In review"
          />
        </View>

        <Text style={styles.sectionTitle}>My Tasks</Text>

        {isLoading ? (
          <Text style={styles.muted}>Loading…</Text>
        ) : openTasks.length === 0 ? (
          <GlassCard>
            <View style={styles.empty}>
              <View style={[styles.emptyIcon, { backgroundColor: withAlpha(theme.colors.success, 0.15) }]}>
                <SymbolView name="checkmark.circle" tintColor={theme.colors.success} size={20} />
              </View>
              <Text style={styles.emptyTitle}>All clear</Text>
              <Text style={styles.muted}>No open tasks assigned to you.</Text>
            </View>
          </GlassCard>
        ) : (
          openTasks.map((task) => {
            const overdue = isTaskOverdue(
              task.due_date,
              one(task.department_stages)?.is_terminal ?? false
            );
            return (
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
                    <Badge
                      label={PRIORITY_LABELS[task.priority]}
                      color={PRIORITY_COLORS[task.priority]}
                    />
                  </View>
                  <Text style={styles.subtitle} numberOfLines={1}>
                    {[one(task.projects)?.name, one(task.department_stages)?.name]
                      .filter(Boolean)
                      .join(' · ')}
                  </Text>
                  {task.due_date ? (
                    <Text style={[styles.meta, overdue && styles.overdueMeta]}>
                      {overdue ? 'Overdue · ' : 'Due '}
                      {shortDate(task.due_date)}
                    </Text>
                  ) : null}
                </GlassCard>
              </Pressable>
            );
          })
        )}

        <Text style={styles.sectionTitle}>Approval status</Text>
        {isLoading ? (
          <Text style={styles.muted}>Loading…</Text>
        ) : error ? null : (data?.deliverables.length ?? 0) === 0 ? (
          <GlassCard>
            <Text style={styles.muted}>Nothing submitted yet</Text>
          </GlassCard>
        ) : (
          <GlassCard>
            {data!.deliverables.map((d, i) => (
              <View
                key={d.id}
                style={[
                  styles.deliverableRow,
                  i === data!.deliverables.length - 1 && styles.rowLast,
                ]}
              >
                <View style={styles.flex}>
                  <Text style={styles.rowTitle} numberOfLines={1}>
                    {d.title}
                  </Text>
                  <Text style={styles.subtitle} numberOfLines={1}>
                    {one(d.projects)?.name ?? '—'}
                  </Text>
                </View>
                <Badge
                  label={DELIVERABLE_STATUS_LABELS[d.status]}
                  color={DELIVERABLE_STATUS_COLORS[d.status]}
                />
              </View>
            ))}
          </GlassCard>
        )}
      </ScrollView>
    </Screen>
  );
}

function StatChip({
  icon,
  color,
  value,
  label,
}: {
  icon: string;
  color: string;
  value: string;
  label: string;
}) {
  return (
    <GlassCard style={styles.chip}>
      <View style={styles.chipInner}>
        <View style={[styles.chipIcon, { backgroundColor: withAlpha(color, 0.15) }]}>
          <SymbolView name={icon as any} tintColor={color} size={13} />
        </View>
        <View>
          <Text style={styles.chipValue}>{value}</Text>
          <Text style={styles.chipLabel}>{label}</Text>
        </View>
      </View>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 20, gap: 12, paddingBottom: 120 },
  flex: { flex: 1 },
  chips: { flexDirection: 'row', gap: 10 },
  chip: { flex: 1 },
  chipInner: { flexDirection: 'row', alignItems: 'center', gap: 8, margin: -6 },
  chipIcon: {
    width: 26,
    height: 26,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipValue: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.5,
    fontVariant: ['tabular-nums'],
  },
  chipLabel: { color: theme.text.label, fontSize: 11 },
  sectionTitle: { color: '#fff', fontSize: 15, fontWeight: '600', marginTop: 12 },
  rowTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  rowTitle: { color: '#fff', fontSize: 15, fontWeight: '600', flex: 1 },
  subtitle: { color: theme.text.label, fontSize: 12, marginTop: 4 },
  meta: { color: theme.text.dim, fontSize: 12, marginTop: 6 },
  overdueMeta: { color: theme.colors.danger, fontWeight: '600' },
  deliverableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
  },
  rowLast: { borderBottomWidth: 0 },
  empty: { alignItems: 'center', gap: 4, paddingVertical: 8 },
  emptyIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptyTitle: { color: '#fff', fontSize: 15, fontWeight: '600' },
  muted: { color: theme.text.label, fontSize: 13 },
  error: { color: theme.colors.danger, fontSize: 13 },
});

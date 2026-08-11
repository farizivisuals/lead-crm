import { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { isExecutive, PRIORITY_LABELS } from '@shared/rbac';
import { Screen } from '../../components/ui/Screen';
import { GlassCard } from '../../components/ui/GlassCard';
import { Badge } from '../../components/ui/Badge';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { PickerSheet } from '../../components/ui/PickerSheet';
import { useAuth } from '../../lib/auth';
import { one, shortDate, firstName, distinctAssignees } from '../../lib/data';
import { useAllTasks, type AllTasksRow } from '../../lib/queries/all-tasks';
import { theme } from '../../lib/theme';

export default function TasksScreen() {
  const router = useRouter();
  const { employee } = useAuth();
  const canFilter = isExecutive(employee?.role ?? 'employee');
  const { data, isLoading, error } = useAllTasks();
  const rows = useMemo(() => data ?? [], [data]);

  const [assignee, setAssignee] = useState<string>('all');
  const [pickerOpen, setPickerOpen] = useState(false);

  const assignees = useMemo(() => distinctAssignees(rows), [rows]);
  const visible = useMemo(() => {
    if (assignee === 'all') return rows;
    if (assignee === 'unassigned') return rows.filter((r) => r.assigned_to === null);
    return rows.filter((r) => r.assigned_to === assignee);
  }, [rows, assignee]);

  const showFilter = canFilter && assignees.length > 1;
  const filterLabel =
    assignee === 'all'
      ? 'All Tasks'
      : assignee === 'unassigned'
        ? 'Unassigned'
        : (assignees.find((a) => a.id === assignee)?.name ?? 'All Tasks');

  return (
    <Screen>
      <FlatList
        contentContainerStyle={styles.list}
        data={visible}
        keyExtractor={(t) => t.id}
        ListHeaderComponent={
          <ScreenHeader
            title={canFilter ? 'All Tasks' : 'My Tasks'}
            right={
              showFilter ? (
                <Pressable onPress={() => setPickerOpen(true)} hitSlop={10}>
                  <Text style={styles.filterButton}>{filterLabel}</Text>
                </Pressable>
              ) : undefined
            }
          />
        }
        ListEmptyComponent={
          isLoading ? (
            <Text style={styles.muted}>Loading…</Text>
          ) : error ? (
            <Text style={styles.error}>{error.message}</Text>
          ) : rows.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>No tasks</Text>
            </View>
          ) : (
            <Text style={styles.muted}>No tasks match this filter</Text>
          )
        }
        renderItem={({ item }) => (
          <TaskRow
            task={item}
            onPress={() =>
              router.push({
                pathname: '/projects/[projectId]/tasks',
                params: { projectId: item.project_id },
              })
            }
          />
        )}
      />

      <PickerSheet
        visible={pickerOpen}
        title="Filter by assignee"
        selected={assignee}
        options={[
          { value: 'all', label: 'All Tasks' },
          { value: 'unassigned', label: 'Unassigned' },
          ...assignees.map((a) => ({ value: a.id, label: a.name })),
        ]}
        onSelect={(v) => {
          setAssignee(v);
          setPickerOpen(false);
        }}
        onClose={() => setPickerOpen(false)}
      />
    </Screen>
  );
}

function TaskRow({ task, onPress }: { task: AllTasksRow; onPress: () => void }) {
  const stage = one(task.department_stages);
  const done = !!stage?.is_terminal;
  const subtitle = [
    one(task.projects)?.name,
    one(task.departments)?.name,
    stage?.name,
  ]
    .filter(Boolean)
    .join(' · ');
  const assignee = one(task.employees)?.profiles?.full_name;

  return (
    <Pressable onPress={onPress}>
      <GlassCard>
        <View style={styles.rowTop}>
          <Text style={[styles.title, done && styles.titleDone]} numberOfLines={2}>
            {task.title}
          </Text>
          <Badge label={PRIORITY_LABELS[task.priority]} />
        </View>
        <Text style={styles.subtitle} numberOfLines={1}>
          {subtitle}
        </Text>
        <View style={styles.rowMeta}>
          <Text style={styles.meta}>{shortDate(task.due_date)}</Text>
          <Text style={styles.meta}>{assignee ? firstName(assignee) : 'Unassigned'}</Text>
        </View>
      </GlassCard>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  list: { padding: 20, gap: 12, paddingBottom: 120 },
  filterButton: { color: '#fff', fontSize: 14, fontWeight: '600' },
  rowTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  title: { color: '#fff', fontSize: 15, fontWeight: '600', flex: 1 },
  titleDone: { color: theme.colors.mutedForeground, textDecorationLine: 'line-through' },
  subtitle: { color: theme.text.dim, fontSize: 12, marginTop: 6 },
  rowMeta: { flexDirection: 'row', gap: 16, marginTop: 8 },
  meta: { color: theme.text.dimmer, fontSize: 12 },
  empty: { alignItems: 'center', paddingVertical: 60 },
  emptyTitle: { color: '#fff', fontSize: 16, fontWeight: '600' },
  muted: { color: theme.text.dim, fontSize: 13, textAlign: 'center', paddingVertical: 24 },
  error: { color: '#f87171', fontSize: 13, textAlign: 'center', paddingVertical: 40 },
});

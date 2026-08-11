import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { isExecutive, PRIORITY_LABELS } from '@shared/rbac';
import { Screen } from '../../../../../components/ui/Screen';
import { GlassCard } from '../../../../../components/ui/GlassCard';
import { Badge } from '../../../../../components/ui/Badge';
import { ScreenHeader } from '../../../../../components/ui/ScreenHeader';
import { useAuth } from '../../../../../lib/auth';
import { one, countByStage, isTaskOverdue, shortDate, firstName } from '../../../../../lib/data';
import {
  useBoard,
  useBoardMeta,
  type BoardTask,
  type BoardStage,
} from '../../../../../lib/queries/board';
import { theme } from '../../../../../lib/theme';

const STAGE_FALLBACK_COLOR = '#71717a';

export default function BoardScreen() {
  const { projectId } = useLocalSearchParams<{ projectId: string }>();
  const router = useRouter();
  const { employee } = useAuth();
  const canManage = isExecutive(employee?.role ?? 'employee');

  const board = useBoard(projectId);
  const deptIds = useMemo(
    () => (board.data?.departments ?? []).map((d) => d.id),
    [board.data]
  );
  const meta = useBoardMeta(deptIds);

  // One selected stage per department section, keyed by department id.
  // null / absent = "All".
  const [selected, setSelected] = useState<Record<string, string | null>>({});

  function openTask(taskId: string) {
    router.push({ pathname: '/projects/[projectId]/tasks/[taskId]', params: { projectId, taskId } });
  }

  function newTask() {
    // @ts-expect-error — the /projects/[projectId]/tasks/new route does not
    // exist until Task 6 creates it. Delete this directive (not the call) in Task 6.
    router.push({ pathname: '/projects/[projectId]/tasks/new', params: { projectId } });
  }

  if (board.isLoading) {
    return (
      <Screen>
        <View style={styles.centered}>
          <Text style={styles.muted}>Loading…</Text>
        </View>
      </Screen>
    );
  }
  if (board.error || !board.data) {
    return (
      <Screen>
        <View style={styles.centered}>
          <Text style={styles.error}>{board.error?.message ?? 'Project not found'}</Text>
        </View>
      </Screen>
    );
  }

  const { projectName, departments, tasks } = board.data;
  const stages = meta.data?.stages ?? [];

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.scroll}>
        <ScreenHeader
          title="Tasks"
          subtitle={projectName}
          onBack={() => router.back()}
          right={
            canManage ? (
              <Pressable onPress={newTask} hitSlop={10}>
                <Text style={styles.newButton}>New</Text>
              </Pressable>
            ) : undefined
          }
        />

        {departments.length === 0 && (
          <Text style={styles.muted}>This project has no departments.</Text>
        )}

        {departments.map((dept) => {
          const deptTasks = tasks.filter((t) => t.department_id === dept.id);
          const deptStages = stages.filter((s) => s.department_id === dept.id);
          const counts = countByStage(deptStages as BoardStage[], deptTasks);
          const activeStage = selected[dept.id] ?? null;
          const visible = activeStage
            ? deptTasks.filter((t) => t.current_stage_id === activeStage)
            : deptTasks;

          return (
            <View key={dept.id} style={styles.section}>
              <Text style={styles.deptName}>
                {dept.name}
                {dept.is_primary ? ' · primary' : ''}
              </Text>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.chipRow}
              >
                <Chip
                  label="All"
                  count={deptTasks.length}
                  color="#fafafa"
                  active={activeStage === null}
                  onPress={() => setSelected((s) => ({ ...s, [dept.id]: null }))}
                />
                {counts.map(({ stage, count }) => (
                  <Chip
                    key={stage.id}
                    label={stage.is_terminal ? `${stage.name} ✓` : stage.name}
                    count={count}
                    color={stage.color ?? STAGE_FALLBACK_COLOR}
                    active={activeStage === stage.id}
                    onPress={() =>
                      setSelected((s) => ({
                        ...s,
                        [dept.id]: s[dept.id] === stage.id ? null : stage.id,
                      }))
                    }
                  />
                ))}
              </ScrollView>

              {meta.isLoading && deptStages.length === 0 && (
                <Text style={styles.muted}>Loading stages…</Text>
              )}
              {meta.error && <Text style={styles.error}>{meta.error.message}</Text>}

              {visible.length === 0 ? (
                <Text style={styles.muted}>
                  {deptTasks.length === 0 ? 'No tasks yet' : 'No tasks in this stage'}
                </Text>
              ) : (
                visible.map((task) => (
                  <TaskCard key={task.id} task={task} onPress={() => openTask(task.id)} />
                ))
              )}
            </View>
          );
        })}
      </ScrollView>
    </Screen>
  );
}

function Chip({
  label,
  count,
  color,
  active,
  onPress,
}: {
  label: string;
  count: number;
  color: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.chip,
        { borderColor: color },
        active && { backgroundColor: 'rgba(255,255,255,0.12)' },
      ]}
    >
      <Text style={[styles.chipText, active && styles.chipTextActive]}>
        {label} · {count}
      </Text>
    </Pressable>
  );
}

function TaskCard({ task, onPress }: { task: BoardTask; onPress: () => void }) {
  const stage = one(task.department_stages);
  const overdue = isTaskOverdue(task.due_date, !!stage?.is_terminal);
  const assignee = one(task.employees)?.profiles?.full_name;
  const creativeNames = (task.task_creatives ?? [])
    .map((tc) => firstName(one(tc.employees)?.profiles?.full_name))
    .filter((n) => n !== '—');

  return (
    <Pressable onPress={onPress}>
      <GlassCard style={styles.card}>
        <View style={styles.cardTop}>
          <Text style={styles.cardTitle} numberOfLines={2}>
            {overdue ? '⚠ ' : ''}
            {task.title}
          </Text>
          <Badge label={PRIORITY_LABELS[task.priority]} />
        </View>
        <View style={styles.cardMeta}>
          <Text style={overdue ? styles.overdue : styles.meta}>
            {shortDate(task.due_date)}
            {overdue ? ' · Overdue' : ''}
          </Text>
          {assignee ? <Text style={styles.meta}>{firstName(assignee)}</Text> : null}
          {creativeNames.length > 0 ? (
            <Text style={styles.meta}>{creativeNames.join(', ')}</Text>
          ) : null}
        </View>
      </GlassCard>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 20, gap: 20, paddingBottom: 140 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  newButton: { color: '#fff', fontSize: 15, fontWeight: '600' },
  section: { gap: 10 },
  deptName: { color: '#fff', fontSize: 15, fontWeight: '600' },
  chipRow: { gap: 8, paddingRight: 20 },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  chipText: { color: theme.text.dim, fontSize: 13 },
  chipTextActive: { color: '#fff', fontWeight: '600' },
  card: { marginTop: 2 },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  cardTitle: { color: '#fff', fontSize: 15, fontWeight: '600', flex: 1 },
  cardMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 8 },
  meta: { color: theme.text.dim, fontSize: 12 },
  overdue: { color: '#f87171', fontSize: 12 },
  muted: { color: theme.text.dim, fontSize: 13 },
  error: { color: '#f87171', fontSize: 13, textAlign: 'center' },
});

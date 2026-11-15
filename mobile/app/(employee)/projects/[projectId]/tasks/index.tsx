import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { isExecutive, PRIORITY_LABELS } from '@shared/rbac';
import { Screen } from '../../../../../components/ui/Screen';
import { GlassCard } from '../../../../../components/ui/GlassCard';
import { Badge } from '../../../../../components/ui/Badge';
import { ScreenHeader } from '../../../../../components/ui/ScreenHeader';
import { useAuth } from '../../../../../lib/auth';
import { one, isTaskOverdue, shortDate, firstName } from '../../../../../lib/data';
import { useBoard, useBoardMeta, type BoardTask, type BoardStage } from '../../../../../lib/queries/board';
import {
  sortDeliverables,
  deliverableStageId,
  stageRow,
  assigneeName,
} from '../../../../../lib/queries/task-deliverables';
import { PRIORITY_COLORS, theme, withAlpha } from '../../../../../lib/theme';


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

  function openTask(taskId: string) {
    router.push({ pathname: '/projects/[projectId]/tasks/[taskId]', params: { projectId, taskId } });
  }

  function newTask() {
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

          return (
            <View key={dept.id} style={styles.section}>
              <View style={styles.deptRow}>
                <Text style={styles.deptName}>
                  {dept.name}
                  {dept.is_primary ? ' · primary' : ''}
                </Text>
                <Text style={styles.deptCount}>{deptTasks.length}</Text>
              </View>

              {meta.isLoading && deptStages.length === 0 && (
                <Text style={styles.muted}>Loading stages…</Text>
              )}
              {meta.error && <Text style={styles.error}>{meta.error.message}</Text>}

              {deptTasks.length === 0 ? (
                <Text style={styles.muted}>No tasks yet</Text>
              ) : (
                deptTasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    stages={deptStages}
                    onPress={() => openTask(task.id)}
                  />
                ))
              )}
            </View>
          );
        })}
      </ScrollView>
    </Screen>
  );
}

function TaskCard({
  task,
  stages,
  onPress,
}: {
  task: BoardTask;
  stages: BoardStage[];
  onPress: () => void;
}) {
  const taskStage = one(task.department_stages);
  const overdue = isTaskOverdue(task.due_date, !!taskStage?.is_terminal);
  const assignee = one(task.employees)?.profiles?.full_name;
  const creativeNames = (task.task_creatives ?? [])
    .map((tc) => firstName(one(tc.employees)?.profiles?.full_name))
    .filter((n) => n !== '—');
  const deliverables = sortDeliverables(task.task_deliverables);
  // Every deliverable in a terminal stage = the whole task is done.
  const allDone =
    deliverables.length > 0 &&
    deliverables.every(
      (d) =>
        stages.find((s) => s.id === deliverableStageId(d, task.current_stage_id))?.is_terminal
    );

  return (
    <Pressable onPress={onPress}>
      <GlassCard style={styles.card}>
        <View style={styles.cardTop}>
          <Text style={styles.cardTitle} numberOfLines={2}>
            {overdue ? '⚠ ' : ''}
            {allDone ? '✓ ' : ''}
            {task.title}
          </Text>
          <Badge label={PRIORITY_LABELS[task.priority]} color={PRIORITY_COLORS[task.priority]} />
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

        {deliverables.length > 0 ? (
          <View style={styles.deliverables}>
            {deliverables.map((d) => {
              const stageId = deliverableStageId(d, task.current_stage_id);
              const stage = stages.find((s) => s.id === stageId);
              const row = stageRow(d, stageId);
              const who = firstName(assigneeName(row));
              const color = stage?.color ?? theme.colors.mutedForeground;
              return (
                <View key={d.id} style={styles.deliverableRow}>
                  <Text style={styles.deliverableTitle} numberOfLines={1}>
                    {d.title}
                  </Text>
                  <View style={[styles.stagePill, { backgroundColor: withAlpha(color, 0.16) }]}>
                    <Text style={[styles.stagePillText, { color }]} numberOfLines={1}>
                      {stage?.is_terminal ? `${stage.name} ✓` : stage?.name ?? '—'}
                    </Text>
                  </View>
                  <Text style={styles.deliverableMeta} numberOfLines={1}>
                    {who}
                    {row?.scheduled_date ? ` · ${shortDate(row.scheduled_date)}` : ''}
                  </Text>
                </View>
              );
            })}
          </View>
        ) : (
          taskStage && (
            <View style={styles.deliverables}>
              <View
                style={[
                  styles.stagePill,
                  styles.stagePillAlone,
                  { backgroundColor: withAlpha(taskStage.color ?? theme.colors.mutedForeground, 0.16) },
                ]}
              >
                <Text
                  style={[
                    styles.stagePillText,
                    { color: taskStage.color ?? theme.colors.mutedForeground },
                  ]}
                >
                  {taskStage.is_terminal ? `${taskStage.name} ✓` : taskStage.name}
                </Text>
              </View>
            </View>
          )
        )}
      </GlassCard>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 20, gap: 20, paddingBottom: 140 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  newButton: { color: theme.colors.accent, fontSize: 15, fontWeight: '600' },
  section: { gap: 10 },
  deptRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  deptName: { color: '#fff', fontSize: 15, fontWeight: '600' },
  deptCount: { color: theme.text.dim, fontSize: 12 },
  card: { marginTop: 2 },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  cardTitle: { color: '#fff', fontSize: 15, fontWeight: '600', flex: 1 },
  cardMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 8 },
  meta: { color: theme.text.dim, fontSize: 12 },
  overdue: { color: theme.colors.danger, fontSize: 12, fontWeight: '600' },
  deliverables: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.border,
    gap: 6,
  },
  deliverableRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  deliverableTitle: { color: theme.colors.foreground, fontSize: 13, flex: 1 },
  stagePill: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  stagePillAlone: { alignSelf: 'flex-start' },
  stagePillText: { fontSize: 11, fontWeight: '600' },
  deliverableMeta: { color: theme.text.dim, fontSize: 11, minWidth: 76, textAlign: 'right' },
  muted: { color: theme.text.dim, fontSize: 13 },
  error: { color: theme.colors.danger, fontSize: 13, textAlign: 'center' },
});

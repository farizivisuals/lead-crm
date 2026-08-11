import { useEffect, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { TaskPriority } from '@shared/types';
import { PRIORITY_LABELS } from '@shared/rbac';
import { Screen } from '../../../../../components/ui/Screen';
import { GlassCard } from '../../../../../components/ui/GlassCard';
import { Button } from '../../../../../components/ui/Button';
import { Input } from '../../../../../components/ui/Input';
import { ScreenHeader } from '../../../../../components/ui/ScreenHeader';
import { PickerSheet } from '../../../../../components/ui/PickerSheet';
import { one } from '../../../../../lib/data';
import { qk } from '../../../../../lib/queries/keys';
import {
  useTask,
  useTaskPickers,
  useAvailabilityConflicts,
  moveTaskStage,
  saveTask,
  deleteTask,
  isShootStage,
} from '../../../../../lib/queries/task';
import { theme } from '../../../../../lib/theme';

const PRIORITIES: TaskPriority[] = ['low', 'medium', 'high', 'urgent'];
const STAGE_FALLBACK_COLOR = '#71717a';

export default function TaskDetailScreen() {
  const { projectId, taskId } = useLocalSearchParams<{ projectId: string; taskId: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();

  const task = useTask(taskId);
  const pickers = useTaskPickers(projectId, task.data?.department_id);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [assignedTo, setAssignedTo] = useState<string | null>(null);
  const [startDate, setStartDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [creativeIds, setCreativeIds] = useState<string[]>([]);
  const [originalCreativeIds, setOriginalCreativeIds] = useState<string[]>([]);
  // Optimistic stage while a move is in flight; null = show the persisted one.
  const [pendingStageId, setPendingStageId] = useState<string | null>(null);
  const [picker, setPicker] = useState<'stage' | 'priority' | 'assignee' | null>(null);

  useEffect(() => {
    // Keyed on the task ROW IDENTITY, not on `task.data` — that object is a new
    // reference after every background refetch and every invalidation, and
    // re-running this would overwrite whatever the user has typed since the
    // screen loaded. Seeding the form once per task id is the whole intent.
    const row = task.data;
    if (!row) return;
    setTitle(row.title);
    setDescription(row.description ?? '');
    setPriority(row.priority);
    setAssignedTo(row.assigned_to);
    setStartDate(row.start_date ?? '');
    setDueDate(row.due_date ?? '');
    const ids = (row.task_creatives ?? []).map((tc) => tc.profile_id);
    setCreativeIds(ids);
    setOriginalCreativeIds(ids);
  }, [task.data?.id]);

  const stages = pickers.data?.stages ?? [];
  const persistedStageId = task.data?.current_stage_id ?? '';
  const stageId = pendingStageId ?? persistedStageId;
  const stage = stages.find((s) => s.id === stageId) ?? one(task.data?.department_stages ?? null);
  const shoot = isShootStage(stage?.name);

  const conflicts = useAvailabilityConflicts({
    assignedTo,
    startDate,
    dueDate: shoot ? startDate : dueDate,
    excludeTaskId: taskId,
  });
  const conflicting = conflicts.data ?? [];

  const moveMutation = useMutation({
    mutationFn: (nextStageId: string) => moveTaskStage(taskId, nextStageId),
    onSuccess: () => {
      setPendingStageId(null);
      queryClient.invalidateQueries({ queryKey: qk.task(taskId) });
      queryClient.invalidateQueries({ queryKey: qk.projectTasks(projectId) });
      queryClient.invalidateQueries({ queryKey: qk.project(projectId) });
      // All Tasks selects department_stages(name, is_terminal) and strikes
      // through terminal tasks — a stage move changes exactly that.
      queryClient.invalidateQueries({ queryKey: qk.allTasks() });
    },
    onError: (e: Error) => {
      // Targeted rollback of just this field — the row snaps back to the
      // persisted stage without a refetch, matching the web board.
      setPendingStageId(null);
      Alert.alert('Could not move task', e.message);
    },
  });

  const saveMutation = useMutation({
    mutationFn: saveTask,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.task(taskId) });
      queryClient.invalidateQueries({ queryKey: qk.projectTasks(projectId) });
      queryClient.invalidateQueries({ queryKey: qk.project(projectId) });
      queryClient.invalidateQueries({ queryKey: qk.allTasks() });
      router.back();
    },
    onError: (e: Error) => Alert.alert('Could not save task', e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteTask(taskId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.projectTasks(projectId) });
      queryClient.invalidateQueries({ queryKey: qk.project(projectId) });
      queryClient.invalidateQueries({ queryKey: qk.allTasks() });
      router.back();
    },
    onError: (e: Error) => Alert.alert('Could not delete task', e.message),
  });

  if (task.isLoading) {
    return (
      <Screen>
        <View style={styles.centered}>
          <Text style={styles.muted}>Loading…</Text>
        </View>
      </Screen>
    );
  }
  if (task.error || !task.data) {
    return (
      <Screen>
        <View style={styles.centered}>
          <Text style={styles.error}>{task.error?.message ?? 'Task not found'}</Text>
        </View>
      </Screen>
    );
  }

  function chooseStage(nextStageId: string) {
    // The row's `disabled={moveMutation.isPending}` stops the sheet from being
    // reopened, but the Modal's slide-out dismiss animation keeps its rows
    // mounted and tappable for a moment after `visible` flips to false — a tap
    // during that window would still reach this closure. Bail before doing
    // anything else so it can't dispatch a second write.
    if (moveMutation.isPending) return;
    setPicker(null);
    // Compare against the EFFECTIVE stage (pendingStageId ?? persisted), the
    // same value the row renders as `stageId` — while a move is in flight the
    // row already shows the optimistic stage, so comparing against the stale
    // persisted id would let a second tap on the same stage fire a duplicate
    // write. See Task 3's project status picker for the same fix.
    if (nextStageId === stageId) return;
    setPendingStageId(nextStageId); // optimistic
    moveMutation.mutate(nextStageId);
  }

  function confirmDelete() {
    Alert.alert('Delete task', `Delete "${task.data!.title}"? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteMutation.mutate() },
    ]);
  }

  const canSave =
    title.trim().length > 0 &&
    startDate.length > 0 &&
    (shoot || dueDate.length > 0) &&
    conflicting.length === 0 &&
    // `conflicting` is `[]` while the query is still fetching (every
    // assignee/date edit changes its key) and on error — neither means "no
    // conflicts". The brief calls this a hard block; failing open on a
    // pending or errored check would silently bypass it.
    !conflicts.isFetching &&
    !conflicts.error;

  function submit() {
    saveMutation.mutate({
      taskId,
      title: title.trim(),
      description,
      priority,
      assigned_to: assignedTo,
      current_stage_id: stageId,
      start_date: startDate,
      due_date: dueDate,
      isShoot: shoot,
      creativesToAdd: creativeIds.filter((id) => !originalCreativeIds.includes(id)),
      creativesToRemove: originalCreativeIds.filter((id) => !creativeIds.includes(id)),
    });
  }

  const assigneeName =
    pickers.data?.employees.find((e) => e.profile_id === assignedTo)?.full_name ?? 'Unassigned';

  return (
    <Screen>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <ScreenHeader
            title="Task"
            subtitle={one(task.data.departments)?.name ?? undefined}
            onBack={() => router.back()}
          />

          <GlassCard>
            {/* Disabled while a move is in flight so a second tap can't open the
                sheet and dispatch another write before the first one lands. */}
            <Pressable onPress={() => setPicker('stage')} disabled={moveMutation.isPending}>
              <Text style={styles.label}>STAGE</Text>
              <View style={styles.stageRow}>
                <View
                  style={[
                    styles.dot,
                    { backgroundColor: stage?.color ?? STAGE_FALLBACK_COLOR },
                  ]}
                />
                <Text style={styles.value}>
                  {stage?.name ?? '—'}
                  {stage?.is_terminal ? ' ✓' : ''}
                </Text>
                {moveMutation.isPending && <Text style={styles.muted}>Moving…</Text>}
              </View>
            </Pressable>
          </GlassCard>

          <GlassCard>
            <View style={styles.form}>
              <Input label="Title" value={title} onChangeText={setTitle} placeholder="Task title" />
              <Input
                label="Description"
                value={description}
                onChangeText={setDescription}
                placeholder="Optional"
              />

              <Pressable onPress={() => setPicker('priority')}>
                <Text style={styles.label}>PRIORITY</Text>
                <Text style={styles.value}>{PRIORITY_LABELS[priority]}</Text>
              </Pressable>

              <Pressable onPress={() => setPicker('assignee')}>
                <Text style={styles.label}>ASSIGNEE</Text>
                <Text style={styles.value}>{assigneeName}</Text>
              </Pressable>

              {shoot ? (
                <Input
                  label="Shoot date"
                  value={startDate}
                  onChangeText={setStartDate}
                  placeholder="YYYY-MM-DD"
                />
              ) : (
                <>
                  <Input
                    label="Start date"
                    value={startDate}
                    onChangeText={setStartDate}
                    placeholder="YYYY-MM-DD"
                  />
                  <Input
                    label="Due date"
                    value={dueDate}
                    onChangeText={setDueDate}
                    placeholder="YYYY-MM-DD"
                  />
                </>
              )}
            </View>
          </GlassCard>

          <GlassCard>
            <Text style={styles.label}>CREATIVES</Text>
            <View style={styles.chipRow}>
              {(pickers.data?.projectCreatives ?? []).map((c) => {
                const on = creativeIds.includes(c.profile_id);
                return (
                  <Pressable
                    key={c.profile_id}
                    onPress={() =>
                      setCreativeIds((ids) =>
                        ids.includes(c.profile_id)
                          ? ids.filter((x) => x !== c.profile_id)
                          : [...ids, c.profile_id]
                      )
                    }
                    style={[styles.chip, on && styles.chipOn]}
                  >
                    <Text style={[styles.chipText, on && styles.chipTextOn]}>{c.full_name}</Text>
                  </Pressable>
                );
              })}
              {(pickers.data?.projectCreatives.length ?? 0) === 0 && (
                <Text style={styles.muted}>No creatives on this project.</Text>
              )}
            </View>
          </GlassCard>

          {conflicting.length > 0 && (
            <GlassCard>
              <Text style={styles.conflictTitle}>Assignee is booked</Text>
              {conflicting.map((c) => (
                <Text key={c.id} style={styles.conflictRow}>
                  · {c.title}
                </Text>
              ))}
              <Text style={styles.muted}>
                Change the assignee or the dates before saving.
              </Text>
            </GlassCard>
          )}

          <Button
            title="Save changes"
            onPress={submit}
            disabled={!canSave}
            loading={saveMutation.isPending}
          />
          <Button
            title="Delete task"
            variant="ghost"
            onPress={confirmDelete}
            loading={deleteMutation.isPending}
          />
        </ScrollView>
      </KeyboardAvoidingView>

      <PickerSheet
        visible={picker === 'stage'}
        title="Move to stage"
        selected={stageId}
        options={stages.map((s) => ({
          value: s.id,
          label: s.is_terminal ? `${s.name} ✓` : s.name,
          color: s.color ?? STAGE_FALLBACK_COLOR,
        }))}
        onSelect={chooseStage}
        onClose={() => setPicker(null)}
      />
      <PickerSheet
        visible={picker === 'priority'}
        title="Priority"
        selected={priority}
        options={PRIORITIES.map((p) => ({ value: p, label: PRIORITY_LABELS[p] }))}
        onSelect={(v) => {
          setPriority(v as TaskPriority);
          setPicker(null);
        }}
        onClose={() => setPicker(null)}
      />
      <PickerSheet
        visible={picker === 'assignee'}
        title="Assignee"
        selected={assignedTo ?? 'unassigned'}
        options={[
          { value: 'unassigned', label: 'Unassigned' },
          ...(pickers.data?.employees ?? []).map((e) => ({
            value: e.profile_id,
            label: e.full_name,
          })),
        ]}
        onSelect={(v) => {
          setAssignedTo(v === 'unassigned' ? null : v);
          setPicker(null);
        }}
        onClose={() => setPicker(null)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { padding: 20, gap: 16, paddingBottom: 160 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  form: { gap: 16 },
  label: {
    fontSize: 11,
    fontWeight: '500',
    color: theme.text.label,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  value: { color: '#fff', fontSize: 15, marginTop: 6 },
  stageRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  chip: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  chipOn: { borderColor: '#fafafa', backgroundColor: 'rgba(255,255,255,0.10)' },
  chipText: { color: theme.text.dim, fontSize: 13 },
  chipTextOn: { color: '#fff', fontWeight: '600' },
  conflictTitle: { color: '#fbbf24', fontSize: 14, fontWeight: '600', marginBottom: 6 },
  conflictRow: { color: theme.colors.foreground, fontSize: 13 },
  muted: { color: theme.text.dim, fontSize: 12, marginTop: 6 },
  error: { color: '#f87171', fontSize: 13, textAlign: 'center' },
});

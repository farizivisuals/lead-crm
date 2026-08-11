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
import { useAuth } from '../../../../../lib/auth';
import { qk } from '../../../../../lib/queries/keys';
import { useBoard } from '../../../../../lib/queries/board';
import {
  createTask,
  useTaskPickers,
  useAvailabilityConflicts,
  isShootStage,
} from '../../../../../lib/queries/task';
import { theme } from '../../../../../lib/theme';

const PRIORITIES: TaskPriority[] = ['low', 'medium', 'high', 'urgent'];

export default function NewTaskScreen() {
  const { projectId } = useLocalSearchParams<{ projectId: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { session } = useAuth();

  const board = useBoard(projectId);
  const departments = board.data?.departments ?? [];

  const [deptId, setDeptId] = useState<string | null>(null);

  useEffect(() => {
    // Default to the project's first department once they load. Keyed on the
    // joined id list rather than the array reference, which is new on every
    // refetch; and it only ever sets state while `deptId` is still null, so a
    // user's explicit choice is never overwritten.
    if (!deptId && departments.length > 0) setDeptId(departments[0].id);
  }, [departments.map((d) => d.id).join(','), deptId]);

  const pickers = useTaskPickers(projectId, deptId ?? undefined);
  const firstStage = pickers.data?.stages[0] ?? null;
  const shoot = isShootStage(firstStage?.name);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [assignedTo, setAssignedTo] = useState<string | null>(null);
  const [startDate, setStartDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [creativeIds, setCreativeIds] = useState<string[]>([]);
  const [picker, setPicker] = useState<'dept' | 'priority' | 'assignee' | null>(null);

  const conflicts = useAvailabilityConflicts({
    assignedTo,
    startDate,
    dueDate: shoot ? startDate : dueDate,
    excludeTaskId: null,
  });
  const conflicting = conflicts.data ?? [];

  const mutation = useMutation({
    mutationFn: createTask,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.projectTasks(projectId) });
      queryClient.invalidateQueries({ queryKey: qk.project(projectId) });
      queryClient.invalidateQueries({ queryKey: qk.projects() });
      queryClient.invalidateQueries({ queryKey: qk.allTasks() });
      router.back();
    },
    onError: (e: Error) => Alert.alert('Could not create task', e.message),
  });

  const canSubmit =
    !mutation.isPending &&
    !!deptId &&
    !!firstStage &&
    !!session?.user.id &&
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
    if (!canSubmit) return;
    mutation.mutate({
      project_id: projectId,
      department_id: deptId!,
      current_stage_id: firstStage!.id,
      title: title.trim(),
      description,
      priority,
      start_date: startDate,
      due_date: dueDate,
      isShoot: shoot,
      assigned_to: assignedTo,
      creativeProfileIds: creativeIds,
      userId: session!.user.id,
    });
  }

  const deptName = departments.find((d) => d.id === deptId)?.name ?? 'Select a department';
  const assigneeName =
    pickers.data?.employees.find((e) => e.profile_id === assignedTo)?.full_name ?? 'Unassigned';

  return (
    <Screen>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <ScreenHeader title="New task" onBack={() => router.back()} />

          {board.error && (
            <GlassCard>
              <Text style={styles.error}>{board.error.message}</Text>
            </GlassCard>
          )}
          {pickers.error && (
            <GlassCard>
              <Text style={styles.error}>{pickers.error.message}</Text>
            </GlassCard>
          )}

          <GlassCard>
            <View style={styles.form}>
              <Pressable onPress={() => setPicker('dept')}>
                <Text style={styles.label}>DEPARTMENT</Text>
                <Text style={styles.value}>{deptName}</Text>
              </Pressable>

              <View>
                <Text style={styles.label}>STARTING STAGE</Text>
                <Text style={styles.value}>{firstStage?.name ?? '—'}</Text>
                <Text style={styles.muted}>
                  New tasks always start in the department's first stage.
                </Text>
              </View>

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
              <Text style={styles.muted}>Change the assignee or the dates before saving.</Text>
            </GlassCard>
          )}

          {conflicts.error && (
            <GlassCard>
              <Text style={styles.error}>{conflicts.error.message}</Text>
            </GlassCard>
          )}

          <Button
            title="Create task"
            onPress={submit}
            disabled={!canSubmit}
            loading={mutation.isPending}
          />
        </ScrollView>
      </KeyboardAvoidingView>

      <PickerSheet
        visible={picker === 'dept'}
        title="Department"
        selected={deptId}
        options={departments.map((d) => ({ value: d.id, label: d.name }))}
        onSelect={(v) => {
          setDeptId(v);
          // The stage and employee lists are department-scoped, so a department
          // change invalidates the current assignee choice.
          setAssignedTo(null);
          setPicker(null);
        }}
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
  form: { gap: 16 },
  label: {
    fontSize: 11,
    fontWeight: '500',
    color: theme.text.label,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  value: { color: '#fff', fontSize: 15, marginTop: 6 },
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

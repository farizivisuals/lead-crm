import { useEffect, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
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
import { one, firstName, shortDate } from '../../../../../lib/data';
import { qk } from '../../../../../lib/queries/keys';
import {
  sortDeliverables,
  deliverableStageId,
  stageRow,
  adjacentStage,
  moveDeliverable,
  saveDeliverableDrafts,
  type DeliverableDraft,
} from '../../../../../lib/queries/task-deliverables';
import { useAuth } from '../../../../../lib/auth';
import {
  useTask,
  useTaskPickers,
  useAvailabilityConflicts,
  moveTaskStage,
  saveTask,
  deleteTask,
  isShootStage,
  shootDueDate,
  diffCreatives,
} from '../../../../../lib/queries/task';
import { PRIORITY_COLORS, theme, withAlpha } from '../../../../../lib/theme';

const PRIORITIES: TaskPriority[] = ['low', 'medium', 'high', 'urgent'];

export default function TaskDetailScreen() {
  const { projectId, taskId } = useLocalSearchParams<{ projectId: string; taskId: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { session } = useAuth();

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
  // Deliverables ("Video 1", "Video 2"): each carries its own stage, so one can
  // be in Post-production while its siblings are still in Shoot.
  const [drafts, setDrafts] = useState<DeliverableDraft[]>([]);
  const [originalDeliverables, setOriginalDeliverables] = useState<
    ReturnType<typeof sortDeliverables>
  >([]);
  // Which deliverable's assignee sheet is open — a row id, or 'all' for the
  // one-tap "assign every deliverable to this person".
  const [assignFor, setAssignFor] = useState<string | 'all' | null>(null);
  const [bulkDate, setBulkDate] = useState('');

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

    const rows = sortDeliverables(row.task_deliverables);
    setOriginalDeliverables(rows);
    setDrafts(
      rows.map((d) => {
        const sid = deliverableStageId(d, row.current_stage_id);
        const scheduled = stageRow(d, sid);
        return {
          id: d.id,
          title: d.title,
          stageId: sid,
          assignedTo: scheduled?.assigned_to ?? null,
          date: scheduled?.scheduled_date ?? '',
        };
      })
    );
  }, [task.data?.id]);

  const stages = pickers.data?.stages ?? [];
  const persistedStageId = task.data?.current_stage_id ?? '';
  const stageId = pendingStageId ?? persistedStageId;
  // The fallback is the PERSISTED stage, so it is only ever correct while no
  // move is pending. `shoot` (derived from the name) decides one date field vs
  // two AND which column saveTask writes, so resolving a pending id to the old
  // stage would write the wrong column — render '—' rather than guess. The
  // stage Pressable is gated on `pickers.isSuccess`, which is what keeps
  // `pendingStageId` from ever being set before `stages` has loaded.
  const stage =
    stages.find((s) => s.id === stageId) ??
    (pendingStageId ? null : one(task.data?.department_stages ?? null));
  const shoot = isShootStage(stage?.name);
  // With deliverables the task's own stage is derived, not chosen.
  const hasDeliverables = drafts.length > 0;

  const conflicts = useAvailabilityConflicts({
    assignedTo,
    startDate,
    dueDate: shootDueDate(shoot, startDate, dueDate),
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
      // `project(id)` does NOT prefix-match `projects()` — different first
      // segment — and the projects list renders a done/total fraction that a
      // move to or from a terminal stage changes.
      queryClient.invalidateQueries({ queryKey: qk.projects() });
      // All Tasks selects department_stages(name, is_terminal) and strikes
      // through terminal tasks — a stage move changes exactly that.
      queryClient.invalidateQueries({ queryKey: qk.allTasks() });
      queryClient.invalidateQueries({ queryKey: qk.dashboards() });
    },
    onError: (e: Error) => {
      // Targeted rollback of just this field — the row snaps back to the
      // persisted stage without a refetch, matching the web board.
      setPendingStageId(null);
      Alert.alert('Could not move task', e.message);
    },
  });

  // A deliverable move is its own write, like the task-level stage move above:
  // it re-points one deliverable and then drags the parent task back to its
  // least-advanced item so dashboards and done/total counts stay truthful.
  const moveDeliverableMutation = useMutation({
    mutationFn: (vars: Parameters<typeof moveDeliverable>[0] & { prevStageId: string }) =>
      moveDeliverable(vars),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.task(taskId) });
      queryClient.invalidateQueries({ queryKey: qk.projectTasks(projectId) });
      queryClient.invalidateQueries({ queryKey: qk.project(projectId) });
      queryClient.invalidateQueries({ queryKey: qk.projects() });
      queryClient.invalidateQueries({ queryKey: qk.allTasks() });
      queryClient.invalidateQueries({ queryKey: qk.dashboards() });
      queryClient.invalidateQueries({ queryKey: qk.calendarTasks() });
    },
    onError: (e: Error, vars) => {
      setDrafts((ds) =>
        ds.map((d) => (d.id === vars.deliverableId ? { ...d, stageId: vars.prevStageId } : d))
      );
      Alert.alert('Could not move deliverable', e.message);
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (vars: Parameters<typeof saveTask>[0]) => {
      await saveTask(vars);
      await saveDeliverableDrafts({
        taskId,
        drafts,
        original: originalDeliverables,
        userId: session?.user.id ?? null,
      });
    },
    onSuccess: () => {
      // Deliverable dates are calendar events of their own.
      queryClient.invalidateQueries({ queryKey: qk.calendarTasks() });
      queryClient.invalidateQueries({ queryKey: qk.task(taskId) });
      queryClient.invalidateQueries({ queryKey: qk.projectTasks(projectId) });
      queryClient.invalidateQueries({ queryKey: qk.project(projectId) });
      // saveTask writes current_stage_id, so it can change the projects list's
      // done/total fraction too. `project(id)` doesn't reach `projects()`.
      queryClient.invalidateQueries({ queryKey: qk.projects() });
      queryClient.invalidateQueries({ queryKey: qk.allTasks() });
      queryClient.invalidateQueries({ queryKey: qk.dashboards() });
      router.back();
    },
    onError: (e: Error) => Alert.alert('Could not save task', e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteTask(taskId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.projectTasks(projectId) });
      queryClient.invalidateQueries({ queryKey: qk.project(projectId) });
      // A deletion changes the projects list's `total`.
      queryClient.invalidateQueries({ queryKey: qk.projects() });
      queryClient.invalidateQueries({ queryKey: qk.allTasks() });
      queryClient.invalidateQueries({ queryKey: qk.dashboards() });
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

  function updateDraft(index: number, patch: Partial<DeliverableDraft>) {
    setDrafts((ds) => ds.map((d, i) => (i === index ? { ...d, ...patch } : d)));
  }

  /**
   * Move ONE deliverable a stage forward or back. Writes immediately (like the
   * task-level stage move) and swaps in that stage's own assignee/date, because
   * who shoots a video and who edits it are different rows.
   */
  function moveOne(index: number, dir: 1 | -1) {
    const d = drafts[index];
    if (!d?.id || moveDeliverableMutation.isPending) return;
    const target = adjacentStage(stages, d.stageId, dir);
    if (!target) return;

    const original = originalDeliverables.find((o) => o.id === d.id);
    const nextRow = original ? stageRow(original, target.id) : null;
    const prevStageId = d.stageId;

    updateDraft(index, {
      stageId: target.id,
      assignedTo: nextRow?.assigned_to ?? null,
      date: nextRow?.scheduled_date ?? '',
    });

    moveDeliverableMutation.mutate({
      deliverableId: d.id,
      toStageId: target.id,
      taskId,
      // Current stages of every saved row, so the parent task lands on the
      // least-advanced one once this move is applied.
      deliverables: drafts
        .filter((x) => x.id)
        .map((x) => ({
          id: x.id!,
          task_id: taskId,
          title: x.title,
          position: 0,
          current_stage_id: x.stageId,
          task_deliverable_assignments: null,
        })),
      stages,
      taskStageId: stageId,
      prevStageId,
    });
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
    const { toAdd, toRemove } = diffCreatives(creativeIds, originalCreativeIds);
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
      creativesToAdd: toAdd,
      creativesToRemove: toRemove,
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

          {pickers.error && (
            <GlassCard>
              <Text style={styles.error}>{pickers.error.message}</Text>
            </GlassCard>
          )}

          <GlassCard>
            {/* Disabled while a move is in flight so a second tap can't open the
                sheet and dispatch another write before the first one lands, and
                until `pickers` resolves — see the `stage` derivation above for
                why `pendingStageId` must never outrun the loaded stage list. */}
            <Pressable
              onPress={() => setPicker('stage')}
              disabled={hasDeliverables || moveMutation.isPending || !pickers.isSuccess}
            >
              <Text style={styles.label}>STAGE</Text>
              <View style={styles.stageRow}>
                <View
                  style={[
                    styles.dot,
                    { backgroundColor: stage?.color ?? theme.colors.mutedForeground },
                  ]}
                />
                <Text style={styles.value}>
                  {stage?.name ?? '—'}
                  {stage?.is_terminal ? ' ✓' : ''}
                </Text>
                {moveMutation.isPending && <Text style={styles.muted}>Moving…</Text>}
              </View>
              {hasDeliverables && (
                <Text style={styles.muted}>
                  Follows the least-advanced deliverable — move them below.
                </Text>
              )}
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
                <Text style={[styles.value, PRIORITY_COLORS[priority] ? { color: PRIORITY_COLORS[priority] } : null]}>
                  {PRIORITY_LABELS[priority]}
                </Text>
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
            <View style={styles.delivHeader}>
              <Text style={styles.label}>DELIVERABLES</Text>
              <Pressable
                onPress={() =>
                  setDrafts((ds) => [
                    ...ds,
                    { id: null, title: '', stageId, assignedTo: null, date: '' },
                  ])
                }
                hitSlop={10}
              >
                <Text style={styles.linkAction}>Add</Text>
              </Pressable>
            </View>

            {drafts.length === 0 && (
              <Text style={styles.muted}>
                No deliverables. Add one to track each video or photo set on its own.
              </Text>
            )}

            {drafts.length > 1 && (
              <View style={styles.bulkRow}>
                <Pressable onPress={() => setAssignFor('all')} style={styles.bulkButton}>
                  <Text style={styles.bulkButtonText}>Assign all to…</Text>
                </Pressable>
                <TextInput
                  value={bulkDate}
                  onChangeText={setBulkDate}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={theme.text.dimmer}
                  autoCapitalize="none"
                  style={[styles.cellInput, styles.bulkDate]}
                />
                <Pressable
                  onPress={() =>
                    setDrafts((ds) => ds.map((d) => ({ ...d, date: bulkDate.trim() })))
                  }
                  disabled={bulkDate.trim().length === 0}
                  style={styles.bulkButton}
                >
                  <Text
                    style={[
                      styles.bulkButtonText,
                      bulkDate.trim().length === 0 && styles.bulkButtonTextOff,
                    ]}
                  >
                    Set all
                  </Text>
                </Pressable>
              </View>
            )}

            {drafts.map((d, index) => {
              const rowStage = stages.find((s) => s.id === d.stageId);
              const color = rowStage?.color ?? theme.colors.mutedForeground;
              const back = adjacentStage(stages, d.stageId, -1);
              const forward = adjacentStage(stages, d.stageId, 1);
              const who =
                pickers.data?.employees.find((e) => e.profile_id === d.assignedTo)?.full_name ??
                null;
              // What earlier phases recorded — "Shoot: Quintin, 14 Aug".
              const history = stages
                .filter((s) => s.position < (rowStage?.position ?? 0))
                .map((s) => {
                  const original = originalDeliverables.find((o) => o.id === d.id);
                  const row = original ? stageRow(original, s.id) : null;
                  if (!row || (!row.assigned_to && !row.scheduled_date)) return null;
                  const name = row.assigned_to
                    ? firstName(one(row.employees)?.profiles?.full_name)
                    : null;
                  return `${s.name}: ${[name, row.scheduled_date ? shortDate(row.scheduled_date) : null]
                    .filter(Boolean)
                    .join(', ')}`;
                })
                .filter(Boolean);

              return (
                <View key={d.id ?? `new-${index}`} style={styles.delivRow}>
                  <View style={styles.delivTop}>
                    <TextInput
                      value={d.title}
                      onChangeText={(t) => updateDraft(index, { title: t })}
                      placeholder="Video 1"
                      placeholderTextColor={theme.text.dimmer}
                      autoCapitalize="sentences"
                      style={[styles.cellInput, styles.delivTitle]}
                    />
                    <Pressable
                      onPress={() => setDrafts((ds) => ds.filter((_, i) => i !== index))}
                      hitSlop={8}
                    >
                      <Text style={styles.removeAction}>Remove</Text>
                    </Pressable>
                  </View>

                  <View style={styles.delivControls}>
                    <View style={[styles.stagePill, { backgroundColor: withAlpha(color, 0.16) }]}>
                      <Text style={[styles.stagePillText, { color }]}>
                        {rowStage?.is_terminal ? `${rowStage.name} ✓` : rowStage?.name ?? '—'}
                      </Text>
                    </View>
                    <View style={styles.spacer} />
                    <Pressable
                      onPress={() => moveOne(index, -1)}
                      disabled={!back || !d.id}
                      hitSlop={8}
                      style={[styles.moveButton, (!back || !d.id) && styles.moveButtonOff]}
                    >
                      <Text style={styles.moveButtonText}>←</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => moveOne(index, 1)}
                      disabled={!forward || !d.id}
                      hitSlop={8}
                      style={[
                        styles.moveButton,
                        forward?.is_terminal && styles.moveButtonDone,
                        (!forward || !d.id) && styles.moveButtonOff,
                      ]}
                    >
                      <Text style={styles.moveButtonText}>
                        {forward?.is_terminal ? 'Done ✓' : `${forward?.name ?? ''} →`}
                      </Text>
                    </Pressable>
                  </View>

                  <View style={styles.delivControls}>
                    <Pressable
                      onPress={() => d.id !== null && setAssignFor(d.id)}
                      disabled={d.id === null}
                      style={styles.assignButton}
                    >
                      <Text style={who ? styles.assignText : styles.assignTextOff}>
                        {who ?? 'Unassigned'}
                      </Text>
                    </Pressable>
                    <TextInput
                      value={d.date}
                      onChangeText={(t) => updateDraft(index, { date: t })}
                      placeholder="YYYY-MM-DD"
                      placeholderTextColor={theme.text.dimmer}
                      autoCapitalize="none"
                      style={[styles.cellInput, styles.delivDate]}
                    />
                  </View>

                  {history.length > 0 && (
                    <Text style={styles.delivHistory}>{history.join(' · ')}</Text>
                  )}
                </View>
              );
            })}
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

          {conflicts.error && (
            <GlassCard>
              <Text style={styles.error}>{conflicts.error.message}</Text>
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
            variant="destructive"
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
          color: s.color ?? theme.colors.mutedForeground,
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
      <PickerSheet
        visible={assignFor !== null}
        title={assignFor === 'all' ? 'Assign every deliverable' : 'Assign deliverable'}
        selected={
          assignFor && assignFor !== 'all'
            ? drafts.find((d) => d.id === assignFor)?.assignedTo ?? 'unassigned'
            : 'unassigned'
        }
        options={[
          { value: 'unassigned', label: 'Unassigned' },
          ...(pickers.data?.employees ?? []).map((e) => ({
            value: e.profile_id,
            label: e.full_name,
          })),
        ]}
        onSelect={(v) => {
          const profileId = v === 'unassigned' ? null : v;
          setDrafts((ds) =>
            ds.map((d) =>
              assignFor === 'all' || d.id === assignFor ? { ...d, assignedTo: profileId } : d
            )
          );
          setAssignFor(null);
        }}
        onClose={() => setAssignFor(null)}
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
  chipOn: {
    borderColor: withAlpha(theme.colors.accentSolid, 0.5),
    backgroundColor: withAlpha(theme.colors.accentSolid, 0.15),
  },
  chipText: { color: theme.text.dim, fontSize: 13 },
  chipTextOn: { color: theme.colors.accent, fontWeight: '600' },
  delivHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  linkAction: { color: theme.colors.accent, fontSize: 13, fontWeight: '600' },
  removeAction: { color: theme.colors.danger, fontSize: 12 },
  bulkRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
  bulkButton: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  bulkButtonText: { color: theme.colors.accent, fontSize: 12, fontWeight: '600' },
  bulkButtonTextOff: { color: theme.text.dimmer },
  bulkDate: { flex: 1 },
  delivRow: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.border,
    gap: 8,
  },
  delivTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  delivTitle: { flex: 1 },
  delivControls: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  spacer: { flex: 1 },
  cellInput: {
    height: 38,
    borderRadius: theme.radius,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: 'rgba(255,255,255,0.05)',
    paddingHorizontal: 10,
    fontSize: 13,
    color: '#fff',
  },
  delivDate: { width: 132 },
  stagePill: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  stagePillText: { fontSize: 11, fontWeight: '600' },
  moveButton: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  moveButtonDone: {
    borderColor: withAlpha(theme.colors.success, 0.5),
    backgroundColor: withAlpha(theme.colors.success, 0.15),
  },
  moveButtonOff: { opacity: 0.3 },
  moveButtonText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  assignButton: {
    flex: 1,
    height: 38,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius,
    paddingHorizontal: 10,
  },
  assignText: { color: '#fff', fontSize: 13 },
  assignTextOff: { color: theme.text.dimmer, fontSize: 13 },
  delivHistory: { color: theme.text.dimmer, fontSize: 11 },
  conflictTitle: { color: theme.colors.warning, fontSize: 14, fontWeight: '600', marginBottom: 6 },
  conflictRow: { color: theme.colors.foreground, fontSize: 13 },
  muted: { color: theme.text.dim, fontSize: 12, marginTop: 6 },
  error: { color: theme.colors.danger, fontSize: 13, textAlign: 'center' },
});

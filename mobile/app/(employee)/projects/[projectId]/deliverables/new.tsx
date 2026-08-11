import { useState } from 'react';
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
import type { DeliverableStatus, DeliverableType } from '@shared/types';
import { DELIVERABLE_STATUS_LABELS, DELIVERABLE_TYPE_LABELS } from '@shared/rbac';
import { Screen } from '../../../../../components/ui/Screen';
import { GlassCard } from '../../../../../components/ui/GlassCard';
import { Button } from '../../../../../components/ui/Button';
import { Input } from '../../../../../components/ui/Input';
import { ScreenHeader } from '../../../../../components/ui/ScreenHeader';
import { PickerSheet } from '../../../../../components/ui/PickerSheet';
import { useAuth } from '../../../../../lib/auth';
import { qk } from '../../../../../lib/queries/keys';
import { useBoard } from '../../../../../lib/queries/board';
import { createDeliverable } from '../../../../../lib/queries/deliverables';
import { theme } from '../../../../../lib/theme';

const TYPES: DeliverableType[] = ['photo', 'video', 'pr'];
const STATUSES: DeliverableStatus[] = [
  'draft',
  'internal_review',
  'client_review',
  'approved',
  'revision_requested',
];
const NO_TASK = 'none';

export default function NewDeliverableScreen() {
  const { projectId } = useLocalSearchParams<{ projectId: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { session } = useAuth();

  // Reuses the board query rather than adding a second fetch of the same rows —
  // it already holds this project's tasks with id and title.
  const board = useBoard(projectId);
  const tasks = board.data?.tasks ?? [];

  const [title, setTitle] = useState('');
  const [type, setType] = useState<DeliverableType>('video');
  const [status, setStatus] = useState<DeliverableStatus>('draft');
  const [dropboxUrl, setDropboxUrl] = useState('');
  const [thumbnailUrl, setThumbnailUrl] = useState('');
  const [taskId, setTaskId] = useState<string | null>(null);
  const [picker, setPicker] = useState<'type' | 'status' | 'task' | null>(null);

  const mutation = useMutation({
    mutationFn: createDeliverable,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.project(projectId) });
      queryClient.invalidateQueries({ queryKey: qk.projects() });
      queryClient.invalidateQueries({ queryKey: qk.dashboards() });
      router.back();
    },
    onError: (e: Error) => Alert.alert('Could not add deliverable', e.message),
  });

  const canSubmit =
    !mutation.isPending &&
    !!session?.user.id &&
    title.trim().length > 0 &&
    dropboxUrl.trim().length > 0;

  function submit() {
    if (!canSubmit) return;
    mutation.mutate({
      project_id: projectId,
      task_id: taskId,
      type,
      title: title.trim(),
      dropbox_url: dropboxUrl.trim(),
      thumbnail_url: thumbnailUrl.trim(),
      status,
      submitted_by: session!.user.id,
    });
  }

  const taskTitle = tasks.find((t) => t.id === taskId)?.title ?? 'None';

  return (
    <Screen>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <ScreenHeader title="New deliverable" onBack={() => router.back()} />

          {board.error && <Text style={styles.error}>{board.error.message}</Text>}

          <GlassCard>
            <View style={styles.form}>
              <Input label="Title" value={title} onChangeText={setTitle} placeholder="Deliverable title" />

              <Pressable onPress={() => setPicker('type')}>
                <Text style={styles.label}>TYPE</Text>
                <Text style={styles.value}>{DELIVERABLE_TYPE_LABELS[type]}</Text>
              </Pressable>

              <Pressable onPress={() => setPicker('status')}>
                <Text style={styles.label}>STATUS</Text>
                <Text style={styles.value}>{DELIVERABLE_STATUS_LABELS[status]}</Text>
              </Pressable>

              <Input
                label="Dropbox link"
                value={dropboxUrl}
                onChangeText={setDropboxUrl}
                placeholder="https://www.dropbox.com/sh/..."
                keyboardType="url"
              />
              <Input
                label="Thumbnail URL"
                value={thumbnailUrl}
                onChangeText={setThumbnailUrl}
                placeholder="Optional"
                keyboardType="url"
              />

              <Pressable onPress={() => setPicker('task')}>
                <Text style={styles.label}>TASK</Text>
                <Text style={styles.value}>{taskTitle}</Text>
                <Text style={styles.muted}>Optional — links this deliverable to one task.</Text>
              </Pressable>
            </View>
          </GlassCard>

          <Button
            title="Add deliverable"
            onPress={submit}
            disabled={!canSubmit}
            loading={mutation.isPending}
          />
        </ScrollView>
      </KeyboardAvoidingView>

      <PickerSheet
        visible={picker === 'type'}
        title="Type"
        selected={type}
        options={TYPES.map((t) => ({ value: t, label: DELIVERABLE_TYPE_LABELS[t] }))}
        onSelect={(v) => {
          setType(v as DeliverableType);
          setPicker(null);
        }}
        onClose={() => setPicker(null)}
      />
      <PickerSheet
        visible={picker === 'status'}
        title="Status"
        selected={status}
        options={STATUSES.map((s) => ({ value: s, label: DELIVERABLE_STATUS_LABELS[s] }))}
        onSelect={(v) => {
          setStatus(v as DeliverableStatus);
          setPicker(null);
        }}
        onClose={() => setPicker(null)}
      />
      <PickerSheet
        visible={picker === 'task'}
        title="Task"
        selected={taskId ?? NO_TASK}
        options={[
          { value: NO_TASK, label: 'None' },
          ...tasks.map((t) => ({ value: t.id, label: t.title })),
        ]}
        onSelect={(v) => {
          setTaskId(v === NO_TASK ? null : v);
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
  muted: { color: theme.text.dim, fontSize: 12, marginTop: 6 },
  error: { color: '#f87171', fontSize: 13 },
});

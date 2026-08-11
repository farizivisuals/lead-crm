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
import type { DeliverableStatus } from '@shared/types';
import { DELIVERABLE_STATUS_LABELS } from '@shared/rbac';
import { Screen } from '../../../../../components/ui/Screen';
import { GlassCard } from '../../../../../components/ui/GlassCard';
import { Button } from '../../../../../components/ui/Button';
import { Input } from '../../../../../components/ui/Input';
import { ScreenHeader } from '../../../../../components/ui/ScreenHeader';
import { PickerSheet } from '../../../../../components/ui/PickerSheet';
import { qk } from '../../../../../lib/queries/keys';
import { useDeliverables, updateDeliverable } from '../../../../../lib/queries/deliverables';
import { theme } from '../../../../../lib/theme';

const STATUSES: DeliverableStatus[] = [
  'draft',
  'internal_review',
  'client_review',
  'approved',
  'revision_requested',
];

export default function EditDeliverableScreen() {
  const { projectId, deliverableId } = useLocalSearchParams<{
    projectId: string;
    deliverableId: string;
  }>();
  const router = useRouter();
  const queryClient = useQueryClient();

  // Seeds from the list query rather than a second single-row fetch — the user
  // always arrives from that list, so it is already warm.
  const { data, isLoading, error } = useDeliverables(projectId);
  const deliverable = data?.find((d) => d.id === deliverableId) ?? null;

  const [title, setTitle] = useState('');
  const [dropboxUrl, setDropboxUrl] = useState('');
  const [thumbnailUrl, setThumbnailUrl] = useState('');
  const [status, setStatus] = useState<DeliverableStatus>('draft');
  const [version, setVersion] = useState(1);
  const [pickerOpen, setPickerOpen] = useState(false);

  useEffect(() => {
    // Keyed on the deliverable's ROW IDENTITY, not on the object — `data` is a
    // new array after every refetch and every invalidation, and re-running this
    // would overwrite whatever the user has typed. Seeding once per id is the
    // whole intent.
    if (!deliverable) return;
    setTitle(deliverable.title);
    setDropboxUrl(deliverable.dropbox_url);
    setThumbnailUrl(deliverable.thumbnail_url ?? '');
    setStatus(deliverable.status);
    setVersion(deliverable.version);
  }, [deliverable?.id]);

  const mutation = useMutation({
    mutationFn: updateDeliverable,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.project(projectId) });
      queryClient.invalidateQueries({ queryKey: qk.projects() });
      queryClient.invalidateQueries({ queryKey: qk.dashboards() });
      router.back();
    },
    onError: (e: Error) => Alert.alert('Could not save deliverable', e.message),
  });

  if (isLoading) {
    return (
      <Screen>
        <View style={styles.centered}>
          <Text style={styles.muted}>Loading…</Text>
        </View>
      </Screen>
    );
  }
  if (error || !deliverable) {
    return (
      <Screen>
        <View style={styles.centered}>
          <Text style={styles.error}>{error?.message ?? 'Deliverable not found'}</Text>
        </View>
      </Screen>
    );
  }

  const bumped = version !== deliverable.version;
  const canSubmit =
    !mutation.isPending && title.trim().length > 0 && dropboxUrl.trim().length > 0;

  function bumpVersion() {
    // Local state only. The single submit below writes the new version and the
    // client_review status together — there is no separate "send to client"
    // request, which is what the web's dead 404 button tried to be.
    setVersion((v) => v + 1);
    setStatus('client_review');
  }

  function submit() {
    if (!canSubmit) return;
    mutation.mutate({
      id: deliverableId,
      title: title.trim(),
      dropbox_url: dropboxUrl.trim(),
      thumbnail_url: thumbnailUrl.trim(),
      status,
      version,
    });
  }

  return (
    <Screen>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <ScreenHeader title="Edit deliverable" onBack={() => router.back()} />

          <GlassCard>
            <View style={styles.form}>
              <Input label="Title" value={title} onChangeText={setTitle} placeholder="Deliverable title" />

              <View>
                <View style={styles.versionRow}>
                  <Text style={styles.label}>VERSION</Text>
                  <Pressable onPress={bumpVersion} hitSlop={8}>
                    <Text style={styles.bump}>
                      v{version} → v{version + 1}
                    </Text>
                  </Pressable>
                </View>
                <Text style={styles.muted}>
                  Bumping also moves this deliverable to Client Review.
                </Text>
              </View>

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

              <Pressable onPress={() => setPickerOpen(true)}>
                <Text style={styles.label}>STATUS</Text>
                <Text style={styles.value}>{DELIVERABLE_STATUS_LABELS[status]}</Text>
              </Pressable>
            </View>
          </GlassCard>

          <Button
            title={bumped ? `Save as v${version}` : 'Save changes'}
            onPress={submit}
            disabled={!canSubmit}
            loading={mutation.isPending}
          />
        </ScrollView>
      </KeyboardAvoidingView>

      <PickerSheet
        visible={pickerOpen}
        title="Status"
        selected={status}
        options={STATUSES.map((s) => ({ value: s, label: DELIVERABLE_STATUS_LABELS[s] }))}
        onSelect={(v) => {
          setStatus(v as DeliverableStatus);
          setPickerOpen(false);
        }}
        onClose={() => setPickerOpen(false)}
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
  versionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  bump: { color: theme.text.label, fontSize: 12, fontWeight: '500' },
  muted: { color: theme.text.dim, fontSize: 13 },
  error: { color: '#f87171', fontSize: 13, textAlign: 'center' },
});

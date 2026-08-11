import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { RevisionAction } from '@shared/types';
import {
  PROJECT_STATUS_LABELS,
  DELIVERABLE_STATUS_LABELS,
  DELIVERABLE_TYPE_LABELS,
} from '@shared/rbac';
import { Screen } from '../../../components/ui/Screen';
import { GlassCard } from '../../../components/ui/GlassCard';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { ScreenHeader } from '../../../components/ui/ScreenHeader';
import { useAuth } from '../../../lib/auth';
import { one, shortDate } from '../../../lib/data';
import { qk } from '../../../lib/queries/keys';
import { latestRevision } from '../../../lib/queries/deliverables';
import {
  usePortalProject,
  submitRevision,
  type PortalDeliverable,
} from '../../../lib/queries/portal';
import { theme } from '../../../lib/theme';

export default function ClientProjectDetail() {
  const { projectId } = useLocalSearchParams<{ projectId: string }>();
  const router = useRouter();
  const { data, isLoading, error } = usePortalProject(projectId);

  if (isLoading) {
    return (
      <Screen>
        <View style={styles.centered}>
          <Text style={styles.muted}>Loading…</Text>
        </View>
      </Screen>
    );
  }
  if (error || !data) {
    return (
      <Screen>
        <View style={styles.centered}>
          <Text style={styles.error}>{error?.message ?? 'Project not found'}</Text>
        </View>
      </Screen>
    );
  }

  const { project, deliverables } = data;

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.scroll}>
        <ScreenHeader title={project.name} onBack={() => router.back()} />

        <GlassCard>
          <View style={styles.rowTop}>
            <Text style={styles.label}>STATUS</Text>
            <Badge label={PROJECT_STATUS_LABELS[project.status]} />
          </View>
          <Text style={styles.meta}>
            {project.start_date ? `Start ${shortDate(project.start_date)}` : 'No start date'}
            {project.target_end_date ? `   Due ${shortDate(project.target_end_date)}` : ''}
          </Text>
        </GlassCard>

        <Text style={styles.sectionTitle}>Deliverables</Text>
        {deliverables.length === 0 ? (
          <GlassCard>
            <Text style={styles.muted}>Nothing shared yet</Text>
          </GlassCard>
        ) : (
          deliverables.map((deliverable) => (
            <DeliverableCard key={deliverable.id} deliverable={deliverable} projectId={projectId} />
          ))
        )}
      </ScrollView>
    </Screen>
  );
}

function DeliverableCard({
  deliverable,
  projectId,
}: {
  deliverable: PortalDeliverable;
  projectId: string;
}) {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const [action, setAction] = useState<RevisionAction | null>(null);
  const [note, setNote] = useState('');

  const revision = latestRevision(deliverable.deliverable_revisions);

  const mutation = useMutation({
    mutationFn: submitRevision,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.portalProject(projectId) });
      setAction(null);
      setNote('');
    },
    onError: (e: Error) => Alert.alert('Could not send feedback', e.message),
  });

  // A revision request must say what needs to change; an approval note is
  // optional. Web parity, and the web enforces the same asymmetry.
  const canSubmit =
    !mutation.isPending && (action === 'approve' || note.trim().length > 0);

  async function openDropbox() {
    try {
      await Linking.openURL(deliverable.dropbox_url);
    } catch {
      Alert.alert('Could not open link', deliverable.dropbox_url);
    }
  }

  function submit() {
    if (!canSubmit || !action || !session?.user.id) return;
    mutation.mutate({
      deliverableId: deliverable.id,
      actorProfileId: session.user.id,
      action,
      note,
    });
  }

  return (
    <GlassCard>
      <View style={styles.rowTop}>
        <View style={styles.flex}>
          <View style={styles.typeRow}>
            <Text style={styles.typeChip}>{DELIVERABLE_TYPE_LABELS[deliverable.type]}</Text>
            <Text style={styles.version}>v{deliverable.version}</Text>
          </View>
          <Text style={styles.title} numberOfLines={2}>
            {deliverable.title}
          </Text>
          <Text style={styles.meta}>Shared {shortDate(deliverable.submitted_at)}</Text>
        </View>
        <Badge label={DELIVERABLE_STATUS_LABELS[deliverable.status]} />
      </View>

      {revision && (
        <View style={styles.revision}>
          <Text style={revision.action === 'approve' ? styles.approved : styles.revisionRequested}>
            {revision.action === 'approve' ? '✓ Approved' : '↩ Revision requested'}
          </Text>
          {revision.note ? <Text style={styles.revisionNote}>{revision.note}</Text> : null}
          <Text style={styles.revisionMeta}>
            by {one(revision.profiles)?.full_name ?? 'Unknown'} · {shortDate(revision.created_at)}
          </Text>
        </View>
      )}

      <Pressable onPress={openDropbox} hitSlop={8} style={styles.openRow}>
        <Text style={styles.action}>Open in Dropbox</Text>
      </Pressable>

      {action === null ? (
        <View style={styles.actions}>
          <Pressable onPress={() => setAction('approve')} hitSlop={8}>
            <Text style={styles.approve}>Approve</Text>
          </Pressable>
          <Pressable onPress={() => setAction('request_revision')} hitSlop={8}>
            <Text style={styles.request}>Request changes</Text>
          </Pressable>
        </View>
      ) : (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.form}>
            <Text style={styles.formTitle}>
              {action === 'approve' ? 'Confirm approval' : 'Describe the changes needed'}
            </Text>
            <Input
              label={action === 'approve' ? 'Note (optional)' : 'What needs to change'}
              value={note}
              onChangeText={setNote}
              placeholder={action === 'approve' ? 'Looks great' : 'Please describe…'}
            />
            <Button
              title={action === 'approve' ? 'Approve' : 'Send request'}
              onPress={submit}
              disabled={!canSubmit}
              loading={mutation.isPending}
            />
            <Button
              title="Cancel"
              variant="ghost"
              onPress={() => {
                setAction(null);
                setNote('');
              }}
            />
          </View>
        </KeyboardAvoidingView>
      )}
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 20, gap: 12, paddingBottom: 160 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  flex: { flex: 1 },
  rowTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  label: {
    fontSize: 11,
    fontWeight: '500',
    color: theme.text.label,
    textTransform: 'uppercase',
    letterSpacing: 1,
    flex: 1,
  },
  sectionTitle: { color: '#fff', fontSize: 15, fontWeight: '600', marginTop: 12 },
  typeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  typeChip: {
    color: theme.colors.foreground,
    fontSize: 11,
    fontWeight: '500',
    borderWidth: 1,
    borderColor: theme.colors.borderStrong,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  version: { color: theme.text.dimmer, fontSize: 11, fontWeight: '500' },
  title: { color: '#fff', fontSize: 15, fontWeight: '600', marginTop: 8 },
  meta: { color: theme.text.dim, fontSize: 12, marginTop: 6 },
  revision: {
    marginTop: 12,
    borderRadius: theme.radius,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.glass,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  approved: { color: '#34d399', fontSize: 12, fontWeight: '600' },
  revisionRequested: { color: '#fb923c', fontSize: 12, fontWeight: '600' },
  revisionNote: { color: theme.text.label, fontSize: 13, marginTop: 4 },
  revisionMeta: { color: theme.text.dimmer, fontSize: 11, marginTop: 6 },
  openRow: { marginTop: 12 },
  action: { color: theme.text.label, fontSize: 13, fontWeight: '500' },
  actions: {
    flexDirection: 'row',
    gap: 20,
    marginTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.border,
    paddingTop: 12,
  },
  approve: { color: '#34d399', fontSize: 14, fontWeight: '600' },
  request: { color: '#fb923c', fontSize: 14, fontWeight: '600' },
  form: {
    gap: 12,
    marginTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.border,
    paddingTop: 12,
  },
  formTitle: { color: '#fff', fontSize: 14, fontWeight: '600' },
  muted: { color: theme.text.dim, fontSize: 13 },
  error: { color: '#f87171', fontSize: 13, textAlign: 'center' },
});

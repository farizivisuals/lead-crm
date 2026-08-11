import { Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { isExecutive, DELIVERABLE_STATUS_LABELS, DELIVERABLE_TYPE_LABELS } from '@shared/rbac';
import { Screen } from '../../../../../components/ui/Screen';
import { GlassCard } from '../../../../../components/ui/GlassCard';
import { Badge } from '../../../../../components/ui/Badge';
import { ScreenHeader } from '../../../../../components/ui/ScreenHeader';
import { useAuth } from '../../../../../lib/auth';
import { one, shortDate, isCreativeEmployee } from '../../../../../lib/data';
import {
  useDeliverables,
  latestRevision,
  type DeliverableRow,
} from '../../../../../lib/queries/deliverables';
import { theme } from '../../../../../lib/theme';

export default function DeliverablesScreen() {
  const { projectId } = useLocalSearchParams<{ projectId: string }>();
  const router = useRouter();
  const { employee } = useAuth();
  // Cosmetic only — RLS (deliverables_update) permits any employee who can see
  // the project. This mirrors the web's own gate.
  const canReview = isExecutive(employee?.role ?? 'employee') || isCreativeEmployee(employee);

  const { data, isLoading, error } = useDeliverables(projectId);

  function newDeliverable() {
    // @ts-expect-error — the /projects/[projectId]/deliverables/new route does
    // not exist until Task 3 creates it. Delete this directive (not the call) in Task 3.
    router.push({ pathname: '/projects/[projectId]/deliverables/new', params: { projectId } });
  }

  function editDeliverable(deliverableId: string) {
    // @ts-expect-error — the /projects/[projectId]/deliverables/[deliverableId]
    // route does not exist until Task 3 creates it. Delete this directive (not
    // the call) in Task 3.
    router.push({ pathname: '/projects/[projectId]/deliverables/[deliverableId]', params: { projectId, deliverableId } });
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.scroll}>
        <ScreenHeader
          title="Deliverables"
          onBack={() => router.back()}
          right={
            <Pressable onPress={newDeliverable} hitSlop={10}>
              <Text style={styles.newButton}>New</Text>
            </Pressable>
          }
        />

        {error && <Text style={styles.error}>{error.message}</Text>}

        {isLoading ? (
          <Text style={styles.muted}>Loading…</Text>
        ) : error ? null : (data?.length ?? 0) === 0 ? (
          <GlassCard>
            <Text style={styles.emptyTitle}>No deliverables yet</Text>
            <Text style={styles.muted}>Add a Dropbox link to submit your first deliverable</Text>
          </GlassCard>
        ) : (
          data!.map((d) => (
            <DeliverableCard
              key={d.id}
              deliverable={d}
              canReview={canReview}
              onEdit={() => editDeliverable(d.id)}
            />
          ))
        )}
      </ScrollView>
    </Screen>
  );
}

function DeliverableCard({
  deliverable,
  canReview,
  onEdit,
}: {
  deliverable: DeliverableRow;
  canReview: boolean;
  onEdit: () => void;
}) {
  const revision = latestRevision(deliverable.deliverable_revisions);
  const submitter = one(deliverable.profiles)?.full_name ?? 'Unknown';

  async function openDropbox() {
    try {
      await Linking.openURL(deliverable.dropbox_url);
    } catch {
      Alert.alert('Could not open link', deliverable.dropbox_url);
    }
  }

  return (
    <GlassCard>
      <View style={styles.cardTop}>
        <View style={styles.flex}>
          <View style={styles.typeRow}>
            <Text style={styles.typeChip}>{DELIVERABLE_TYPE_LABELS[deliverable.type]}</Text>
            <Text style={styles.version}>v{deliverable.version}</Text>
          </View>
          <Text style={styles.title} numberOfLines={2}>
            {deliverable.title}
          </Text>
          <Text style={styles.meta}>
            By {submitter} · {shortDate(deliverable.submitted_at)}
          </Text>
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

      <View style={styles.actions}>
        <Pressable onPress={openDropbox} hitSlop={8}>
          <Text style={styles.action}>Open in Dropbox</Text>
        </Pressable>
        {canReview ? (
          <Pressable onPress={onEdit} hitSlop={8}>
            <Text style={styles.action}>Edit</Text>
          </Pressable>
        ) : null}
      </View>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 20, gap: 12, paddingBottom: 140 },
  flex: { flex: 1 },
  newButton: { color: '#fff', fontSize: 15, fontWeight: '600' },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
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
  meta: { color: theme.text.dim, fontSize: 12, marginTop: 4 },
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
  actions: { flexDirection: 'row', gap: 20, marginTop: 12 },
  action: { color: theme.text.label, fontSize: 13, fontWeight: '500' },
  emptyTitle: { color: '#fff', fontSize: 15, fontWeight: '600', marginBottom: 4 },
  muted: { color: theme.text.dim, fontSize: 13 },
  error: { color: '#f87171', fontSize: 13 },
});

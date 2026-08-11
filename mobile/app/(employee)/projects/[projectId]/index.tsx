import { useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { ProjectStatus } from '@shared/types';
import { isExecutive, PROJECT_STATUS_LABELS, DEPT_COLORS } from '@shared/rbac';
import { Screen } from '../../../../components/ui/Screen';
import { GlassCard } from '../../../../components/ui/GlassCard';
import { Button } from '../../../../components/ui/Button';
import { Input } from '../../../../components/ui/Input';
import { Badge } from '../../../../components/ui/Badge';
import { ScreenHeader } from '../../../../components/ui/ScreenHeader';
import { PickerSheet } from '../../../../components/ui/PickerSheet';
import { useAuth } from '../../../../lib/auth';
import { one, shortDate, isCreativeEmployee } from '../../../../lib/data';
import { qk } from '../../../../lib/queries/keys';
import {
  useProjectDetail,
  updateProjectStatus,
  updateMoodboardUrl,
  addProjectCreative,
  removeProjectCreative,
} from '../../../../lib/queries/project-detail';
import { theme } from '../../../../lib/theme';

const STATUSES: ProjectStatus[] = ['planning', 'active', 'on_hold', 'completed', 'cancelled'];

export default function ProjectDetailScreen() {
  const { projectId } = useLocalSearchParams<{ projectId: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { employee } = useAuth();

  const canManage = isExecutive(employee?.role ?? 'employee');
  const canEditMoodboard = canManage || isCreativeEmployee(employee);

  const { data, isLoading, error } = useProjectDetail(projectId);

  // Optimistic mirror of the persisted status; null means "show the server's".
  const [pendingStatus, setPendingStatus] = useState<ProjectStatus | null>(null);
  const [statusPickerOpen, setStatusPickerOpen] = useState(false);
  const [creativePickerOpen, setCreativePickerOpen] = useState(false);
  const [editingMoodboard, setEditingMoodboard] = useState(false);
  const [moodboardDraft, setMoodboardDraft] = useState('');
  // Local mirror of the just-saved moodboard URL, shown immediately after a
  // successful save so there's no stale flash during the invalidate/refetch
  // round-trip (web parity — MoodboardEditor.tsx's local `setUrl`).
  // `undefined` means "no local override, trust the query result".
  const [savedMoodboardUrl, setSavedMoodboardUrl] = useState<string | null | undefined>(undefined);

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: qk.project(projectId) });

  const statusMutation = useMutation({
    mutationFn: (status: ProjectStatus) => updateProjectStatus(projectId, status),
    onSuccess: () => {
      setPendingStatus(null);
      invalidate();
      queryClient.invalidateQueries({ queryKey: qk.projects() });
    },
    onError: (e: Error) => {
      setPendingStatus(null); // targeted rollback: only this field reverts
      Alert.alert('Could not update status', e.message);
    },
  });

  const moodboardMutation = useMutation({
    mutationFn: (url: string | null) => updateMoodboardUrl(projectId, url),
    onSuccess: (_data, url) => {
      setSavedMoodboardUrl(url);
      setEditingMoodboard(false);
      invalidate();
    },
    onError: (e: Error) => Alert.alert('Could not save moodboard', e.message),
  });

  const addCreativeMutation = useMutation({
    mutationFn: (profileId: string) => addProjectCreative(projectId, profileId),
    onSuccess: invalidate,
    onError: (e: Error) => Alert.alert('Could not add creative', e.message),
  });

  const removeCreativeMutation = useMutation({
    mutationFn: (profileId: string) => removeProjectCreative(projectId, profileId),
    onSuccess: invalidate,
    onError: (e: Error) => Alert.alert('Could not remove creative', e.message),
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
  if (error || !data) {
    return (
      <Screen>
        <View style={styles.centered}>
          <Text style={styles.error}>{error?.message ?? 'Project not found'}</Text>
          <Button title="Back to projects" variant="ghost" onPress={() => router.back()} />
        </View>
      </Screen>
    );
  }

  const { project, progress, deliverableCount, assignedCreatives, availableCreatives } = data;
  const clientName = one(project.clients)?.company_name ?? '—';
  const status = pendingStatus ?? project.status;
  const moodboardUrl = savedMoodboardUrl !== undefined ? savedMoodboardUrl : project.moodboard_url;
  const depts = (project.project_departments ?? [])
    .map((pd) => one(pd.departments))
    .filter((d): d is { name: string; slug: string } => !!d);

  function chooseStatus(next: string) {
    setStatusPickerOpen(false);
    if (next === status) return; // web parity: skip the no-op write — compare against the effective (possibly in-flight) status, not the stale server value
    setPendingStatus(next as ProjectStatus); // optimistic
    statusMutation.mutate(next as ProjectStatus);
  }

  function openTasks() {
    // @ts-expect-error — the /projects/[projectId]/tasks route does not exist
    // until Task 4 creates it. Delete this directive (not the call) in Task 4.
    router.push({ pathname: '/projects/[projectId]/tasks', params: { projectId } });
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <ScreenHeader title={project.name} subtitle={clientName} onBack={() => router.back()} />

        <GlassCard>
          {project.description ? (
            <Text style={styles.description}>{project.description}</Text>
          ) : null}

          <View style={styles.statusRow}>
            {canManage ? (
              <Pressable
                onPress={() => setStatusPickerOpen(true)}
                disabled={statusMutation.isPending}
              >
                <Badge label={`${PROJECT_STATUS_LABELS[status]}  ▾`} />
              </Pressable>
            ) : (
              <Badge label={PROJECT_STATUS_LABELS[status]} />
            )}
            {depts.map((d) => (
              <Badge key={d.slug} label={d.name} color={DEPT_COLORS[d.slug]} />
            ))}
          </View>

          <View style={styles.dates}>
            <Text style={styles.meta}>Start {shortDate(project.start_date)}</Text>
            <Text style={styles.meta}>Due {shortDate(project.target_end_date)}</Text>
          </View>

          {canManage && (
            <View style={styles.creatives}>
              <Text style={styles.label}>CREATIVES</Text>
              <View style={styles.chipRow}>
                {assignedCreatives.map((c) => (
                  <Pressable
                    key={c.profile_id}
                    onPress={() => removeCreativeMutation.mutate(c.profile_id)}
                    style={styles.chip}
                  >
                    <Text style={styles.chipText}>{c.full_name}  ×</Text>
                  </Pressable>
                ))}
                {assignedCreatives.length === 0 && (
                  <Text style={styles.muted}>No creatives assigned</Text>
                )}
                {availableCreatives.length > 0 && (
                  <Pressable onPress={() => setCreativePickerOpen(true)} style={styles.chip}>
                    <Text style={styles.chipText}>+ Add</Text>
                  </Pressable>
                )}
              </View>
              {(addCreativeMutation.isPending || removeCreativeMutation.isPending) && (
                <Text style={styles.muted}>Saving…</Text>
              )}
            </View>
          )}
        </GlassCard>

        <GlassCard>
          <Text style={styles.label}>MOODBOARD</Text>
          {editingMoodboard ? (
            <View style={styles.moodboardForm}>
              <Input
                label="Link"
                value={moodboardDraft}
                onChangeText={setMoodboardDraft}
                placeholder="https://canva.com/…"
              />
              <Button
                title="Save"
                loading={moodboardMutation.isPending}
                onPress={() => moodboardMutation.mutate(moodboardDraft.trim() || null)}
              />
              <Button title="Cancel" variant="ghost" onPress={() => setEditingMoodboard(false)} />
            </View>
          ) : moodboardUrl ? (
            <View style={styles.moodboardRow}>
              <Pressable
                style={styles.flex}
                onPress={() => Linking.openURL(moodboardUrl)}
              >
                <Text style={styles.link} numberOfLines={1}>
                  {moodboardUrl}
                </Text>
              </Pressable>
              {canEditMoodboard && (
                <Pressable
                  onPress={() => {
                    setMoodboardDraft(moodboardUrl ?? '');
                    setEditingMoodboard(true);
                  }}
                >
                  <Text style={styles.editText}>Edit</Text>
                </Pressable>
              )}
            </View>
          ) : canEditMoodboard ? (
            <Pressable
              onPress={() => {
                setMoodboardDraft('');
                setEditingMoodboard(true);
              }}
            >
              <Text style={styles.placeholderCard}>+ Link a moodboard</Text>
            </Pressable>
          ) : (
            <Text style={styles.muted}>No moodboard linked yet</Text>
          )}
        </GlassCard>

        <Pressable onPress={openTasks}>
          <GlassCard>
            <Text style={styles.tileTitle}>Tasks</Text>
            <Text style={styles.muted}>
              {progress.total > 0
                ? `${progress.done} / ${progress.total} done`
                : 'No tasks yet'}
            </Text>
          </GlassCard>
        </Pressable>

        <GlassCard>
          <Text style={styles.tileTitleSoon}>Deliverables · Soon</Text>
          <Text style={styles.muted}>{deliverableCount} total</Text>
        </GlassCard>

        <GlassCard>
          <Text style={styles.tileTitleSoon}>Activity · Soon</Text>
        </GlassCard>
      </ScrollView>

      <PickerSheet
        visible={statusPickerOpen}
        title="Project status"
        selected={status}
        options={STATUSES.map((s) => ({ value: s, label: PROJECT_STATUS_LABELS[s] }))}
        onSelect={chooseStatus}
        onClose={() => setStatusPickerOpen(false)}
      />
      <PickerSheet
        visible={creativePickerOpen}
        title="Add creative"
        options={availableCreatives.map((c) => ({ value: c.profile_id, label: c.full_name }))}
        onSelect={(profileId) => {
          setCreativePickerOpen(false);
          addCreativeMutation.mutate(profileId);
        }}
        onClose={() => setCreativePickerOpen(false)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 20, gap: 16, paddingBottom: 140 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  flex: { flex: 1 },
  description: { color: theme.text.label, fontSize: 14, marginBottom: 12 },
  statusRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' },
  dates: { flexDirection: 'row', gap: 16, marginTop: 12 },
  meta: { color: theme.text.dim, fontSize: 12 },
  creatives: { marginTop: 16, gap: 4 },
  label: {
    fontSize: 11,
    fontWeight: '500',
    color: theme.text.label,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  chip: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  chipText: { color: theme.colors.foreground, fontSize: 13 },
  moodboardForm: { gap: 12, marginTop: 12 },
  moodboardRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 8 },
  link: { color: '#a5b4fc', fontSize: 13 },
  editText: { color: theme.text.dim, fontSize: 13 },
  placeholderCard: {
    color: theme.text.dim,
    fontSize: 13,
    marginTop: 10,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: theme.colors.border,
    borderRadius: theme.radius,
    paddingVertical: 18,
    textAlign: 'center',
  },
  tileTitle: { color: '#fff', fontSize: 16, fontWeight: '600', marginBottom: 4 },
  tileTitleSoon: {
    color: theme.colors.mutedForeground,
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  muted: { color: theme.text.dim, fontSize: 13 },
  error: { color: '#f87171', fontSize: 13, textAlign: 'center' },
});

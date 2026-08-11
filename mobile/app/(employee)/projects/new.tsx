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
import { useRouter } from 'expo-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { ProjectStatus } from '@shared/types';
import { PROJECT_STATUS_LABELS, DEPT_COLORS } from '@shared/rbac';
import { Screen } from '../../../components/ui/Screen';
import { GlassCard } from '../../../components/ui/GlassCard';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { ScreenHeader } from '../../../components/ui/ScreenHeader';
import { PickerSheet } from '../../../components/ui/PickerSheet';
import { useAuth } from '../../../lib/auth';
import { qk } from '../../../lib/queries/keys';
import {
  createProject,
  useProjectFormOptions,
} from '../../../lib/queries/projects';
import { theme } from '../../../lib/theme';

const STATUSES: ProjectStatus[] = ['planning', 'active', 'on_hold', 'completed', 'cancelled'];

export default function NewProjectScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { session } = useAuth();
  const { data: options, isLoading } = useProjectFormOptions();

  const [clientId, setClientId] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<ProjectStatus>('planning');
  const [startDate, setStartDate] = useState('');
  const [targetEndDate, setTargetEndDate] = useState('');
  // An ORDERED list, not a Set: the first entry becomes the primary department.
  const [deptIds, setDeptIds] = useState<string[]>([]);
  const [creativeIds, setCreativeIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [picker, setPicker] = useState<'client' | 'status' | null>(null);

  const clientName =
    options?.clients.find((c) => c.id === clientId)?.company_name ?? 'Select a client';

  function toggle(list: string[], set: (v: string[]) => void, id: string) {
    // Append on select so selection order survives — createProject marks
    // departmentIds[0] as primary.
    set(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  }

  const mutation = useMutation({
    mutationFn: createProject,
    onSuccess: (projectId) => {
      queryClient.invalidateQueries({ queryKey: qk.projects() });
      router.replace({ pathname: '/projects/[projectId]', params: { projectId } });
    },
    onError: (e: Error) => Alert.alert('Could not create project', e.message),
  });

  function submit() {
    if (!clientId) return setError('Select a client');
    if (!name.trim()) return setError('Enter a project name');
    if (deptIds.length === 0) return setError('Select at least one department');
    if (!session?.user.id) return setError('No active session');
    setError(null);
    mutation.mutate({
      client_id: clientId,
      name: name.trim(),
      description,
      status,
      start_date: startDate,
      target_end_date: targetEndDate,
      departmentIds: deptIds,
      creativeProfileIds: creativeIds,
      userId: session.user.id,
    });
  }

  return (
    <Screen>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <ScreenHeader title="New project" onBack={() => router.back()} />

          <GlassCard>
            <View style={styles.form}>
              <Pressable onPress={() => setPicker('client')}>
                <Text style={styles.label}>CLIENT</Text>
                <Text style={clientId ? styles.value : styles.placeholder}>{clientName}</Text>
              </Pressable>

              <Input label="Name" value={name} onChangeText={setName} placeholder="Campaign name" />
              <Input
                label="Description"
                value={description}
                onChangeText={setDescription}
                placeholder="Optional"
              />

              <Pressable onPress={() => setPicker('status')}>
                <Text style={styles.label}>STATUS</Text>
                <Text style={styles.value}>{PROJECT_STATUS_LABELS[status]}</Text>
              </Pressable>

              <Input
                label="Start date"
                value={startDate}
                onChangeText={setStartDate}
                placeholder="YYYY-MM-DD"
              />
              <Input
                label="Target end date"
                value={targetEndDate}
                onChangeText={setTargetEndDate}
                placeholder="YYYY-MM-DD"
              />
            </View>
          </GlassCard>

          <GlassCard>
            <Text style={styles.label}>DEPARTMENTS</Text>
            <Text style={styles.hint}>The first one you pick becomes the primary department.</Text>
            <View style={styles.chipRow}>
              {(options?.departments ?? []).map((d) => {
                const index = deptIds.indexOf(d.id);
                const on = index >= 0;
                return (
                  <Pressable
                    key={d.id}
                    onPress={() => toggle(deptIds, setDeptIds, d.id)}
                    style={[
                      styles.chip,
                      on && { borderColor: DEPT_COLORS[d.slug] ?? '#fff', backgroundColor: 'rgba(255,255,255,0.10)' },
                    ]}
                  >
                    <Text style={[styles.chipText, on && styles.chipTextOn]}>
                      {index === 0 ? `${d.name} · primary` : d.name}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </GlassCard>

          <GlassCard>
            <Text style={styles.label}>CREATIVES</Text>
            <View style={styles.chipRow}>
              {(options?.creatives ?? []).map((c) => {
                const on = creativeIds.includes(c.profile_id);
                return (
                  <Pressable
                    key={c.profile_id}
                    onPress={() => toggle(creativeIds, setCreativeIds, c.profile_id)}
                    style={[styles.chip, on && styles.chipOn]}
                  >
                    <Text style={[styles.chipText, on && styles.chipTextOn]}>{c.full_name}</Text>
                  </Pressable>
                );
              })}
              {!isLoading && (options?.creatives.length ?? 0) === 0 && (
                <Text style={styles.hint}>No creatives available.</Text>
              )}
            </View>
          </GlassCard>

          {error && <Text style={styles.error}>{error}</Text>}

          <Button title="Create project" onPress={submit} loading={mutation.isPending} />
        </ScrollView>
      </KeyboardAvoidingView>

      <PickerSheet
        visible={picker === 'client'}
        title="Client"
        searchable
        selected={clientId}
        options={(options?.clients ?? []).map((c) => ({ value: c.id, label: c.company_name }))}
        onSelect={(v) => {
          setClientId(v);
          setPicker(null);
        }}
        onClose={() => setPicker(null)}
      />
      <PickerSheet
        visible={picker === 'status'}
        title="Status"
        selected={status}
        options={STATUSES.map((s) => ({ value: s, label: PROJECT_STATUS_LABELS[s] }))}
        onSelect={(v) => {
          setStatus(v as ProjectStatus);
          setPicker(null);
        }}
        onClose={() => setPicker(null)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { padding: 20, gap: 16, paddingBottom: 140 },
  form: { gap: 16 },
  label: {
    fontSize: 11,
    fontWeight: '500',
    color: theme.text.label,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  hint: { color: theme.text.dimmer, fontSize: 12, marginTop: 4 },
  value: { color: '#fff', fontSize: 15, marginTop: 6 },
  placeholder: { color: theme.text.dimmer, fontSize: 15, marginTop: 6 },
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
  error: { color: '#f87171', fontSize: 13 },
});

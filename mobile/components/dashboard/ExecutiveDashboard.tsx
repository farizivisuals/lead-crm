import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { PROJECT_STATUS_LABELS } from '@shared/rbac';
import { Screen } from '../ui/Screen';
import { GlassCard } from '../ui/GlassCard';
import { Badge } from '../ui/Badge';
import { ScreenHeader } from '../ui/ScreenHeader';
import { PickerSheet } from '../ui/PickerSheet';
import { one, relativeTime } from '../../lib/data';
import { useExecutiveDashboard } from '../../lib/queries/dashboard';
import { theme } from '../../lib/theme';

export function ExecutiveDashboard() {
  const router = useRouter();
  // Local, per-screen, not persisted — web parity (see the task preamble).
  const [deptId, setDeptId] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  const { data, isLoading, error } = useExecutiveDashboard(deptId);
  const deptName = deptId
    ? (data?.departments.find((d) => d.id === deptId)?.name ?? 'Department')
    : 'All Departments';
  const filtered = !!deptId;

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.scroll}>
        <ScreenHeader
          title="Dashboard"
          right={
            <Pressable onPress={() => setPickerOpen(true)} hitSlop={10}>
              <Text style={styles.filterButton}>{deptName}</Text>
            </Pressable>
          }
        />

        {error && <Text style={styles.error}>{error.message}</Text>}

        <View style={styles.tiles}>
          <Tile
            label={filtered ? 'Dept Clients' : 'Total Clients'}
            value={isLoading ? '—' : String(data?.clientCount ?? 0)}
          />
          <Tile
            label={filtered ? 'Dept Projects' : 'Active Projects'}
            value={isLoading ? '—' : String(data?.projectCount ?? 0)}
          />
          <Tile
            label="Open Tasks"
            value={isLoading ? '—' : String(data?.openTaskCount ?? 0)}
          />
        </View>

        <Text style={styles.sectionTitle}>Recent Projects</Text>
        {isLoading ? (
          <Text style={styles.muted}>Loading…</Text>
        ) : error ? null : (data?.recentProjects.length ?? 0) === 0 ? (
          <GlassCard>
            <Text style={styles.muted}>No projects yet</Text>
          </GlassCard>
        ) : (
          data!.recentProjects.map((p) => (
            <Pressable
              key={p.id}
              onPress={() =>
                router.push({ pathname: '/projects/[projectId]', params: { projectId: p.id } })
              }
            >
              <GlassCard>
                <View style={styles.rowTop}>
                  <Text style={styles.rowTitle} numberOfLines={1}>
                    {p.name}
                  </Text>
                  <Badge label={PROJECT_STATUS_LABELS[p.status]} />
                </View>
                <Text style={styles.muted}>{one(p.clients)?.company_name ?? '—'}</Text>
              </GlassCard>
            </Pressable>
          ))
        )}

        <Text style={styles.sectionTitle}>Activity</Text>
        {isLoading ? (
          <Text style={styles.muted}>Loading…</Text>
        ) : error ? null : (data?.activity.length ?? 0) === 0 ? (
          <GlassCard>
            <Text style={styles.muted}>No activity yet</Text>
          </GlassCard>
        ) : (
          <GlassCard>
            {data!.activity.map((a) => (
              <View key={a.id} style={styles.activityRow}>
                <Text style={styles.activityText} numberOfLines={2}>
                  <Text style={styles.actor}>{a.actor}</Text>
                  {' moved '}
                  <Text style={styles.actor}>{a.taskTitle}</Text>
                  {a.fromStage ? ` from ${a.fromStage}` : ''}
                  {` → ${a.toStage}`}
                </Text>
                <Text style={styles.meta}>{relativeTime(a.movedAt)}</Text>
              </View>
            ))}
          </GlassCard>
        )}
      </ScrollView>

      <PickerSheet
        visible={pickerOpen}
        title="Department"
        selected={deptId ?? 'all'}
        options={[
          { value: 'all', label: 'All Departments' },
          ...(data?.departments ?? []).map((d) => ({ value: d.id, label: d.name })),
        ]}
        onSelect={(v) => {
          setDeptId(v === 'all' ? null : v);
          setPickerOpen(false);
        }}
        onClose={() => setPickerOpen(false)}
      />
    </Screen>
  );
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <GlassCard style={styles.tile}>
      <Text style={styles.tileValue}>{value}</Text>
      <Text style={styles.tileLabel}>{label}</Text>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 20, gap: 12, paddingBottom: 120 },
  filterButton: { color: '#fff', fontSize: 14, fontWeight: '600' },
  tiles: { gap: 12 },
  tile: { paddingVertical: 18 },
  tileValue: { color: '#fff', fontSize: 28, fontWeight: '700', letterSpacing: -1 },
  tileLabel: { color: theme.text.dim, fontSize: 12, marginTop: 4 },
  sectionTitle: { color: '#fff', fontSize: 15, fontWeight: '600', marginTop: 12 },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowTitle: { color: '#fff', fontSize: 15, fontWeight: '600', flex: 1 },
  activityRow: {
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
  },
  activityText: { color: theme.colors.foreground, fontSize: 13 },
  actor: { fontWeight: '600', color: '#fff' },
  meta: { color: theme.text.dimmer, fontSize: 11, marginTop: 2 },
  muted: { color: theme.text.dim, fontSize: 13 },
  error: { color: '#f87171', fontSize: 13 },
});

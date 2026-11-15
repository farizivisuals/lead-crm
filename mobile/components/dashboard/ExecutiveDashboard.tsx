/**
 * Direction contract (2026-08 redesign, user-approved).
 * THESIS: a pocket ops instrument — color is state information, never decoration;
 * refuses the all-gray glass look it replaces.
 * OWN-WORLD: black-and-silver — near-black ground, quiet glass cards, silver
 * accent for everything interactive (dark ink on silver fills), fixed semantic
 * map (emerald/amber/red/sky/violet) for status.
 * STORY: an exec opens the app, sees the agency's pulse in four tiles, and is
 * pulled straight to what's overdue or waiting on review.
 * FIRST VIEWPORT: title + dept filter chip, 2×2 KPI grid with tinted icons,
 * "Needs attention" (overdue) leading the scroll.
 * FORM: Operate canon (Linear/Vercel bar) played straight; see mobile/DESIGN.md.
 */
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { DELIVERABLE_STATUS_LABELS, PROJECT_STATUS_LABELS, PRIORITY_LABELS } from '@shared/rbac';
import { Screen } from '../ui/Screen';
import { GlassCard } from '../ui/GlassCard';
import { Badge } from '../ui/Badge';
import { ScreenHeader } from '../ui/ScreenHeader';
import { PickerSheet } from '../ui/PickerSheet';
import { one, relativeTime, shortDate } from '../../lib/data';
import { useExecutiveDashboard } from '../../lib/queries/dashboard';
import {
  DELIVERABLE_STATUS_COLORS,
  PRIORITY_COLORS,
  PROJECT_STATUS_COLORS,
  theme,
  withAlpha,
} from '../../lib/theme';

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

  const overdue = data?.overdueTasks ?? [];
  const inReview = data?.reviewDeliverables ?? [];
  const hasOverdue = (data?.overdueCount ?? 0) > 0;

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.scroll}>
        <ScreenHeader
          title="Dashboard"
          subtitle={new Date().toLocaleDateString(undefined, {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
          })}
          search
          right={
            <Pressable onPress={() => setPickerOpen(true)} hitSlop={10} style={styles.filterChip}>
              <Text style={styles.filterText} numberOfLines={1}>
                {deptName}
              </Text>
              <SymbolView name="chevron.down" tintColor={theme.colors.accent} size={11} />
            </Pressable>
          }
        />

        {error && <Text style={styles.error}>{error.message}</Text>}

        <View style={styles.tiles}>
          <Tile
            icon="building.2"
            color={theme.colors.info}
            label={filtered ? 'Dept Clients' : 'Clients'}
            value={isLoading ? '—' : String(data?.clientCount ?? 0)}
            onPress={() => router.push('/clients')}
          />
          <Tile
            icon="folder"
            color={theme.colors.accent}
            label={filtered ? 'Dept Projects' : 'Projects'}
            value={isLoading ? '—' : String(data?.projectCount ?? 0)}
            onPress={() => router.push('/projects')}
          />
          <Tile
            icon="checklist"
            color={theme.colors.review}
            label="Open Tasks"
            value={isLoading ? '—' : String(data?.openTaskCount ?? 0)}
            onPress={() => router.push('/tasks')}
          />
          <Tile
            icon={hasOverdue ? 'exclamationmark.triangle' : 'checkmark.circle'}
            color={hasOverdue ? theme.colors.danger : theme.colors.success}
            label="Overdue"
            value={isLoading ? '—' : String(data?.overdueCount ?? 0)}
            onPress={() => router.push('/tasks')}
          />
        </View>

        {overdue.length > 0 && (
          <>
            <SectionTitle title="Needs attention" tint={theme.colors.danger} />
            <GlassCard style={styles.listCard}>
              {overdue.map((t, i) => (
                <Pressable
                  key={t.id}
                  onPress={() =>
                    router.push({
                      pathname: '/projects/[projectId]/tasks/[taskId]',
                      params: { projectId: t.project_id, taskId: t.id },
                    })
                  }
                  style={[styles.listRow, i === overdue.length - 1 && styles.listRowLast]}
                >
                  <View style={styles.flex}>
                    <Text style={styles.rowTitle} numberOfLines={1}>
                      {t.title}
                    </Text>
                    <Text style={styles.subtitle} numberOfLines={1}>
                      {one(t.projects)?.name ?? '—'}
                      {' · '}
                      <Text style={styles.overdueDate}>due {shortDate(t.due_date)}</Text>
                    </Text>
                  </View>
                  <Badge label={PRIORITY_LABELS[t.priority]} color={PRIORITY_COLORS[t.priority]} />
                </Pressable>
              ))}
            </GlassCard>
          </>
        )}

        {inReview.length > 0 && (
          <>
            <SectionTitle title="In review" tint={theme.colors.review} />
            <GlassCard style={styles.listCard}>
              {inReview.map((d, i) => (
                <Pressable
                  key={d.id}
                  onPress={() =>
                    router.push({
                      pathname: '/projects/[projectId]/deliverables/[deliverableId]',
                      params: { projectId: d.project_id, deliverableId: d.id },
                    })
                  }
                  style={[styles.listRow, i === inReview.length - 1 && styles.listRowLast]}
                >
                  <View style={styles.flex}>
                    <Text style={styles.rowTitle} numberOfLines={1}>
                      {d.title}
                    </Text>
                    <Text style={styles.subtitle} numberOfLines={1}>
                      {one(d.projects)?.name ?? '—'} · {relativeTime(d.updated_at)}
                    </Text>
                  </View>
                  <Badge
                    label={DELIVERABLE_STATUS_LABELS[d.status]}
                    color={DELIVERABLE_STATUS_COLORS[d.status]}
                  />
                </Pressable>
              ))}
            </GlassCard>
          </>
        )}

        <SectionTitle title="Recent projects" />
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
                  <Badge
                    label={PROJECT_STATUS_LABELS[p.status]}
                    color={PROJECT_STATUS_COLORS[p.status]}
                  />
                </View>
                <Text style={styles.subtitle}>{one(p.clients)?.company_name ?? '—'}</Text>
              </GlassCard>
            </Pressable>
          ))
        )}

        <SectionTitle title="Activity" />
        {isLoading ? (
          <Text style={styles.muted}>Loading…</Text>
        ) : error ? null : (data?.activity.length ?? 0) === 0 ? (
          <GlassCard>
            <Text style={styles.muted}>No activity yet</Text>
          </GlassCard>
        ) : (
          <GlassCard>
            {data!.activity.map((a, i) => (
              <View
                key={a.id}
                style={[styles.activityRow, i === data!.activity.length - 1 && styles.listRowLast]}
              >
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

function SectionTitle({ title, tint }: { title: string; tint?: string }) {
  return <Text style={[styles.sectionTitle, tint ? { color: tint } : null]}>{title}</Text>;
}

function Tile({
  icon,
  color,
  label,
  value,
  onPress,
}: {
  icon: string;
  color: string;
  label: string;
  value: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.tileWrap, pressed && styles.tilePressed]}>
      <GlassCard style={styles.tile}>
        <View style={[styles.tileIcon, { backgroundColor: withAlpha(color, 0.15) }]}>
          <SymbolView name={icon as any} tintColor={color} size={16} />
        </View>
        <Text style={styles.tileValue}>{value}</Text>
        <Text style={styles.tileLabel}>{label}</Text>
      </GlassCard>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 20, gap: 12, paddingBottom: 120 },
  flex: { flex: 1 },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    maxWidth: 180,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: withAlpha(theme.colors.accentSolid, 0.15),
    borderWidth: 1,
    borderColor: withAlpha(theme.colors.accentSolid, 0.3),
  },
  filterText: { color: theme.colors.accent, fontSize: 13, fontWeight: '600', flexShrink: 1 },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  tileWrap: { flexBasis: '47%', flexGrow: 1 },
  tilePressed: { opacity: 0.8 },
  tile: { paddingVertical: 14 },
  tileIcon: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  tileValue: {
    color: '#fff',
    fontSize: 26,
    fontWeight: '700',
    letterSpacing: -1,
    fontVariant: ['tabular-nums'],
  },
  tileLabel: { color: theme.text.label, fontSize: 12, marginTop: 2 },
  sectionTitle: { color: '#fff', fontSize: 15, fontWeight: '600', marginTop: 12 },
  listCard: { paddingVertical: 4 },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
  },
  listRowLast: { borderBottomWidth: 0 },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowTitle: { color: '#fff', fontSize: 15, fontWeight: '600', flex: 1 },
  subtitle: { color: theme.text.label, fontSize: 12, marginTop: 3 },
  overdueDate: { color: theme.colors.danger, fontWeight: '600' },
  activityRow: {
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
  },
  activityText: { color: theme.colors.foreground, fontSize: 13 },
  actor: { fontWeight: '600', color: '#fff' },
  meta: { color: theme.text.dim, fontSize: 11, marginTop: 2 },
  muted: { color: theme.text.label, fontSize: 13 },
  error: { color: theme.colors.danger, fontSize: 13 },
});

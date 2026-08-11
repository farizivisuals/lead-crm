import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { isExecutive, PROJECT_STATUS_LABELS, DEPT_COLORS } from '@shared/rbac';
import { Screen } from '../../../components/ui/Screen';
import { GlassCard } from '../../../components/ui/GlassCard';
import { Badge } from '../../../components/ui/Badge';
import { ScreenHeader } from '../../../components/ui/ScreenHeader';
import { useAuth } from '../../../lib/auth';
import { one, shortDate } from '../../../lib/data';
import { useProjectsList, type ProjectListRow } from '../../../lib/queries/projects';
import { theme } from '../../../lib/theme';

export default function ProjectsScreen() {
  const router = useRouter();
  const { employee } = useAuth();
  const canManage = isExecutive(employee?.role ?? 'employee');
  const { data, isLoading, error } = useProjectsList();

  function openProject(projectId: string) {
    router.push({ pathname: '/projects/[projectId]', params: { projectId } });
  }

  return (
    <Screen>
      <FlatList
        contentContainerStyle={styles.list}
        data={data?.projects ?? []}
        keyExtractor={(p) => p.id}
        ListHeaderComponent={
          <ScreenHeader
            title="Projects"
            right={
              canManage ? (
                <Pressable onPress={() => router.push('/projects/new')} hitSlop={10}>
                  <Text style={styles.newButton}>New</Text>
                </Pressable>
              ) : undefined
            }
          />
        }
        ListEmptyComponent={
          isLoading ? (
            <Text style={styles.muted}>Loading…</Text>
          ) : error ? (
            <Text style={styles.error}>{error.message}</Text>
          ) : (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>No projects yet</Text>
              <Text style={styles.muted}>Projects you can see will appear here.</Text>
            </View>
          )
        }
        renderItem={({ item }) => (
          <ProjectCard
            project={item}
            progress={data?.progress[item.id]}
            onPress={() => openProject(item.id)}
          />
        )}
      />
    </Screen>
  );
}

function ProjectCard({
  project,
  progress,
  onPress,
}: {
  project: ProjectListRow;
  progress?: { total: number; done: number };
  onPress: () => void;
}) {
  const client = one(project.clients)?.company_name ?? '—';
  const depts = (project.project_departments ?? [])
    .map((pd) => one(pd.departments))
    .filter((d): d is { name: string; slug: string } => !!d);
  const pct = progress && progress.total > 0
    ? Math.round((progress.done / progress.total) * 100)
    : 0;

  return (
    <Pressable onPress={onPress}>
      <GlassCard>
        <View style={styles.cardTop}>
          <Text style={styles.cardTitle} numberOfLines={1}>
            {project.name}
          </Text>
          <Badge label={PROJECT_STATUS_LABELS[project.status]} />
        </View>
        <Text style={styles.client}>{client}</Text>
        {project.description ? (
          <Text style={styles.description} numberOfLines={1}>
            {project.description}
          </Text>
        ) : null}

        <View style={styles.chips}>
          {depts.map((d) => (
            <Badge key={d.slug} label={d.name} color={DEPT_COLORS[d.slug]} />
          ))}
          <Text style={styles.due}>Due {shortDate(project.target_end_date)}</Text>
        </View>

        {progress && progress.total > 0 ? (
          <View style={styles.progressWrap}>
            <View style={styles.track}>
              <View style={[styles.fill, { width: `${pct}%` }]} />
            </View>
            <Text style={styles.progressText}>
              {progress.done} / {progress.total} tasks done
            </Text>
          </View>
        ) : null}
      </GlassCard>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  list: { padding: 20, gap: 12, paddingBottom: 120 },
  newButton: { color: '#fff', fontSize: 15, fontWeight: '600' },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardTitle: { color: '#fff', fontSize: 16, fontWeight: '600', flex: 1 },
  client: { color: theme.text.label, fontSize: 13, marginTop: 4 },
  description: { color: theme.text.dim, fontSize: 13, marginTop: 6 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6, marginTop: 10 },
  due: { color: theme.text.dimmer, fontSize: 12 },
  progressWrap: { marginTop: 12, gap: 6 },
  track: { height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.08)' },
  fill: { height: 4, borderRadius: 2, backgroundColor: '#fafafa' },
  progressText: { color: theme.text.dimmer, fontSize: 11 },
  empty: { alignItems: 'center', gap: 6, paddingVertical: 60 },
  emptyTitle: { color: '#fff', fontSize: 16, fontWeight: '600' },
  muted: { color: theme.text.dim, fontSize: 13, textAlign: 'center' },
  error: { color: '#f87171', fontSize: 13, textAlign: 'center', paddingVertical: 40 },
});

import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Screen } from '../../../../components/ui/Screen';
import { GlassCard } from '../../../../components/ui/GlassCard';
import { ScreenHeader } from '../../../../components/ui/ScreenHeader';
import { relativeTime } from '../../../../lib/data';
import { useProjectActivity, type StageChange } from '../../../../lib/queries/activity';
import { theme } from '../../../../lib/theme';

export default function ActivityScreen() {
  const { projectId } = useLocalSearchParams<{ projectId: string }>();
  const router = useRouter();
  const { data, isLoading, error } = useProjectActivity(projectId);

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.scroll}>
        <ScreenHeader title="Activity" onBack={() => router.back()} />

        {error && <Text style={styles.error}>{error.message}</Text>}

        {isLoading ? (
          <Text style={styles.muted}>Loading…</Text>
        ) : error ? null : (data?.length ?? 0) === 0 ? (
          <GlassCard>
            <Text style={styles.muted}>No stage changes yet</Text>
          </GlassCard>
        ) : (
          <GlassCard>
            {data!.map((change) => (
              <StageChangeRowView key={change.id} change={change} />
            ))}
          </GlassCard>
        )}
      </ScrollView>
    </Screen>
  );
}

function StageChangeRowView({ change }: { change: StageChange }) {
  return (
    <View style={styles.row}>
      <Text style={styles.sentence}>
        <Text style={styles.strong}>{change.actor}</Text>
        {' moved '}
        <Text style={styles.strong}>{change.taskTitle}</Text>
        {change.fromStage ? (
          <>
            {' from '}
            <Text style={styles.stage}>{change.fromStage}</Text>
          </>
        ) : null}
        {' → '}
        <Text style={styles.toStage}>{change.toStage}</Text>
      </Text>
      <Text style={styles.meta}>{relativeTime(change.movedAt)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 20, gap: 12, paddingBottom: 140 },
  row: {
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
  },
  sentence: { color: theme.colors.foreground, fontSize: 13, lineHeight: 19 },
  strong: { fontWeight: '600', color: '#fff' },
  stage: { color: theme.text.dim },
  toStage: { color: '#a78bfa' },
  meta: { color: theme.text.dimmer, fontSize: 11, marginTop: 2 },
  muted: { color: theme.text.dim, fontSize: 13 },
  error: { color: '#f87171', fontSize: 13 },
});

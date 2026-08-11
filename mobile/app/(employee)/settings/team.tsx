import { FlatList, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ROLE_LABELS } from '@shared/rbac';
import { Screen } from '../../../components/ui/Screen';
import { GlassCard } from '../../../components/ui/GlassCard';
import { Badge } from '../../../components/ui/Badge';
import { ScreenHeader } from '../../../components/ui/ScreenHeader';
import { one } from '../../../lib/data';
import { useTeam, departmentNames, type TeamMember } from '../../../lib/queries/settings';
import { theme } from '../../../lib/theme';

export default function TeamScreen() {
  const router = useRouter();
  const { data, isLoading, error } = useTeam();

  return (
    <Screen>
      <FlatList
        contentContainerStyle={styles.list}
        data={data?.members ?? []}
        keyExtractor={(m) => m.profile_id}
        ListHeaderComponent={
          <ScreenHeader
            title="Team"
            subtitle={
              data ? `${data.members.length} across all departments` : undefined
            }
            onBack={() => router.back()}
          />
        }
        ListEmptyComponent={
          isLoading ? (
            <Text style={styles.muted}>Loading…</Text>
          ) : error ? (
            <Text style={styles.error}>{error.message}</Text>
          ) : (
            <Text style={styles.muted}>No team members</Text>
          )
        }
        renderItem={({ item }) => (
          <MemberCard member={item} departments={data?.departments ?? []} />
        )}
        ListFooterComponent={
          data ? (
            <Text style={styles.footer}>
              Employees are added and edited from the web app.
            </Text>
          ) : null
        }
      />
    </Screen>
  );
}

function MemberCard({
  member,
  departments,
}: {
  member: TeamMember;
  departments: { id: string; name: string }[];
}) {
  const name = one(member.profiles)?.full_name ?? 'Unknown';
  const depts = departmentNames(member, departments);

  return (
    <GlassCard>
      <View style={styles.rowTop}>
        <Text style={styles.name} numberOfLines={1}>
          {name}
        </Text>
        <Badge label={ROLE_LABELS[member.role]} />
      </View>
      <Text style={styles.depts}>{depts.length > 0 ? depts.join(' · ') : 'No departments'}</Text>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  list: { padding: 20, gap: 12, paddingBottom: 140 },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { color: '#fff', fontSize: 15, fontWeight: '600', flex: 1 },
  depts: { color: theme.text.dim, fontSize: 12, marginTop: 6 },
  footer: { color: theme.text.dimmer, fontSize: 12, textAlign: 'center', marginTop: 8 },
  muted: { color: theme.text.dim, fontSize: 13, textAlign: 'center', paddingVertical: 24 },
  error: { color: theme.colors.danger, fontSize: 13, textAlign: 'center', paddingVertical: 40 },
});

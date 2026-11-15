import { useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { isExecutive, ROLE_LABELS } from '@shared/rbac';
import { Screen } from '../../../components/ui/Screen';
import { GlassCard } from '../../../components/ui/GlassCard';
import { Badge } from '../../../components/ui/Badge';
import { ScreenHeader } from '../../../components/ui/ScreenHeader';
import { PickerSheet } from '../../../components/ui/PickerSheet';
import { useAuth } from '../../../lib/auth';
import { one } from '../../../lib/data';
import { qk } from '../../../lib/queries/keys';
import { deleteEmployee, useTeam, departmentNames, type TeamMember } from '../../../lib/queries/settings';
import { theme } from '../../../lib/theme';

const nameOf = (m: TeamMember) => one(m.profiles)?.full_name ?? 'Unknown';

export default function TeamScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { session, employee } = useAuth();
  const canDelete = isExecutive(employee?.role ?? 'employee');
  const { data, isLoading, error } = useTeam();
  // The person being deleted while the "who takes over" sheet is open.
  const [leaving, setLeaving] = useState<TeamMember | null>(null);

  const remove = useMutation({
    mutationFn: ({ id, to }: { id: string; to: string }) => deleteEmployee(id, to),
    onSuccess: () => {
      // Their work moved to someone else, so every list that shows assignees is stale.
      queryClient.invalidateQueries();
    },
    onError: (e: Error) => Alert.alert('Could not delete', e.message),
  });

  function startDelete(member: TeamMember) {
    Alert.alert(nameOf(member), undefined, [
      { text: 'Cancel', style: 'cancel' },
      { text: `Delete ${nameOf(member).split(' ')[0]}…`, style: 'destructive', onPress: () => setLeaving(member) },
    ]);
  }

  function handOver(toId: string) {
    const member = leaving!;
    const to = data?.members.find((m) => m.profile_id === toId);
    setLeaving(null);
    if (!to) return;
    // iOS drops an alert raised while a sheet is still sliding away.
    setTimeout(() => Alert.alert(
      `Delete ${nameOf(member)}?`,
      `Their open tasks, videos and projects go to ${nameOf(to)}. Finished work keeps its history. Their login is removed for good.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => remove.mutate({ id: member.profile_id, to: toId }) },
      ]
    ), 400);
  }

  const others = (data?.members ?? [])
    .filter((m) => m.profile_id !== leaving?.profile_id)
    .map((m) => ({ value: m.profile_id, label: nameOf(m), sublabel: ROLE_LABELS[m.role] }))
    .sort((a, b) => a.label.localeCompare(b.label));

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
        renderItem={({ item }) => {
          const card = <MemberCard member={item} departments={data?.departments ?? []} />;
          return canDelete && item.profile_id !== session?.user.id ? (
            <Pressable onPress={() => startDelete(item)} disabled={remove.isPending}>
              {card}
            </Pressable>
          ) : (
            card
          );
        }}
        ListFooterComponent={
          data ? (
            <Text style={styles.footer}>
              {canDelete
                ? 'Tap someone to delete them. Employees are added and edited from the web app.'
                : 'Employees are added and edited from the web app.'}
            </Text>
          ) : null
        }
      />
      <PickerSheet
        visible={!!leaving}
        title={leaving ? `Who takes over ${nameOf(leaving).split(' ')[0]}'s work?` : ''}
        options={others}
        searchable
        onSelect={handOver}
        onClose={() => setLeaving(null)}
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
  const depts = departmentNames(member, departments);

  return (
    <GlassCard>
      <View style={styles.rowTop}>
        <Text style={styles.name} numberOfLines={1}>
          {nameOf(member)}
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

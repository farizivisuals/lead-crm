import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { isExecutive } from '@shared/rbac';
import { Screen } from '../../../components/ui/Screen';
import { GlassCard } from '../../../components/ui/GlassCard';
import { ScreenHeader } from '../../../components/ui/ScreenHeader';
import { useAuth } from '../../../lib/auth';
import { one, shortDate } from '../../../lib/data';
import { useClients, type ClientRow } from '../../../lib/queries/clients';
import { theme } from '../../../lib/theme';

export default function ClientsScreen() {
  const router = useRouter();
  const { employee } = useAuth();
  // The web gates its whole /admin/clients subtree behind requireExecutive().
  // Mirrored here — though note RLS on `quotes` itself only checks that the
  // caller is an employee, so this gate is cosmetic like every other one.
  const canView = isExecutive(employee?.role ?? 'employee');

  const { data, isLoading, error } = useClients();

  if (!canView) {
    return (
      <Screen>
        <View style={styles.centered}>
          <Text style={styles.muted}>Clients are available to executives.</Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <FlatList
        contentContainerStyle={styles.list}
        data={data ?? []}
        keyExtractor={(c) => c.id}
        ListHeaderComponent={<ScreenHeader title="Clients" onBack={() => router.back()} />}
        ListEmptyComponent={
          isLoading ? (
            <Text style={styles.muted}>Loading…</Text>
          ) : error ? (
            <Text style={styles.error}>{error.message}</Text>
          ) : (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>No clients</Text>
              <Text style={styles.muted}>Clients are created from the web app.</Text>
            </View>
          )
        }
        renderItem={({ item }) => (
          <ClientCard
            client={item}
            onPress={() =>
              router.push({ pathname: '/clients/[clientId]', params: { clientId: item.id } })
            }
          />
        )}
      />
    </Screen>
  );
}

function ClientCard({ client, onPress }: { client: ClientRow; onPress: () => void }) {
  const contact = one(client.profiles)?.full_name;

  return (
    <Pressable onPress={onPress}>
      <GlassCard>
        <Text style={styles.title} numberOfLines={1}>
          {client.company_name}
        </Text>
        {contact ? <Text style={styles.subtitle}>{contact}</Text> : null}
        <View style={styles.metaRow}>
          {client.phone ? <Text style={styles.meta}>{client.phone}</Text> : null}
          <Text style={styles.meta}>Since {shortDate(client.created_at)}</Text>
        </View>
      </GlassCard>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  list: { padding: 20, gap: 12, paddingBottom: 140 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  title: { color: '#fff', fontSize: 16, fontWeight: '600' },
  subtitle: { color: theme.text.dim, fontSize: 13, marginTop: 4 },
  metaRow: { flexDirection: 'row', gap: 16, marginTop: 8 },
  meta: { color: theme.text.dimmer, fontSize: 12 },
  empty: { alignItems: 'center', paddingVertical: 60, gap: 4 },
  emptyTitle: { color: '#fff', fontSize: 16, fontWeight: '600' },
  muted: { color: theme.text.dim, fontSize: 13, textAlign: 'center' },
  error: { color: theme.colors.danger, fontSize: 13, textAlign: 'center', paddingVertical: 40 },
});

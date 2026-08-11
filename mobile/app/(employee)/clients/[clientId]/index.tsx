import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { PROJECT_STATUS_LABELS } from '@shared/rbac';
import { Screen } from '../../../../components/ui/Screen';
import { GlassCard } from '../../../../components/ui/GlassCard';
import { Badge } from '../../../../components/ui/Badge';
import { ScreenHeader } from '../../../../components/ui/ScreenHeader';
import { one, shortDate } from '../../../../lib/data';
import { qk } from '../../../../lib/queries/keys';
import { useClientDetail, type QuoteRow } from '../../../../lib/queries/clients';
import { deleteQuote, formatKD, quoteTotal } from '../../../../lib/queries/quotes';
import { theme } from '../../../../lib/theme';

export default function ClientDetailScreen() {
  const { clientId } = useLocalSearchParams<{ clientId: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useClientDetail(clientId);

  const removeQuote = useMutation({
    mutationFn: deleteQuote,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.client(clientId) });
    },
    onError: (e: Error) => Alert.alert('Could not delete quote', e.message),
  });

  function confirmDelete(quote: QuoteRow) {
    if (removeQuote.isPending) return;
    Alert.alert('Delete quote', `Delete ${quote.quote_number}? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => removeQuote.mutate(quote.id) },
    ]);
  }

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
          <Text style={styles.error}>{error?.message ?? 'Client not found'}</Text>
        </View>
      </Screen>
    );
  }

  const { client, projects, quotes } = data;
  const contact = one(client.profiles)?.full_name;

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.scroll}>
        <ScreenHeader
          title={client.company_name}
          subtitle={contact ?? undefined}
          onBack={() => router.back()}
          right={
            <Pressable
              onPress={() =>
                router.push({ pathname: '/clients/[clientId]/quotes/new', params: { clientId } })
              }
              hitSlop={10}
            >
              <Text style={styles.newButton}>New quote</Text>
            </Pressable>
          }
        />

        {client.phone || client.notes ? (
          <GlassCard>
            {client.phone ? <Text style={styles.value}>{client.phone}</Text> : null}
            {client.notes ? <Text style={styles.notes}>{client.notes}</Text> : null}
          </GlassCard>
        ) : null}

        <Text style={styles.sectionTitle}>Quotes</Text>
        {quotes.length === 0 ? (
          <GlassCard>
            <Text style={styles.muted}>No quotes yet</Text>
          </GlassCard>
        ) : (
          quotes.map((quote) => (
            <Pressable
              key={quote.id}
              onPress={() =>
                router.push({
                  pathname: '/clients/[clientId]/quotes/[quoteId]',
                  params: { clientId, quoteId: quote.id },
                })
              }
              onLongPress={() => confirmDelete(quote)}
            >
              <GlassCard>
                <View style={styles.rowTop}>
                  <Text style={styles.title} numberOfLines={1}>
                    {quote.title}
                  </Text>
                  <Badge label={quote.status} />
                </View>
                <Text style={styles.meta}>
                  {quote.quote_number} · {shortDate(quote.created_at)}
                  {quote.valid_until ? ` · valid to ${shortDate(quote.valid_until)}` : ''}
                </Text>
                <Text style={styles.total}>{formatKD(quoteTotal(quote.quote_line_items ?? []))}</Text>
                <Text style={styles.hint}>Long-press to delete</Text>
              </GlassCard>
            </Pressable>
          ))
        )}

        <Text style={styles.sectionTitle}>Projects</Text>
        {projects.length === 0 ? (
          <GlassCard>
            <Text style={styles.muted}>No projects yet</Text>
          </GlassCard>
        ) : (
          projects.map((project) => (
            <Pressable
              key={project.id}
              onPress={() =>
                router.push({
                  pathname: '/projects/[projectId]',
                  params: { projectId: project.id },
                })
              }
            >
              <GlassCard>
                <View style={styles.rowTop}>
                  <Text style={styles.title} numberOfLines={1}>
                    {project.name}
                  </Text>
                  <Badge label={PROJECT_STATUS_LABELS[project.status]} />
                </View>
                <Text style={styles.meta}>
                  {project.target_end_date ? `Due ${shortDate(project.target_end_date)}` : 'Due —'}
                </Text>
              </GlassCard>
            </Pressable>
          ))
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 20, gap: 12, paddingBottom: 140 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  newButton: { color: '#fff', fontSize: 15, fontWeight: '600' },
  sectionTitle: { color: '#fff', fontSize: 15, fontWeight: '600', marginTop: 12 },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { color: '#fff', fontSize: 15, fontWeight: '600', flex: 1 },
  value: { color: '#fff', fontSize: 15 },
  notes: { color: theme.text.dim, fontSize: 13, marginTop: 6 },
  meta: { color: theme.text.dim, fontSize: 12, marginTop: 6 },
  total: { color: '#fff', fontSize: 17, fontWeight: '700', marginTop: 8, letterSpacing: -0.3 },
  hint: { color: theme.text.dimmer, fontSize: 11, marginTop: 6 },
  muted: { color: theme.text.dim, fontSize: 13 },
  error: { color: '#f87171', fontSize: 13, textAlign: 'center' },
});

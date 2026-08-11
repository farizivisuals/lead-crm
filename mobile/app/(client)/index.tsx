import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { PROJECT_STATUS_LABELS } from '@shared/rbac';
import { Screen } from '../../components/ui/Screen';
import { GlassCard } from '../../components/ui/GlassCard';
import { Badge } from '../../components/ui/Badge';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { useAuth } from '../../lib/auth';
import { one, shortDate } from '../../lib/data';
import { useClientId, usePortalHome, type PortalQuote } from '../../lib/queries/portal';
import { formatKD, quoteTotal } from '../../lib/queries/quotes';
import { theme } from '../../lib/theme';

export default function ClientProjects() {
  const router = useRouter();
  const { session } = useAuth();
  const context = useClientId(session?.user.id);
  const home = usePortalHome(context.data?.clientId);

  const projects = home.data?.projects ?? [];
  const quotes = home.data?.quotes ?? [];

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.scroll}>
        <ScreenHeader title="Projects" subtitle={context.data?.companyName} />

        {context.error ? <Text style={styles.error}>{context.error.message}</Text> : null}
        {home.error ? <Text style={styles.error}>{home.error.message}</Text> : null}

        {context.isLoading || home.isLoading ? (
          <Text style={styles.muted}>Loading…</Text>
        ) : context.data === null ? (
          // A client profile with no client_contacts row can see nothing. The
          // web redirects to /login, which on mobile would bounce a signed-in
          // user out for a data problem they cannot fix.
          <GlassCard>
            <Text style={styles.emptyTitle}>Account not linked</Text>
            <Text style={styles.muted}>
              This account is not connected to a client yet. Ask your agency contact to finish
              setting it up.
            </Text>
          </GlassCard>
        ) : context.error || home.error ? null : (
          <>
            {projects.length === 0 ? (
              <GlassCard>
                <Text style={styles.muted}>No projects yet</Text>
              </GlassCard>
            ) : (
              projects.map((project) => {
                const depts = (project.project_departments ?? [])
                  .map((pd) => one(pd.departments))
                  .filter((d): d is { name: string; slug: string } => !!d);
                return (
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
                        <Text style={styles.title} numberOfLines={2}>
                          {project.name}
                        </Text>
                        <Badge label={PROJECT_STATUS_LABELS[project.status]} />
                      </View>
                      <Text style={styles.meta}>
                        {depts.map((d) => d.name).join(' · ') || 'No departments'}
                      </Text>
                      {project.target_end_date ? (
                        <Text style={styles.meta}>Due {shortDate(project.target_end_date)}</Text>
                      ) : null}
                    </GlassCard>
                  </Pressable>
                );
              })
            )}

            {quotes.length > 0 && (
              <>
                <Text style={styles.sectionTitle}>Quotes</Text>
                {quotes.map((quote) => (
                  <QuoteCard key={quote.id} quote={quote} />
                ))}
              </>
            )}
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

function QuoteCard({ quote }: { quote: PortalQuote }) {
  const total = quoteTotal(quote.quote_line_items ?? []);
  return (
    <GlassCard>
      <View style={styles.rowTop}>
        <Text style={styles.title} numberOfLines={1}>
          {quote.title}
        </Text>
        <Badge label={quote.status} />
      </View>
      <Text style={styles.meta}>{quote.quote_number}</Text>
      <Text style={styles.total}>{formatKD(total)}</Text>
      {quote.valid_until ? (
        <Text style={styles.meta}>Valid until {shortDate(quote.valid_until)}</Text>
      ) : null}
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 20, gap: 12, paddingBottom: 140 },
  rowTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  title: { color: '#fff', fontSize: 15, fontWeight: '600', flex: 1 },
  meta: { color: theme.text.dim, fontSize: 12, marginTop: 6 },
  total: { color: '#fff', fontSize: 17, fontWeight: '700', marginTop: 8 },
  sectionTitle: { color: '#fff', fontSize: 15, fontWeight: '600', marginTop: 12 },
  emptyTitle: { color: '#fff', fontSize: 15, fontWeight: '600', marginBottom: 6 },
  muted: { color: theme.text.dim, fontSize: 13 },
  error: { color: '#f87171', fontSize: 13 },
});

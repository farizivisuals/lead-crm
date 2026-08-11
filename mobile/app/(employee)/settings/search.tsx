import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen } from '../../../components/ui/Screen';
import { GlassCard } from '../../../components/ui/GlassCard';
import { ScreenHeader } from '../../../components/ui/ScreenHeader';
import {
  useSearch,
  groupByType,
  TYPE_LABELS,
  MIN_QUERY,
  type SearchResult,
} from '../../../lib/queries/search';
import { theme } from '../../../lib/theme';

export default function SearchScreen() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const trimmed = query.trim();

  const { data, isFetching, error } = useSearch(query);
  const groups = groupByType(data ?? []);

  function open(result: SearchResult) {
    if (result.type === 'client') {
      router.push({ pathname: '/clients/[clientId]', params: { clientId: result.id } });
      return;
    }
    if (!result.projectId) return;
    // Tasks and deliverables both land on the project that owns them — the
    // board and the deliverables list are one tap further.
    router.push({ pathname: '/projects/[projectId]', params: { projectId: result.projectId } });
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <ScreenHeader title="Search" onBack={() => router.back()} />

        <GlassCard>
          <TextInput
            style={styles.input}
            value={query}
            onChangeText={setQuery}
            placeholder="Clients, projects, tasks, deliverables"
            placeholderTextColor={theme.text.dimmer}
            autoFocus
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
          />
        </GlassCard>

        {error ? <Text style={styles.error}>{error.message}</Text> : null}

        {trimmed.length < MIN_QUERY ? (
          <Text style={styles.muted}>Type at least {MIN_QUERY} characters.</Text>
        ) : isFetching && groups.length === 0 ? (
          <Text style={styles.muted}>Searching…</Text>
        ) : groups.length === 0 ? (
          <Text style={styles.muted}>Nothing matches “{trimmed}”.</Text>
        ) : (
          groups.map((group) => (
            <View key={group.type} style={styles.group}>
              <Text style={styles.groupTitle}>{TYPE_LABELS[group.type]}</Text>
              {group.items.map((item) => (
                <Pressable key={`${item.type}-${item.id}`} onPress={() => open(item)}>
                  <GlassCard>
                    <Text style={styles.title} numberOfLines={1}>
                      {item.title}
                    </Text>
                    {item.subtitle ? (
                      <Text style={styles.subtitle} numberOfLines={1}>
                        {item.subtitle}
                      </Text>
                    ) : null}
                  </GlassCard>
                </Pressable>
              ))}
            </View>
          ))
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 20, gap: 12, paddingBottom: 160 },
  input: { color: '#fff', fontSize: 16, paddingVertical: 4 },
  group: { gap: 8 },
  groupTitle: {
    fontSize: 11,
    fontWeight: '500',
    color: theme.text.label,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: 8,
  },
  title: { color: '#fff', fontSize: 15, fontWeight: '600' },
  subtitle: { color: theme.text.dim, fontSize: 12, marginTop: 4 },
  muted: { color: theme.text.dim, fontSize: 13, textAlign: 'center', paddingVertical: 24 },
  error: { color: theme.colors.danger, fontSize: 13 },
});

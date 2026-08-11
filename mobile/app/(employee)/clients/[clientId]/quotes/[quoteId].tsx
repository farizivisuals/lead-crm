import { Alert, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Screen } from '../../../../../components/ui/Screen';
import { QuoteForm, type QuoteFormValues } from '../../../../../components/quotes/QuoteForm';
import { qk } from '../../../../../lib/queries/keys';
import { useClientDetail } from '../../../../../lib/queries/clients';
import { updateQuote } from '../../../../../lib/queries/quotes';
import { theme } from '../../../../../lib/theme';

export default function EditQuoteScreen() {
  const { clientId, quoteId } = useLocalSearchParams<{ clientId: string; quoteId: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();

  // Seeds from the client detail query, which is warm because the user
  // arrived from that screen's quote list.
  const { data, isLoading, error } = useClientDetail(clientId);
  const quote = data?.quotes.find((q) => q.id === quoteId) ?? null;

  const mutation = useMutation({
    mutationFn: updateQuote,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.client(clientId) });
      router.back();
    },
    onError: (e: Error) => Alert.alert('Could not save quote', e.message),
  });

  if (isLoading) {
    return (
      <Screen>
        <View style={styles.centered}>
          <Text style={styles.muted}>Loading…</Text>
        </View>
      </Screen>
    );
  }
  if (error || !quote) {
    return (
      <Screen>
        <View style={styles.centered}>
          <Text style={styles.error}>{error?.message ?? 'Quote not found'}</Text>
        </View>
      </Screen>
    );
  }

  function submit(values: QuoteFormValues) {
    mutation.mutate({
      quoteId,
      title: values.title,
      valid_until: values.valid_until,
      notes: values.notes,
      items: values.items,
    });
  }

  const rows = [...(quote.quote_line_items ?? [])]
    .sort((a, b) => a.position - b.position)
    .map((item, i) => ({
      key: `existing-${i}`,
      description: item.description,
      quantity: String(item.quantity),
      unit_price: String(item.unit_price),
    }));

  return (
    <Screen>
      <QuoteForm
        heading={quote.quote_number}
        submitLabel="Save quote"
        initial={{
          title: quote.title,
          valid_until: quote.valid_until ?? '',
          notes: quote.notes ?? '',
          items: rows,
        }}
        pending={mutation.isPending}
        onBack={() => router.back()}
        onSubmit={submit}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  muted: { color: theme.text.dim, fontSize: 13 },
  error: { color: '#f87171', fontSize: 13, textAlign: 'center' },
});

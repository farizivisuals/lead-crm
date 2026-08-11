import { Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Screen } from '../../../../../components/ui/Screen';
import { QuoteForm, emptyRow, type QuoteFormValues } from '../../../../../components/quotes/QuoteForm';
import { useAuth } from '../../../../../lib/auth';
import { qk } from '../../../../../lib/queries/keys';
import { createQuote } from '../../../../../lib/queries/quotes';

export default function NewQuoteScreen() {
  const { clientId } = useLocalSearchParams<{ clientId: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { session } = useAuth();

  const mutation = useMutation({
    mutationFn: createQuote,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.client(clientId) });
      queryClient.invalidateQueries({ queryKey: qk.clients() });
      router.back();
    },
    onError: (e: Error) => Alert.alert('Could not create quote', e.message),
  });

  function submit(values: QuoteFormValues) {
    if (!session?.user.id) return;
    mutation.mutate({
      clientId,
      title: values.title,
      valid_until: values.valid_until,
      notes: values.notes,
      items: values.items,
      userId: session.user.id,
    });
  }

  return (
    <Screen>
      <QuoteForm
        heading="New quote"
        submitLabel="Create quote"
        initial={{ title: '', valid_until: '', notes: '', items: [emptyRow()] }}
        pending={mutation.isPending}
        onBack={() => router.back()}
        onSubmit={submit}
      />
    </Screen>
  );
}

import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { GlassCard } from '../ui/GlassCard';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { ScreenHeader } from '../ui/ScreenHeader';
import { draftTotal, formatKD, type DraftLineItem } from '../../lib/queries/quotes';
import { theme } from '../../lib/theme';

export type QuoteFormValues = {
  title: string;
  valid_until: string;
  notes: string;
  items: DraftLineItem[];
};

let rowSeq = 0;
/** Stable key per row so React does not remount inputs as rows are removed. */
export function emptyRow(): DraftLineItem {
  rowSeq += 1;
  return { key: `row-${rowSeq}`, description: '', quantity: '1', unit_price: '' };
}

export function QuoteForm({
  heading,
  submitLabel,
  initial,
  pending,
  error,
  onBack,
  onSubmit,
}: {
  heading: string;
  submitLabel: string;
  initial: QuoteFormValues;
  pending: boolean;
  error?: string | null;
  onBack: () => void;
  onSubmit: (values: QuoteFormValues) => void;
}) {
  const [title, setTitle] = useState(initial.title);
  const [validUntil, setValidUntil] = useState(initial.valid_until);
  const [notes, setNotes] = useState(initial.notes);
  const [items, setItems] = useState<DraftLineItem[]>(
    initial.items.length > 0 ? initial.items : [emptyRow()]
  );

  function patchRow(key: string, field: keyof DraftLineItem, value: string) {
    setItems((rows) => rows.map((r) => (r.key === key ? { ...r, [field]: value } : r)));
  }

  const canSubmit =
    !pending && title.trim().length > 0 && items.some((i) => i.description.trim().length > 0);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.flex}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <ScreenHeader title={heading} onBack={onBack} />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <GlassCard>
          <View style={styles.form}>
            <Input label="Title" value={title} onChangeText={setTitle} placeholder="Quote title" />
            <Input
              label="Valid until"
              value={validUntil}
              onChangeText={setValidUntil}
              placeholder="YYYY-MM-DD"
            />
            <Input label="Notes" value={notes} onChangeText={setNotes} placeholder="Optional" />
          </View>
        </GlassCard>

        <Text style={styles.sectionTitle}>Line items</Text>

        {items.map((row, index) => (
          <GlassCard key={row.key}>
            <View style={styles.rowHead}>
              <Text style={styles.rowIndex}>{index + 1}</Text>
              {items.length > 1 ? (
                <Pressable
                  onPress={() => setItems((rows) => rows.filter((r) => r.key !== row.key))}
                  hitSlop={8}
                >
                  <Text style={styles.remove}>Remove</Text>
                </Pressable>
              ) : null}
            </View>

            <Input
              label="Description"
              value={row.description}
              onChangeText={(v) => patchRow(row.key, 'description', v)}
              placeholder="What is being quoted"
            />

            <View style={styles.numberRow}>
              <View style={styles.flex}>
                <Text style={styles.label}>QUANTITY</Text>
                <TextInput
                  style={styles.numberInput}
                  value={row.quantity}
                  onChangeText={(v) => patchRow(row.key, 'quantity', v)}
                  keyboardType="decimal-pad"
                  placeholder="1"
                  placeholderTextColor={theme.text.dimmer}
                />
              </View>
              <View style={styles.flex}>
                <Text style={styles.label}>UNIT PRICE (KD)</Text>
                <TextInput
                  style={styles.numberInput}
                  value={row.unit_price}
                  onChangeText={(v) => patchRow(row.key, 'unit_price', v)}
                  keyboardType="decimal-pad"
                  placeholder="0.000"
                  placeholderTextColor={theme.text.dimmer}
                />
              </View>
            </View>
          </GlassCard>
        ))}

        <Pressable onPress={() => setItems((rows) => [...rows, emptyRow()])}>
          <GlassCard>
            <Text style={styles.addRow}>+ Add line item</Text>
          </GlassCard>
        </Pressable>

        <GlassCard>
          <Text style={styles.label}>TOTAL</Text>
          <Text style={styles.total}>{formatKD(draftTotal(items))}</Text>
        </GlassCard>

        <Button
          title={submitLabel}
          onPress={() => onSubmit({ title: title.trim(), valid_until: validUntil, notes, items })}
          disabled={!canSubmit}
          loading={pending}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { padding: 20, gap: 12, paddingBottom: 180 },
  form: { gap: 16 },
  sectionTitle: { color: '#fff', fontSize: 15, fontWeight: '600', marginTop: 12 },
  rowHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rowIndex: { color: theme.text.dimmer, fontSize: 12, fontWeight: '600' },
  remove: { color: '#f87171', fontSize: 12, fontWeight: '500' },
  numberRow: { flexDirection: 'row', gap: 12, marginTop: 12 },
  label: {
    fontSize: 11,
    fontWeight: '500',
    color: theme.text.label,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  numberInput: {
    marginTop: 6,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#fff',
    fontSize: 15,
  },
  addRow: { color: theme.text.label, fontSize: 14, fontWeight: '500', textAlign: 'center' },
  total: { color: '#fff', fontSize: 24, fontWeight: '700', marginTop: 6, letterSpacing: -0.5 },
  error: { color: '#f87171', fontSize: 13 },
});

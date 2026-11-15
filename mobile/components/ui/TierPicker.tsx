import { Pressable, StyleSheet, Text, View } from 'react-native';
import { TIERS, tierHint, type Tier } from '@shared/graphics';
import { theme } from '../../lib/theme';

/** Graphic Design: Basic or Premium. `showHint` explains when the dates start. */
export function TierPicker({
  value,
  onChange,
  showHint = true,
}: {
  value: Tier | null;
  onChange: (t: Tier) => void;
  showHint?: boolean;
}) {
  return (
    <View>
      <Text style={styles.label}>TYPE</Text>
      <View style={styles.row}>
        {TIERS.map((t) => {
          const on = value === t.value;
          return (
            <Pressable key={t.value} onPress={() => onChange(t.value)} style={[styles.chip, on && styles.chipOn]}>
              <Text style={[styles.chipText, on && styles.chipTextOn]}>
                {t.label} · {t.days} days
              </Text>
            </Pressable>
          );
        })}
      </View>
      {showHint && <Text style={styles.hint}>{tierHint(value)}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 11, fontWeight: '500', color: theme.text.label, textTransform: 'uppercase', letterSpacing: 1 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  chip: { borderWidth: 1, borderColor: theme.colors.border, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  chipOn: { borderColor: theme.colors.accentTintBorder, backgroundColor: theme.colors.accentTintBg },
  chipText: { color: theme.text.dim, fontSize: 13 },
  chipTextOn: { color: '#fff', fontWeight: '600' },
  hint: { color: theme.text.dim, fontSize: 12, marginTop: 8 },
});

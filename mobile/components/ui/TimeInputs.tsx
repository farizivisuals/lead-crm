import { StyleSheet, View } from 'react-native';
import { Input } from './Input';

/** Optional start/end time side by side, typed as "09:00". Blank = all day. */
export function TimeInputs({
  start,
  end,
  onStart,
  onEnd,
}: {
  start: string;
  end: string;
  onStart: (v: string) => void;
  onEnd: (v: string) => void;
}) {
  return (
    <View style={styles.row}>
      <View style={styles.cell}>
        <Input label="Start time" value={start} onChangeText={onStart} placeholder="09:00" keyboardType="numbers-and-punctuation" />
      </View>
      <View style={styles.cell}>
        <Input label="End time" value={end} onChangeText={onEnd} placeholder="12:00" keyboardType="numbers-and-punctuation" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 12 },
  cell: { flex: 1 },
});

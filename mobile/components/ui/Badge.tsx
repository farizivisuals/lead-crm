import { StyleSheet, Text, View } from 'react-native';
import { theme } from '../../lib/theme';

export function Badge({ label, color }: { label: string; color?: string }) {
  const tint = color ?? theme.text.label;
  return (
    <View style={[styles.wrap, { borderColor: tint }]}>
      <Text style={[styles.text, { color: tint }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
    backgroundColor: 'rgba(255,255,255,0.04)',
    alignSelf: 'flex-start',
  },
  text: { fontSize: 11, fontWeight: '600' },
});

import { StyleSheet, Text, View } from 'react-native';
import { theme, withAlpha } from '../../lib/theme';

export function Badge({ label, color }: { label: string; color?: string }) {
  // Colored badges get a tinted fill derived from their color; neutral badges
  // stay quiet white-alpha.
  const tinted = color?.startsWith('#');
  return (
    <View
      style={[
        styles.wrap,
        tinted
          ? { borderColor: withAlpha(color!, 0.3), backgroundColor: withAlpha(color!, 0.15) }
          : { borderColor: theme.colors.borderMd },
      ]}
    >
      <Text style={[styles.text, { color: color ?? theme.text.label }]} numberOfLines={1}>
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

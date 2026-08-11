import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SymbolView } from 'expo-symbols';
import { theme } from '../../lib/theme';

export function ScreenHeader({
  title,
  subtitle,
  onBack,
  right,
}: {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  right?: ReactNode;
}) {
  return (
    <View style={styles.wrap}>
      {onBack && (
        <Pressable onPress={onBack} hitSlop={12} style={styles.back}>
          <SymbolView name="chevron.left" tintColor="#fff" size={18} />
        </Pressable>
      )}
      <View style={styles.titles}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={styles.subtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingBottom: 4 },
  back: { paddingVertical: 4, paddingRight: 2 },
  titles: { flex: 1 },
  title: { color: '#fff', fontSize: 22, fontWeight: '700', letterSpacing: -0.5 },
  subtitle: { color: theme.text.dim, fontSize: 13, marginTop: 2 },
});

import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SymbolView } from 'expo-symbols';
import { useRouter } from 'expo-router';
import { theme } from '../../lib/theme';

export function ScreenHeader({
  title,
  subtitle,
  onBack,
  right,
  search,
}: {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  right?: ReactNode;
  /** Show the magnifier that opens global search — the web's ⌘K palette. */
  search?: boolean;
}) {
  const router = useRouter();
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
      {search && (
        <Pressable
          onPress={() => router.push('/settings/search')}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Search"
        >
          <SymbolView name="magnifyingglass" tintColor={theme.colors.accent} size={19} />
        </Pressable>
      )}
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

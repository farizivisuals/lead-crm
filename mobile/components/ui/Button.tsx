import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import { theme } from '../../lib/theme';

export function Button({
  title,
  onPress,
  loading = false,
  disabled = false,
  variant = 'primary',
}: {
  title: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: 'primary' | 'ghost';
}) {
  const isPrimary = variant === 'primary';
  const off = disabled || loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={off}
      style={({ pressed }) => [
        styles.base,
        isPrimary ? styles.primary : styles.ghost,
        off && styles.off,
        pressed && !off && styles.pressed,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={isPrimary ? '#18181b' : '#fff'} />
      ) : (
        <Text style={[styles.text, isPrimary ? styles.primaryText : styles.ghostText]}>{title}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { height: 44, borderRadius: theme.radius, alignItems: 'center', justifyContent: 'center' },
  primary: { backgroundColor: '#fafafa' },
  ghost: { backgroundColor: 'transparent', borderWidth: 1, borderColor: theme.colors.border },
  off: { opacity: 0.5 },
  pressed: { transform: [{ scale: 0.98 }] },
  text: { fontSize: 14, fontWeight: '600' },
  primaryText: { color: '#18181b' },
  ghostText: { color: theme.colors.foreground },
});

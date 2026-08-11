import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import { theme, withAlpha } from '../../lib/theme';

type Variant = 'primary' | 'ghost' | 'destructive';

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
  variant?: Variant;
}) {
  const off = disabled || loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={off}
      style={({ pressed }) => [
        styles.base,
        styles[variant],
        off && styles.off,
        pressed && !off && styles.pressed,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'destructive' ? theme.colors.danger : '#fff'} />
      ) : (
        <Text style={[styles.text, textStyles[variant]]}>{title}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { height: 44, borderRadius: theme.radius, alignItems: 'center', justifyContent: 'center' },
  primary: { backgroundColor: theme.colors.accentSolid },
  ghost: { backgroundColor: 'transparent', borderWidth: 1, borderColor: theme.colors.border },
  destructive: {
    backgroundColor: withAlpha(theme.colors.danger, 0.15),
    borderWidth: 1,
    borderColor: withAlpha(theme.colors.danger, 0.3),
  },
  off: { opacity: 0.5 },
  pressed: { transform: [{ scale: 0.98 }] },
  text: { fontSize: 14, fontWeight: '600' },
});

const textStyles = StyleSheet.create({
  primary: { color: '#fff' },
  ghost: { color: theme.colors.foreground },
  destructive: { color: theme.colors.danger },
});

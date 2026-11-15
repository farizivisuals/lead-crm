import { StyleSheet, Text, TextInput, View } from 'react-native';
import { theme } from '../../lib/theme';

export function Input({
  label,
  value,
  onChangeText,
  placeholder,
  secureTextEntry,
  autoComplete,
  keyboardType,
}: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
  autoComplete?: any;
  keyboardType?: any;
}) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.text.dimmer}
        secureTextEntry={secureTextEntry}
        autoComplete={autoComplete}
        keyboardType={keyboardType}
        autoCapitalize="none"
        style={styles.input}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  label: {
    fontSize: 11,
    fontWeight: '500',
    color: theme.text.label,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  input: {
    height: 44,
    borderRadius: theme.radius,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: 'rgba(255,255,255,0.05)',
    paddingHorizontal: 14,
    fontSize: 14,
    color: '#fff',
  },
});

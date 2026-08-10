import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { supabase } from '../../lib/supabase';
import { Screen } from '../../components/ui/Screen';
import { GlassCard } from '../../components/ui/GlassCard';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { theme } from '../../lib/theme';

export default function UpdatePasswordScreen() {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleUpdate() {
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setLoading(true);
    setError(null);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      setError(updateError.message);
      setLoading(false);
      return;
    }
    // Session gate routes onward once the user record refreshes.
  }

  return (
    <Screen>
      <View style={styles.wrap}>
        <GlassCard style={styles.card}>
          <Text style={styles.title}>Set a new password</Text>
          <Text style={styles.subtitle}>Choose a password for your account.</Text>

          <View style={styles.form}>
            <Input
              label="New password"
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              secureTextEntry
              autoComplete="new-password"
            />
            <Input
              label="Confirm password"
              value={confirm}
              onChangeText={setConfirm}
              placeholder="••••••••"
              secureTextEntry
              autoComplete="new-password"
            />
            {error && <Text style={styles.errorText}>{error}</Text>}
            <Button title="Update password" onPress={handleUpdate} loading={loading} />
          </View>
        </GlassCard>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, justifyContent: 'center', padding: 24 },
  card: { padding: 24 },
  title: { color: '#fff', fontSize: 22, fontWeight: '700', letterSpacing: -0.5 },
  subtitle: { color: theme.text.dim, fontSize: 13, marginTop: 4 },
  form: { gap: 16, marginTop: 24 },
  errorText: { color: '#f87171', fontSize: 13 },
});

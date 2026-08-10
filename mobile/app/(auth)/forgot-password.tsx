import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import * as Linking from 'expo-linking';
import { supabase } from '../../lib/supabase';
import { Screen } from '../../components/ui/Screen';
import { GlassCard } from '../../components/ui/GlassCard';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { theme } from '../../lib/theme';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleReset() {
    setLoading(true);
    setError(null);
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: Linking.createURL('/update-password'),
    });
    if (resetError) setError(resetError.message);
    else setSent(true);
    setLoading(false);
  }

  return (
    <Screen>
      <View style={styles.wrap}>
        <GlassCard style={styles.card}>
          <Text style={styles.title}>Reset password</Text>
          <Text style={styles.subtitle}>
            {sent
              ? 'If that email is registered, a reset link is on its way.'
              : "Enter your email and we'll send you a reset link."}
          </Text>

          {!sent && (
            <View style={styles.form}>
              <Input
                label="Email"
                value={email}
                onChangeText={setEmail}
                placeholder="you@agency.com"
                autoComplete="email"
                keyboardType="email-address"
              />
              {error && <Text style={styles.errorText}>{error}</Text>}
              <Button title="Send reset link" onPress={handleReset} loading={loading} />
            </View>
          )}

          <View style={styles.back}>
            <Button title="Back to sign in" variant="ghost" onPress={() => router.replace('/login')} />
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
  back: { marginTop: 16 },
});

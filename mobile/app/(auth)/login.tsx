import { useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Link } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { Screen } from '../../components/ui/Screen';
import { GlassCard } from '../../components/ui/GlassCard';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { theme } from '../../lib/theme';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLogin() {
    setLoading(true);
    setError(null);
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }
    // No navigation here — the root session gate routes by user_type once the
    // auth state change lands. Leave `loading` true so the button stays busy
    // through the transition.
  }

  return (
    <Screen>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <Image
              source={require('../../assets/logo.png')}
              style={styles.logo}
              resizeMode="contain"
            />
            <Text style={styles.tagline}>Marketing Agency CRM</Text>
          </View>

          <GlassCard style={styles.card}>
            <Text style={styles.title}>Welcome back</Text>
            <Text style={styles.subtitle}>Sign in to your workspace</Text>

            <View style={styles.form}>
              <Input
                label="Email"
                value={email}
                onChangeText={setEmail}
                placeholder="you@agency.com"
                autoComplete="email"
                keyboardType="email-address"
              />
              <Input
                label="Password"
                value={password}
                onChangeText={setPassword}
                placeholder="••••••••"
                secureTextEntry
                autoComplete="current-password"
              />

              {error && (
                <View style={styles.error}>
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              )}

              <Button title="Sign in" onPress={handleLogin} loading={loading} />

              <Link href="/forgot-password" asChild>
                <Pressable style={styles.forgot}>
                  <Text style={styles.forgotText}>Forgot your password?</Text>
                </Pressable>
              </Link>
            </View>
          </GlassCard>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  header: { alignItems: 'center', marginBottom: 32 },
  // The web renders logo.png inverted (it's a dark-on-light source asset).
  // tintColor white is the RN equivalent of `className="invert"`.
  logo: { height: 44, width: 124, opacity: 0.9, tintColor: '#fff' },
  tagline: { color: theme.text.dim, fontSize: 13, marginTop: 8 },
  card: { padding: 24 },
  title: { color: '#fff', fontSize: 22, fontWeight: '700', letterSpacing: -0.5 },
  subtitle: { color: theme.text.dim, fontSize: 13, marginTop: 4 },
  form: { gap: 16, marginTop: 24 },
  error: {
    backgroundColor: 'rgba(220,40,40,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(220,40,40,0.20)',
    borderRadius: theme.radius,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  errorText: { color: '#f87171', fontSize: 13 },
  forgot: { alignItems: 'center', paddingVertical: 4 },
  forgotText: { color: theme.text.dimmer, fontSize: 12 },
});

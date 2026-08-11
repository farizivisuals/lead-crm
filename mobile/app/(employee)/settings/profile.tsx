import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useMutation } from '@tanstack/react-query';
import { ROLE_LABELS } from '@shared/rbac';
import { Screen } from '../../../components/ui/Screen';
import { GlassCard } from '../../../components/ui/GlassCard';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { ScreenHeader } from '../../../components/ui/ScreenHeader';
import { useAuth } from '../../../lib/auth';
import { updateFullName, updateOwnPassword } from '../../../lib/queries/settings';
import { theme } from '../../../lib/theme';

const MIN_PASSWORD = 8;

export default function ProfileScreen() {
  const router = useRouter();
  const { session, profile, employee, retryProfile } = useAuth();
  const role = employee?.role ?? 'employee';

  const [fullName, setFullName] = useState(profile?.full_name ?? '');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');

  const saveName = useMutation({
    mutationFn: () => updateFullName(session!.user.id, fullName.trim()),
    onSuccess: () => {
      // Re-reads the profile so the More tab and this form show the new name
      // without a sign-out; the auth context holds it, not TanStack Query.
      retryProfile();
      Alert.alert('Saved', 'Your name has been updated.');
    },
    onError: (e: Error) => Alert.alert('Could not save name', e.message),
  });

  const savePassword = useMutation({
    mutationFn: () => updateOwnPassword(password),
    onSuccess: () => {
      setPassword('');
      setConfirm('');
      Alert.alert('Password changed', 'Use your new password next time you sign in.');
    },
    onError: (e: Error) => Alert.alert('Could not change password', e.message),
  });

  const nameChanged = fullName.trim().length > 0 && fullName.trim() !== profile?.full_name;
  const canSaveName = !saveName.isPending && nameChanged;

  const passwordsMatch = password.length > 0 && password === confirm;
  const passwordLongEnough = password.length >= MIN_PASSWORD;
  const canSavePassword = !savePassword.isPending && passwordsMatch && passwordLongEnough;

  return (
    <Screen>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <ScreenHeader title="Profile" onBack={() => router.back()} />

          <GlassCard>
            <Text style={styles.label}>SIGNED IN AS</Text>
            <Text style={styles.value}>{session?.user.email ?? '—'}</Text>
            <Text style={styles.role}>{ROLE_LABELS[role]}</Text>
          </GlassCard>

          <GlassCard>
            <View style={styles.form}>
              <Input
                label="Full name"
                value={fullName}
                onChangeText={setFullName}
                placeholder="Your name"
              />
              <Button
                title="Save name"
                onPress={() => saveName.mutate()}
                disabled={!canSaveName}
                loading={saveName.isPending}
              />
            </View>
          </GlassCard>

          <GlassCard>
            <View style={styles.form}>
              <Text style={styles.label}>CHANGE PASSWORD</Text>
              <Input
                label="New password"
                value={password}
                onChangeText={setPassword}
                placeholder={`At least ${MIN_PASSWORD} characters`}
                secureTextEntry
              />
              <Input
                label="Confirm new password"
                value={confirm}
                onChangeText={setConfirm}
                placeholder="Repeat it"
                secureTextEntry
              />
              {password.length > 0 && !passwordLongEnough ? (
                <Text style={styles.hint}>Use at least {MIN_PASSWORD} characters.</Text>
              ) : null}
              {confirm.length > 0 && !passwordsMatch ? (
                <Text style={styles.hint}>Those do not match.</Text>
              ) : null}
              <Button
                title="Change password"
                onPress={() => savePassword.mutate()}
                disabled={!canSavePassword}
                loading={savePassword.isPending}
              />
            </View>
          </GlassCard>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { padding: 20, gap: 12, paddingBottom: 160 },
  form: { gap: 16 },
  label: {
    fontSize: 11,
    fontWeight: '500',
    color: theme.text.label,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  value: { color: '#fff', fontSize: 15, marginTop: 6 },
  role: { color: theme.text.dim, fontSize: 13, marginTop: 2 },
  hint: { color: theme.colors.warning, fontSize: 12 },
});

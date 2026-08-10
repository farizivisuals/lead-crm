import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Screen } from '../../components/ui/Screen';
import { GlassCard } from '../../components/ui/GlassCard';
import { Button } from '../../components/ui/Button';
import { useAuth } from '../../lib/auth';
import { isExecutive, ROLE_LABELS } from '@shared/rbac';
import { theme } from '../../lib/theme';

export default function More() {
  const { profile, employee, signOut } = useAuth();
  const role = employee?.role ?? 'employee';
  const exec = isExecutive(role);

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.heading}>More</Text>

        <GlassCard>
          <Text style={styles.name}>{profile?.full_name ?? '—'}</Text>
          <Text style={styles.role}>{ROLE_LABELS[role]}</Text>
        </GlassCard>

        <GlassCard>
          {exec && <Text style={styles.row}>Clients</Text>}
          {exec && <Text style={styles.row}>Team</Text>}
          {exec && <Text style={styles.row}>Stages</Text>}
          <Text style={styles.row}>Profile</Text>
          <Text style={styles.row}>Notifications</Text>
        </GlassCard>

        <Button title="Sign out" variant="ghost" onPress={signOut} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 20, gap: 16, paddingBottom: 100 },
  heading: { color: '#fff', fontSize: 26, fontWeight: '700', letterSpacing: -0.5 },
  name: { color: '#fff', fontSize: 16, fontWeight: '600' },
  role: { color: theme.text.dim, fontSize: 13, marginTop: 2 },
  row: { color: theme.colors.foreground, fontSize: 15, paddingVertical: 10 },
});

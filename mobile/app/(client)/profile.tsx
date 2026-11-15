import { ScrollView, StyleSheet, Text } from 'react-native';
import { Screen } from '../../components/ui/Screen';
import { GlassCard } from '../../components/ui/GlassCard';
import { Button } from '../../components/ui/Button';
import { useAuth } from '../../lib/auth';
import { theme } from '../../lib/theme';

export default function ClientProfile() {
  const { profile, session, signOut } = useAuth();
  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.heading}>Profile</Text>
        <GlassCard>
          <Text style={styles.name}>{profile?.full_name ?? '—'}</Text>
          <Text style={styles.email}>{session?.user.email ?? '—'}</Text>
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
  email: { color: theme.text.dim, fontSize: 13, marginTop: 2 },
});

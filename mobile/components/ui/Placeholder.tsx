import { StyleSheet, Text, View } from 'react-native';
import { Screen } from './Screen';
import { theme } from '../../lib/theme';

export function Placeholder({ title }: { title: string }) {
  return (
    <Screen>
      <View style={styles.wrap}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.note}>Coming in a later phase.</Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6 },
  title: { color: '#fff', fontSize: 20, fontWeight: '700' },
  note: { color: theme.text.dimmer, fontSize: 13 },
});

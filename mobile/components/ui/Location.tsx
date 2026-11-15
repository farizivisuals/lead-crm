import { Alert, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { locationHref, locationLabel } from '@shared/location';
import { Input } from './Input';
import { theme } from '../../lib/theme';

/** Shoot location: paste a Google Maps / Waze link, or type an address. */
export function LocationInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <View style={styles.wrap}>
      <Input
        label="Location"
        value={value}
        onChangeText={onChange}
        placeholder="Google Maps or Waze link, or an address"
        keyboardType="url"
      />
      {value.trim().length > 0 && <LocationLink location={value} />}
    </View>
  );
}

/** Opens the link in Google Maps / Waze (or the browser) on the phone. */
export function LocationLink({ location }: { location: string }) {
  const href = locationHref(location);
  if (!href) return null;
  return (
    <Pressable
      onPress={() => Linking.openURL(href).catch(() => Alert.alert('Could not open the location', href))}
      hitSlop={8}
      accessibilityRole="link"
    >
      <Text style={styles.link} numberOfLines={1}>
        📍 {locationLabel(location)}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  link: { color: theme.colors.accent, fontSize: 14, fontWeight: '600' },
});

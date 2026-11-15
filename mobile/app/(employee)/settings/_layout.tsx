import { Stack } from 'expo-router';
import { theme } from '../../../lib/theme';

export default function SettingsLayout() {
  // Collapses team / notifications / profile into one entry so they do not each
  // become a tab in the (employee) Tabs layout. Same reason projects/ and
  // clients/ have their own Stack.
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.colors.background },
      }}
    />
  );
}

import { Stack } from 'expo-router';
import { theme } from '../../../lib/theme';

export default function ClientsLayout() {
  // Without this Stack, every file under clients/ becomes its own tab in the
  // (employee) Tabs layout. Same reason projects/ has one. headerShown stays
  // false because each screen renders its own <ScreenHeader>.
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.colors.background },
      }}
    />
  );
}

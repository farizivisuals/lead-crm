import { Stack } from 'expo-router';
import { theme } from '../../../lib/theme';

export default function ProjectsLayout() {
  // headerShown stays false and screens render <ScreenHeader> themselves, so
  // <Screen>'s safe-area padding is applied exactly once. Swipe-back still
  // works with the native header hidden.
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.colors.background },
      }}
    />
  );
}

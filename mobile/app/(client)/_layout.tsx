import { Tabs } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { BlurView } from 'expo-blur';
import { StyleSheet, type ColorValue } from 'react-native';
import { theme } from '../../lib/theme';

function icon(name: string) {
  return ({ color }: { color: ColorValue }) => (
    <SymbolView name={name as any} tintColor={color as string} size={24} />
  );
}

export default function ClientLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.colors.accent,
        tabBarInactiveTintColor: theme.text.dim,
        tabBarStyle: { position: 'absolute', borderTopColor: theme.colors.border },
        tabBarBackground: () => (
          <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
        ),
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Projects', tabBarIcon: icon('folder') }} />
      <Tabs.Screen name="calendar" options={{ title: 'Calendar', tabBarIcon: icon('calendar') }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: icon('person.circle') }} />
      {/* Reached by tapping a project, not from the tab bar. href: null keeps
          the projects/ stack out of the tabs without making it unreachable. */}
      <Tabs.Screen name="projects/[projectId]" options={{ href: null }} />
    </Tabs>
  );
}

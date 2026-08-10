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

export default function EmployeeLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#fff',
        tabBarInactiveTintColor: theme.text.dimmer,
        tabBarStyle: { position: 'absolute', borderTopColor: theme.colors.border },
        tabBarBackground: () => (
          <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
        ),
      }}
    >
      <Tabs.Screen name="dashboard" options={{ title: 'Dashboard', tabBarIcon: icon('square.grid.2x2') }} />
      <Tabs.Screen name="projects" options={{ title: 'Projects', tabBarIcon: icon('folder') }} />
      <Tabs.Screen name="tasks" options={{ title: 'Tasks', tabBarIcon: icon('checklist') }} />
      <Tabs.Screen name="calendar" options={{ title: 'Calendar', tabBarIcon: icon('calendar') }} />
      <Tabs.Screen name="more" options={{ title: 'More', tabBarIcon: icon('ellipsis.circle') }} />
    </Tabs>
  );
}

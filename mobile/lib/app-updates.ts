import { useEffect } from 'react';
import { Alert, AppState } from 'react-native';
import * as Updates from 'expo-updates';

export type UpdatesApi = {
  isEnabled: boolean;
  checkForUpdateAsync: () => Promise<{ isAvailable: boolean }>;
  fetchUpdateAsync: () => Promise<{ isNew: boolean }>;
  reloadAsync: () => Promise<void>;
};

/**
 * Look for an Expo update, download it, and hand `offer` a restart function.
 * Without this the app only checks on a cold start, which iOS rarely does —
 * updates sat unseen for days. Never throws: offline is normal.
 */
export async function checkForAppUpdate(updates: UpdatesApi, offer: (restart: () => Promise<void>) => void) {
  if (!updates.isEnabled) return;
  try {
    const check = await updates.checkForUpdateAsync();
    if (!check.isAvailable) return;
    const fetched = await updates.fetchUpdateAsync();
    if (fetched.isNew) offer(() => updates.reloadAsync());
  } catch {
    // Offline or the update server is unreachable; try again next time.
  }
}

/** On launch and whenever the app comes back to the front. */
export function useAppUpdates() {
  useEffect(() => {
    const offer = (restart: () => Promise<void>) =>
      Alert.alert('Update ready', 'A new version of Lead CRM is ready.', [
        { text: 'Later', style: 'cancel' },
        { text: 'Restart now', onPress: () => void restart() },
      ]);
    const run = () => void checkForAppUpdate(Updates, offer);
    run();
    const sub = AppState.addEventListener('change', (s) => s === 'active' && run());
    return () => sub.remove();
  }, []);
}

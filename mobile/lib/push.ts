import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { supabase } from './supabase';
import type { UserType } from './routing';

/**
 * Push registration and teardown.
 *
 * Two hard constraints worth knowing before debugging this:
 *  - APNs does not exist on the iOS Simulator. `getExpoPushTokenAsync` throws
 *    there, so registration is skipped on anything that is not a real device.
 *  - expo-notifications is a native module, so none of this works in Expo Go
 *    or in a dev client built before it was added. It needs a fresh build.
 */

/** Foreground presentation. Without this a push arriving while the app is open is silent. */
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/** The EAS project id, which getExpoPushTokenAsync requires in a bare/dev build. */
function projectId(): string | undefined {
  return (
    Constants.expoConfig?.extra?.eas?.projectId ??
    (Constants as any).easConfig?.projectId
  );
}

/**
 * Asks permission, gets the Expo token, and upserts it for this user.
 * Returns the token, or null when push is unavailable (simulator, permission
 * denied, no project id) — every one of those is a normal state, not an error.
 */
export async function registerPushToken(userId: string): Promise<string | null> {
  if (!Device.isDevice) return null;

  const existing = await Notifications.getPermissionsAsync();
  let status = existing.status;
  if (status !== 'granted') {
    // Only ask if we have not been denied before — iOS shows the system prompt
    // once, and asking again after a denial is a silent no-op.
    if (!existing.canAskAgain) return null;
    status = (await Notifications.requestPermissionsAsync()).status;
  }
  if (status !== 'granted') return null;

  const id = projectId();
  if (!id) return null;

  const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId: id });
  if (!token) return null;

  // Composite PK is (profile_id, token), so re-registering the same device is
  // an update rather than a duplicate row.
  const { error } = await supabase
    .from('push_tokens')
    .upsert(
      { profile_id: userId, token, platform: 'ios', updated_at: new Date().toISOString() },
      { onConflict: 'profile_id,token' }
    );
  if (error) throw error;
  return token;
}

/**
 * Drops THIS device's token on sign-out. Scoped to the one token rather than
 * every row for the user — signing out on a phone must not stop the same
 * person's iPad from receiving anything.
 */
export async function unregisterPushToken(userId: string): Promise<void> {
  if (!Device.isDevice) return;
  const id = projectId();
  if (!id) return;
  try {
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId: id });
    if (!token) return;
    await supabase.from('push_tokens').delete().eq('profile_id', userId).eq('token', token);
  } catch {
    // Sign-out must never fail because the token could not be read.
  }
}

/**
 * Where a tapped notification should land, from the trigger's entity fields.
 *
 * Needs the user type because (client) and (employee) both declare
 * `/projects/[projectId]`: the bare path resolves to the (employee) copy, and
 * a client's root Stack has no (employee) screen, so expo-router silently
 * drops the navigation. Group-qualified hrefs keep each side on its own copy.
 */
export function routeForNotification(
  entityType: string | null | undefined,
  entityId: string | null | undefined,
  userType: UserType | null | undefined,
  /** send-push adds the task's project, so the tap can open the task itself. */
  projectId?: string | null
): { pathname: string; params: Record<string, string> } | null {
  if (!entityId || !userType) return null;
  const group = userType === 'client' ? '/(client)' : '/(employee)';
  switch (entityType) {
    case 'project':
      return {
        pathname: `${group}/projects/[projectId]`,
        params: { projectId: entityId },
      };
    case 'task':
      if (userType === 'employee' && projectId) {
        return {
          pathname: '/(employee)/projects/[projectId]/tasks/[taskId]',
          params: { projectId, taskId: entityId },
        };
      }
      // The notification carries the TASK id, and the task screen is nested
      // under its project — which we would need a round trip to discover. My
      // Tasks lists it without one, so it is the honest destination. Clients
      // have no such screen, so they just get the app opened.
      return userType === 'employee' ? { pathname: '/(employee)/tasks', params: {} } : null;
    case 'deliverable':
      // Same problem, no equivalent list screen: the deliverables list is
      // per-project. Opening the app with no navigation beats guessing wrong.
      return null;
    default:
      return null;
  }
}

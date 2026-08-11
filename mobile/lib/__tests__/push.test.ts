// push.ts pulls in expo-notifications, expo-device and the Supabase client,
// all of which touch native modules at import time. routeForNotification is
// pure, so bare mocks are enough to let the import resolve.
jest.mock('expo-notifications', () => ({ setNotificationHandler: () => {} }));
jest.mock('expo-device', () => ({ isDevice: false }));
jest.mock('expo-constants', () => ({ expoConfig: { extra: { eas: { projectId: 'x' } } } }));
jest.mock('../supabase', () => ({ supabase: {} }));

import { routeForNotification } from '../push';

describe('routeForNotification', () => {
  it('sends a project notification to that project', () => {
    expect(routeForNotification('project', 'p1')).toEqual({
      pathname: '/projects/[projectId]',
      params: { projectId: 'p1' },
    });
  });

  it('sends a task notification to My Tasks', () => {
    // The payload carries the TASK id, but the task screen is nested under a
    // project we would need a round trip to discover. My Tasks lists it.
    expect(routeForNotification('task', 't1')).toEqual({ pathname: '/tasks', params: {} });
  });

  it('does not navigate when the id is missing', () => {
    // The trigger writes entity_id nullable. Routing to /projects/undefined
    // would land on a broken screen; opening the app is the honest fallback.
    expect(routeForNotification('project', null)).toBeNull();
    expect(routeForNotification('project', undefined)).toBeNull();
  });

  it('does not navigate for a deliverable or an unknown type', () => {
    expect(routeForNotification('deliverable', 'd1')).toBeNull();
    expect(routeForNotification('something_new', 'x1')).toBeNull();
  });
});

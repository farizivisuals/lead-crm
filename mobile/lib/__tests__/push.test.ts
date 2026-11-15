// push.ts pulls in expo-notifications, expo-device and the Supabase client,
// all of which touch native modules at import time. routeForNotification is
// pure, so bare mocks are enough to let the import resolve.
jest.mock('expo-notifications', () => ({ setNotificationHandler: () => {} }));
jest.mock('expo-device', () => ({ isDevice: false }));
jest.mock('expo-constants', () => ({ expoConfig: { extra: { eas: { projectId: 'x' } } } }));
jest.mock('../supabase', () => ({ supabase: {} }));

import { routeForNotification } from '../push';

describe('routeForNotification', () => {
  it('sends a project notification to that user type’s project screen', () => {
    // Group-qualified on both sides. The bare `/projects/[projectId]` is
    // declared by (client) and (employee) alike and resolves to the
    // (employee) copy, which a client's root Stack does not mount — the
    // navigation would be dropped and the tap would do nothing.
    expect(routeForNotification('project', 'p1', 'employee')).toEqual({
      pathname: '/(employee)/projects/[projectId]',
      params: { projectId: 'p1' },
    });
    expect(routeForNotification('project', 'p1', 'client')).toEqual({
      pathname: '/(client)/projects/[projectId]',
      params: { projectId: 'p1' },
    });
  });

  it('opens the task itself when the push carries its project', () => {
    expect(routeForNotification('task', 't1', 'employee', 'p1')).toEqual({
      pathname: '/(employee)/projects/[projectId]/tasks/[taskId]',
      params: { projectId: 'p1', taskId: 't1' },
    });
  });

  it('sends an employee task notification to My Tasks', () => {
    // The payload carries the TASK id, but the task screen is nested under a
    // project we would need a round trip to discover. My Tasks lists it.
    expect(routeForNotification('task', 't1', 'employee')).toEqual({
      pathname: '/(employee)/tasks',
      params: {},
    });
  });

  it('does not navigate a client for a task: the portal has no task screen', () => {
    expect(routeForNotification('task', 't1', 'client')).toBeNull();
  });

  it('does not navigate when the id or the user type is missing', () => {
    // The trigger writes entity_id nullable. Routing to /projects/undefined
    // would land on a broken screen; opening the app is the honest fallback.
    expect(routeForNotification('project', null, 'employee')).toBeNull();
    expect(routeForNotification('project', undefined, 'employee')).toBeNull();
    // Profile not loaded yet: we cannot know which group to target.
    expect(routeForNotification('project', 'p1', null)).toBeNull();
  });

  it('does not navigate for a deliverable or an unknown type', () => {
    expect(routeForNotification('deliverable', 'd1', 'employee')).toBeNull();
    expect(routeForNotification('something_new', 'x1', 'employee')).toBeNull();
  });
});

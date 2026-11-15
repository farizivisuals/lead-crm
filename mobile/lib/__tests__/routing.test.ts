import { resolveRoute } from '../routing';

describe('resolveRoute', () => {
  it('sends a signed-out user to login', () => {
    expect(resolveRoute({ hasSession: false, userType: null })).toBe('/login');
  });

  it('sends an employee to the employee dashboard', () => {
    expect(resolveRoute({ hasSession: true, userType: 'employee' })).toBe('/(employee)/dashboard');
  });

  it('sends a client to the client portal', () => {
    expect(resolveRoute({ hasSession: true, userType: 'client' })).toBe('/(client)');
  });

  it('sends a session with no resolvable profile back to login', () => {
    // Profile row missing or unreadable — treat as unauthenticated rather than
    // guessing a route, so the user gets a clean retry instead of an empty shell.
    expect(resolveRoute({ hasSession: true, userType: null })).toBe('/login');
  });

  it('ignores a stale userType when the session is gone', () => {
    expect(resolveRoute({ hasSession: false, userType: 'employee' })).toBe('/login');
  });

  it('keeps a recovering user with no session yet on the auth group', () => {
    // Deep link detected recovery intent but setSession() hasn't resolved yet
    // (or failed) — must not fall through to a dashboard target.
    expect(resolveRoute({ hasSession: false, userType: null, recovering: true })).toBe('/login');
  });

  it('keeps a recovering user with an established session on the auth group', () => {
    // setSession() succeeded and the profile resolved to a real employee — without
    // the recovering override this would route to the employee dashboard and yank
    // the user off /update-password before they can set a new password.
    expect(resolveRoute({ hasSession: true, userType: 'employee', recovering: true })).toBe(
      '/login'
    );
  });

  it('routes normally once recovery is cleared after a successful password update', () => {
    expect(resolveRoute({ hasSession: true, userType: 'employee', recovering: false })).toBe(
      '/(employee)/dashboard'
    );
  });
});

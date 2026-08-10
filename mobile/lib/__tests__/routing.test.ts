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
});

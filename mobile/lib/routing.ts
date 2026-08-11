export type UserType = 'employee' | 'client';

export type Route = '/login' | '/(employee)/dashboard' | '/(client)';

export function resolveRoute(input: {
  hasSession: boolean;
  userType: UserType | null;
  // A password-recovery deep link is in progress: keep the user on the
  // (auth) group (/update-password) even once setSession() gives them a
  // real session, rather than bouncing them to their dashboard. Optional so
  // every existing call site (no recovery flow involved) is unaffected.
  recovering?: boolean;
}): Route {
  if (input.recovering) return '/login';
  if (!input.hasSession) return '/login';
  if (input.userType === 'client') return '/(client)';
  if (input.userType === 'employee') return '/(employee)/dashboard';
  return '/login';
}

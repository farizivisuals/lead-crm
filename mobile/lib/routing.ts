export type UserType = 'employee' | 'client';

export type Route = '/login' | '/(employee)/dashboard' | '/(client)';

export function resolveRoute(input: {
  hasSession: boolean;
  userType: UserType | null;
}): Route {
  if (!input.hasSession) return '/login';
  if (input.userType === 'client') return '/(client)';
  if (input.userType === 'employee') return '/(employee)/dashboard';
  return '/login';
}

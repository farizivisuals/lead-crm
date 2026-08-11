// Supabase's default flowType is `implicit` (see node_modules/@supabase/auth-js
// GoTrueClient — `flowType: 'implicit'`). With `detectSessionInUrl: false` (see
// lib/supabase.ts) the recovery email link's tokens are never consumed
// automatically, so this module parses them ourselves.
//
// The tokens ride in the URL *fragment* (`#access_token=...&refresh_token=...
// &type=recovery`), not the query string — `Linking.parse()` (expo-linking's
// createURL.ts) only reads `URL#searchParams`, i.e. the `?query`, and silently
// drops everything after `#`. Hence the manual split below.
//
// A failed/expired link redirects back with `#error=...&error_code=otp_expired
// &error_description=...` instead of tokens — no `type=recovery` present, so it
// is handled as its own branch rather than falling through to `none`.
// (`URLSearchParams` already percent- and `+`-decodes values for us.)

export type RecoveryLinkResult =
  | { kind: 'recovery'; accessToken: string; refreshToken: string }
  | { kind: 'recovery-error'; message: string }
  | { kind: 'none' };

function fragmentParams(url: string): URLSearchParams | null {
  const i = url.indexOf('#');
  if (i === -1) return null;
  const fragment = url.slice(i + 1);
  if (!fragment) return null;
  return new URLSearchParams(fragment);
}

/**
 * Only ever returns `recovery` when the link genuinely carries
 * `type=recovery` plus both tokens — never blanket-trusts an arbitrary
 * incoming URL, so a crafted deep link can't install an attacker session.
 */
export function parseRecoveryLink(url: string): RecoveryLinkResult {
  const params = fragmentParams(url);
  if (!params) return { kind: 'none' };

  const errorCode = params.get('error') ?? params.get('error_code');
  if (errorCode) {
    const description = params.get('error_description');
    return {
      kind: 'recovery-error',
      message: description || 'This reset link is invalid or has expired.',
    };
  }

  if (params.get('type') !== 'recovery') return { kind: 'none' };

  const accessToken = params.get('access_token');
  const refreshToken = params.get('refresh_token');
  if (!accessToken || !refreshToken) {
    return { kind: 'recovery-error', message: 'This reset link is missing required information.' };
  }

  return { kind: 'recovery', accessToken, refreshToken };
}

import { parseRecoveryLink } from '../recovery-link';

describe('parseRecoveryLink', () => {
  it('extracts tokens from a genuine recovery link', () => {
    const url =
      'leadcrm://update-password#access_token=at-1&refresh_token=rt-1&type=recovery&expires_in=3600';
    expect(parseRecoveryLink(url)).toEqual({
      kind: 'recovery',
      accessToken: 'at-1',
      refreshToken: 'rt-1',
    });
  });

  it('ignores a URL with no fragment at all', () => {
    expect(parseRecoveryLink('leadcrm://update-password')).toEqual({ kind: 'none' });
  });

  it('ignores a fragment that is not type=recovery', () => {
    // e.g. a magic-link sign-in redirect — must not be treated as recovery,
    // so we never blanket-setSession() from an arbitrary incoming URL.
    const url = 'leadcrm://update-password#access_token=at-1&refresh_token=rt-1&type=magiclink';
    expect(parseRecoveryLink(url)).toEqual({ kind: 'none' });
  });

  it('reports a recovery-error for an expired/invalid link', () => {
    const url =
      'leadcrm://update-password#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired';
    expect(parseRecoveryLink(url)).toEqual({
      kind: 'recovery-error',
      message: 'Email link is invalid or has expired',
    });
  });

  it('reports a recovery-error when type=recovery is present but a token is missing', () => {
    const url = 'leadcrm://update-password#access_token=at-1&type=recovery';
    const result = parseRecoveryLink(url);
    expect(result.kind).toBe('recovery-error');
  });

  it('falls back to a generic message when the error link has no description', () => {
    const url = 'leadcrm://update-password#error=access_denied';
    expect(parseRecoveryLink(url)).toEqual({
      kind: 'recovery-error',
      message: 'This reset link is invalid or has expired.',
    });
  });
});

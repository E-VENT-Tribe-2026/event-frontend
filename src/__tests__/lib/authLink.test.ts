import { describe, it, expect } from 'vitest';
import {
  authCallbackLocation,
  isPasswordResetAuthType,
  isSignInAuthType,
  readAuthLinkType,
} from '@/lib/authLink';

describe('authLink', () => {
  it('reads type from the hash or the query string', () => {
    expect(readAuthLinkType('', '#access_token=abc&type=signup')).toBe('signup');
    expect(readAuthLinkType('?type=recovery', '')).toBe('recovery');
    expect(readAuthLinkType('?code=xyz', '#type=email')).toBe('email');
  });

  it('treats confirmation links as sign-in, not password reset', () => {
    expect(isSignInAuthType('signup')).toBe(true);
    expect(isSignInAuthType('email')).toBe(true);
    expect(isPasswordResetAuthType('signup')).toBe(false);
    expect(isPasswordResetAuthType('recovery')).toBe(true);
    expect(isPasswordResetAuthType('invite')).toBe(true);
  });

  it('keeps search and hash when handing off to the auth callback', () => {
    expect(authCallbackLocation('?code=1', '#type=signup')).toBe('/auth/callback?code=1#type=signup');
  });
});

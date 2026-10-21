import { afterEach, describe, expect, it } from 'vitest';
import {
  consumeOAuthNextPath,
  getOAuthCallbackUrl,
  getOAuthRedirectBaseUrl,
} from '@/lib/oauthRedirect';

describe('oauthRedirect', () => {
  afterEach(() => {
    sessionStorage.clear();
  });

  it('uses the current loopback origin and omits ?next= from redirectTo', () => {
    expect(getOAuthRedirectBaseUrl()).toBe(window.location.origin.replace(/\/$/, ''));
    const url = getOAuthCallbackUrl('/home');
    expect(url).toBe(`${window.location.origin.replace(/\/$/, '')}/auth/callback`);
    expect(url).not.toContain('next=');
    expect(consumeOAuthNextPath()).toBe('/home');
    expect(consumeOAuthNextPath('/fallback')).toBe('/fallback');
  });
});

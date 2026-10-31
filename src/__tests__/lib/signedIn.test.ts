import { describe, it, expect, afterEach } from 'vitest';
import { hasSignedInSession } from '@/lib/signedIn';
import { clearAuthToken, setAuthToken } from '@/lib/auth';
import { setCurrentUserFromOAuth, logout } from '@/lib/storage';

describe('hasSignedInSession', () => {
  afterEach(() => {
    clearAuthToken();
    logout();
  });

  it('is false when there is no token and no user', () => {
    expect(hasSignedInSession()).toBe(false);
  });

  it('is true when there is an auth token', () => {
    setAuthToken('tok');
    expect(hasSignedInSession()).toBe(true);
  });

  it('is true when there is a current user snapshot', () => {
    setCurrentUserFromOAuth({ id: 'u1', email: 'a@b.com', name: 'Ada' });
    expect(hasSignedInSession()).toBe(true);
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import AccountRefusalGate from '@/components/AccountRefusalGate';
import { ACCOUNT_REFUSED_EVENT, type AccountRefusal } from '@/lib/accountRefusal';
import { setAuthToken, clearAuthToken } from '@/lib/auth';
import { setPendingAdminVerification } from '@/lib/adminAuth';
import { setCurrentUserFromOAuth } from '@/lib/storage';

function refuse(detail: AccountRefusal) {
  window.dispatchEvent(new CustomEvent(ACCOUNT_REFUSED_EVENT, { detail }));
}

describe('AccountRefusalGate — ticket #294 Part 6', () => {
  const onSignOut = vi.fn();

  beforeEach(() => {
    onSignOut.mockReset();
    setAuthToken('token-abc');
  });

  it('signs out a suspended user with the reason', () => {
    render(<AccountRefusalGate onSignOut={onSignOut} />);
    refuse({ kind: 'suspended', reason: 'Spam' });
    expect(onSignOut).toHaveBeenCalledWith({ suspension: { reason: 'Spam' } });
  });

  it('signs out a suspended user with a null reason', () => {
    render(<AccountRefusalGate onSignOut={onSignOut} />);
    refuse({ kind: 'suspended', reason: null });
    expect(onSignOut).toHaveBeenCalledWith({ suspension: { reason: null } });
  });

  it('signs out a user who became an administrator, without a notice', () => {
    render(<AccountRefusalGate onSignOut={onSignOut} />);
    refuse({ kind: 'administrator' });
    expect(onSignOut).toHaveBeenCalledTimes(1);
    expect(onSignOut.mock.calls[0]).toHaveLength(0);
  });

  it('does nothing when nobody is signed in', () => {
    clearAuthToken();
    render(<AccountRefusalGate onSignOut={onSignOut} />);
    refuse({ kind: 'suspended', reason: 'Spam' });
    refuse({ kind: 'administrator' });
    expect(onSignOut).not.toHaveBeenCalled();
  });

  it('ignores the administrator refusal while an administrator verification is pending', () => {
    setPendingAdminVerification({ accessToken: 'token-abc', hasMfaLinked: false });
    render(<AccountRefusalGate onSignOut={onSignOut} />);
    refuse({ kind: 'administrator' });
    expect(onSignOut).not.toHaveBeenCalled();
  });

  it('ignores the administrator refusal for a stored administrator role', () => {
    setCurrentUserFromOAuth({ id: 'admin-1', email: 'admin@example.com', username: 'admin', role: 'administrator' });
    render(<AccountRefusalGate onSignOut={onSignOut} />);
    refuse({ kind: 'administrator' });
    expect(onSignOut).not.toHaveBeenCalled();
  });

  it('still signs out a suspended administrator', () => {
    setCurrentUserFromOAuth({ id: 'admin-1', email: 'admin@example.com', username: 'admin', role: 'administrator' });
    render(<AccountRefusalGate onSignOut={onSignOut} />);
    refuse({ kind: 'suspended', reason: null });
    expect(onSignOut).toHaveBeenCalledWith({ suspension: { reason: null } });
  });

  it('stops listening after unmount', () => {
    const { unmount } = render(<AccountRefusalGate onSignOut={onSignOut} />);
    unmount();
    refuse({ kind: 'suspended', reason: 'Spam' });
    expect(onSignOut).not.toHaveBeenCalled();
  });
});

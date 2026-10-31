import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, render, screen, fireEvent } from '@testing-library/react';
import AccountRefusalGate from '@/components/AccountRefusalGate';
import { ACCOUNT_REFUSED_EVENT, type AccountRefusal } from '@/lib/accountRefusal';
import { setAuthToken, clearAuthToken } from '@/lib/auth';
import { clearPendingAdminVerification, setPendingAdminVerification } from '@/lib/adminAuth';
import { setCurrentUserFromOAuth } from '@/lib/storage';

function refuse(detail: AccountRefusal) {
  act(() => {
    window.dispatchEvent(new CustomEvent(ACCOUNT_REFUSED_EVENT, { detail }));
  });
}

describe('AccountRefusalGate — ticket #294 Part 6', () => {
  const onSignOut = vi.fn();

  beforeEach(() => {
    onSignOut.mockReset();
    clearPendingAdminVerification();
    setAuthToken('token-abc');
  });

  afterEach(() => {
    clearPendingAdminVerification();
    act(() => {
      clearAuthToken();
    });
  });

  it('blocks a suspended user on a screen until they leave', () => {
    render(<AccountRefusalGate onSignOut={onSignOut} />);
    refuse({ kind: 'suspended', reason: 'Spam' });
    expect(onSignOut).not.toHaveBeenCalled();
    expect(screen.getByTestId('suspension-gate')).toBeInTheDocument();
    expect(screen.getByText('Your account is suspended')).toBeInTheDocument();
    expect(screen.getByText('Spam')).toBeInTheDocument();
  });

  it('hides the screen when the session is cleared', () => {
    render(<AccountRefusalGate onSignOut={onSignOut} />);
    refuse({ kind: 'suspended', reason: 'Spam' });
    expect(screen.getByTestId('suspension-gate')).toBeInTheDocument();
    act(() => {
      clearAuthToken();
    });
    expect(screen.queryByTestId('suspension-gate')).not.toBeInTheDocument();
  });

  it('signs out and goes to welcome from the suspension screen', () => {
    render(<AccountRefusalGate onSignOut={onSignOut} />);
    refuse({ kind: 'suspended', reason: 'Spam' });
    fireEvent.click(screen.getByRole('button', { name: 'Go to welcome' }));
    expect(onSignOut).toHaveBeenCalledWith({ suspension: { reason: 'Spam' }, to: '/' });
  });

  it('signs out and goes to sign in from the suspension screen', () => {
    render(<AccountRefusalGate onSignOut={onSignOut} />);
    refuse({ kind: 'suspended', reason: null });
    fireEvent.click(screen.getByRole('button', { name: 'Go to sign in' }));
    expect(onSignOut).toHaveBeenCalledWith({ suspension: { reason: null }, to: '/login' });
  });

  it('signs out a user who became an administrator, without a notice', () => {
    render(<AccountRefusalGate onSignOut={onSignOut} />);
    refuse({ kind: 'administrator' });
    expect(onSignOut).toHaveBeenCalledTimes(1);
    expect(onSignOut.mock.calls[0]).toHaveLength(0);
    expect(screen.queryByTestId('suspension-gate')).not.toBeInTheDocument();
  });

  it('does nothing when nobody is signed in', () => {
    clearAuthToken();
    render(<AccountRefusalGate onSignOut={onSignOut} />);
    refuse({ kind: 'suspended', reason: 'Spam' });
    refuse({ kind: 'administrator' });
    expect(onSignOut).not.toHaveBeenCalled();
    expect(screen.queryByTestId('suspension-gate')).not.toBeInTheDocument();
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

  it('still blocks a suspended administrator', () => {
    setCurrentUserFromOAuth({ id: 'admin-1', email: 'admin@example.com', username: 'admin', role: 'administrator' });
    render(<AccountRefusalGate onSignOut={onSignOut} />);
    refuse({ kind: 'suspended', reason: null });
    expect(onSignOut).not.toHaveBeenCalled();
    expect(screen.getByTestId('suspension-gate')).toBeInTheDocument();
  });

  it('stops listening after unmount', () => {
    const { unmount } = render(<AccountRefusalGate onSignOut={onSignOut} />);
    unmount();
    refuse({ kind: 'suspended', reason: 'Spam' });
    expect(onSignOut).not.toHaveBeenCalled();
  });
});

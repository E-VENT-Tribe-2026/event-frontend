import { useEffect } from 'react';
import { ACCOUNT_REFUSED_EVENT, type AccountRefusal } from '@/lib/accountRefusal';
import { isAdministratorRole } from '@/lib/adminApi';
import { getPendingAdminVerification } from '@/lib/adminAuth';
import { getAuthToken } from '@/lib/auth';
import { getCurrentUser } from '@/lib/storage';
import type { SuspensionNotice } from '@/lib/suspension';

interface AccountRefusalGateProps {
  onSignOut: (state?: { suspension: SuspensionNotice }) => void;
}

/**
 * Signs the user out when a request is refused because the account is
 * suspended or became an administrator (ticket #294, Part 6). Renders nothing.
 */
export default function AccountRefusalGate({ onSignOut }: AccountRefusalGateProps) {
  useEffect(() => {
    const onRefused = (event: Event) => {
      if (!getAuthToken()) return;
      const refusal = (event as CustomEvent<AccountRefusal>).detail;
      if (refusal?.kind === 'suspended') {
        onSignOut({ suspension: { reason: refusal.reason } });
        return;
      }
      if (refusal?.kind === 'administrator') {
        // Legitimate administrator sessions also get this 403 (e.g. from the
        // warnings check); only a user who became an administrator is signed out.
        if (getPendingAdminVerification() || isAdministratorRole(getCurrentUser()?.role)) return;
        onSignOut();
      }
    };
    window.addEventListener(ACCOUNT_REFUSED_EVENT, onRefused);
    return () => window.removeEventListener(ACCOUNT_REFUSED_EVENT, onRefused);
  }, [onSignOut]);

  return null;
}

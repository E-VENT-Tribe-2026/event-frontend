import { useEffect, useState } from 'react';
import { Ban } from 'lucide-react';
import { ACCOUNT_REFUSED_EVENT, type AccountRefusal } from '@/lib/accountRefusal';
import { isAdministratorRole } from '@/lib/adminApi';
import { getPendingAdminVerification } from '@/lib/adminAuth';
import { AUTH_TOKEN_EVENT, getAuthToken } from '@/lib/auth';
import { getCurrentUser } from '@/lib/storage';
import type { SuspensionNotice } from '@/lib/suspension';

export type SignOutOptions = {
  suspension?: SuspensionNotice;
  to?: string;
};

interface AccountRefusalGateProps {
  onSignOut: (state?: SignOutOptions) => void;
}

/**
 * Suspended accounts cannot use the app: a blocking screen is shown until they
 * leave for welcome or sign-in. Users who became administrators are signed out.
 */
export default function AccountRefusalGate({ onSignOut }: AccountRefusalGateProps) {
  const [suspension, setSuspension] = useState<SuspensionNotice | null>(null);

  useEffect(() => {
    const onRefused = (event: Event) => {
      if (!getAuthToken()) return;
      const refusal = (event as CustomEvent<AccountRefusal>).detail;
      if (refusal?.kind === 'suspended') {
        setSuspension({ reason: refusal.reason });
        return;
      }
      if (refusal?.kind === 'administrator') {
        if (getPendingAdminVerification() || isAdministratorRole(getCurrentUser()?.role)) return;
        onSignOut();
      }
    };
    window.addEventListener(ACCOUNT_REFUSED_EVENT, onRefused);
    const onTokenChanged = () => {
      if (!getAuthToken()) setSuspension(null);
    };
    window.addEventListener(AUTH_TOKEN_EVENT, onTokenChanged);
    return () => {
      window.removeEventListener(ACCOUNT_REFUSED_EVENT, onRefused);
      window.removeEventListener(AUTH_TOKEN_EVENT, onTokenChanged);
    };
  }, [onSignOut]);

  if (!suspension) return null;

  const leave = (to: string) => {
    onSignOut({ suspension, to });
  };

  return (
    <div
      data-testid="suspension-gate"
      className="fixed inset-0 z-[10000] flex items-center justify-center px-6"
      style={{
        background: 'hsl(213 70% 4% / .82)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
      }}
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="suspension-title"
      aria-describedby="suspension-body"
    >
      <div className="w-full max-w-sm rounded-3xl border border-destructive/40 bg-background p-7 shadow-xl space-y-5">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-destructive/15">
          <Ban className="h-6 w-6 text-destructive" aria-hidden />
        </div>
        <div className="space-y-2 text-center">
          <h2 id="suspension-title" className="text-lg font-bold text-foreground">
            Your account is suspended
          </h2>
          <p id="suspension-body" className="text-sm text-muted-foreground">
            You cannot use E-VENT until an administrator lifts the suspension.
          </p>
          {suspension.reason && (
            <p className="whitespace-pre-wrap break-words rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-foreground">
              {suspension.reason}
            </p>
          )}
        </div>
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => leave('/')}
            className="flex w-full items-center justify-center rounded-2xl gradient-primary py-3 text-sm font-bold text-primary-foreground shadow-glow active:scale-[0.98]"
          >
            Go to welcome
          </button>
          <button
            type="button"
            onClick={() => leave('/login')}
            className="flex w-full items-center justify-center rounded-2xl border border-border bg-secondary py-3 text-sm font-semibold text-foreground hover:bg-secondary/80"
          >
            Go to sign in
          </button>
        </div>
      </div>
    </div>
  );
}

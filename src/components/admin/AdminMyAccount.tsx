import { useEffect, useState } from 'react';
import { ArrowLeft, Shield, Flag, ShieldCheck, Loader2, AlertCircle } from 'lucide-react';
import { fetchAdminUserDetails, type AdminUserDetailsFull } from '@/lib/adminApi';

interface AdminMyAccountProps {
  adminId: string;
  onClose: () => void;
}

function formatDate(isoString: string): string {
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;
    return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  } catch {
    return isoString;
  }
}

export default function AdminMyAccount({ adminId, onClose }: AdminMyAccountProps) {
  const [user, setUser] = useState<AdminUserDetailsFull | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    if (!adminId) {
      setLoading(false);
      setError('No admin ID available.');
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError('');

    fetchAdminUserDetails(adminId)
      .then((data) => {
        if (!cancelled) {
          setUser(data);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load account details');
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [adminId]);

  const initials = user?.full_name
    ? user.full_name
        .trim()
        .split(/\s+/)
        .map((w) => w[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : '';

  return (
    <div className="space-y-4">
      {/* Back button */}
      <button
        type="button"
        onClick={onClose}
        className="inline-flex items-center gap-2"
        style={{
          background: 'transparent',
          border: 'none',
          color: 'var(--adm-muted-fg)',
          fontWeight: 500,
          fontSize: 13,
          padding: '6px 8px 6px 0',
          cursor: 'pointer',
        }}
      >
        <ArrowLeft className="h-4 w-4" />
        ← Back to panel
      </button>

      {loading ? (
        <div
          className="flex flex-col items-center justify-center py-16 space-y-3 rounded-2xl border"
          style={{ background: 'var(--adm-card)', borderColor: 'var(--adm-border)' }}
        >
          <Loader2 className="h-7 w-7 animate-spin" style={{ color: 'var(--adm-primary)' }} />
          <p className="text-xs" style={{ color: 'var(--adm-muted-fg)' }}>
            Loading account details...
          </p>
        </div>
      ) : error ? (
        <div
          className="rounded-xl border p-6 text-center space-y-2"
          style={{
            borderColor: 'hsl(0 84% 60% / .3)',
            background: 'hsl(0 84% 60% / .07)',
          }}
        >
          <AlertCircle className="mx-auto h-6 w-6" style={{ color: 'var(--adm-danger)' }} />
          <p className="text-xs font-medium" style={{ color: 'var(--adm-danger-text)' }}>
            {error}
          </p>
        </div>
      ) : user ? (
        <div
          style={{
            background: 'var(--adm-grad-card)',
            border: '1px solid var(--adm-border)',
            borderRadius: 16,
            boxShadow: '0 4px 20px hsl(213 61% 5% / .5)',
            padding: 18,
          }}
        >
          {/* Avatar row */}
          <div className="flex items-center gap-3">
            {/* Avatar circle */}
            <div
              className="shrink-0 flex items-center justify-center text-white"
              style={{
                width: 84,
                height: 84,
                borderRadius: '50%',
                background: 'var(--adm-grad)',
                fontSize: 28,
                fontWeight: 700,
              }}
            >
              {initials}
            </div>

            {/* Name + badge + username */}
            <div className="min-w-0 space-y-1">
              <p
                className="font-bold truncate"
                style={{ fontSize: 18, color: 'var(--adm-fg)' }}
              >
                {user.full_name}
              </p>
              <span
                className="inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold"
                style={{
                  background: 'hsl(271 76% 53% / .2)',
                  color: 'var(--adm-primary-text)',
                  borderColor: 'hsl(271 76% 53% / .4)',
                }}
              >
                <ShieldCheck className="h-3.5 w-3.5" />
                Admin
              </span>
              {user.username && (
                <p className="text-xs truncate" style={{ color: 'var(--adm-muted-fg)' }}>
                  @{user.username}
                </p>
              )}
            </div>
          </div>

          {/* Divider */}
          <div style={{ borderTop: '1px solid var(--adm-border)', margin: '14px 0' }} />

          {/* Stat row 1 — Administrator since */}
          <div
            className="flex items-center gap-3"
            style={{ paddingBottom: 10 }}
          >
            <div
              className="flex items-center justify-center shrink-0"
              style={{
                width: 24,
                height: 24,
                background: 'hsl(271 76% 53% / .16)',
                borderRadius: 12,
              }}
            >
              <Shield className="h-3.5 w-3.5" style={{ color: 'var(--adm-primary)' }} />
            </div>
            <p className="text-xs" style={{ color: 'var(--adm-muted-fg)' }}>
              Administrator since {formatDate(user.created_at)}
            </p>
          </div>

          {/* Stat row 2 — Reports closed */}
          <div className="flex items-center gap-3">
            <div
              className="flex items-center justify-center shrink-0"
              style={{
                width: 24,
                height: 24,
                background: 'hsl(271 76% 53% / .16)',
                borderRadius: 12,
              }}
            >
              <Flag className="h-3.5 w-3.5" style={{ color: 'var(--adm-primary)' }} />
            </div>
            <p className="text-xs" style={{ color: 'var(--adm-muted-fg)' }}>
              Reports closed by you · 0
            </p>
          </div>

          {/* Info banner */}
          <div
            style={{
              background: 'hsl(213 40% 20% / .7)',
              border: '1px solid var(--adm-border)',
              borderRadius: 12,
              color: 'hsl(213 20% 82%)',
              padding: '12px 14px',
              marginTop: 14,
              fontSize: 12,
            }}
          >
            Administrator account. It cannot be changed in the panel; changes are made outside the
            application.
          </div>
        </div>
      ) : null}
    </div>
  );
}

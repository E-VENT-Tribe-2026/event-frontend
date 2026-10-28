import { useEffect, useState } from 'react';
import { ArrowLeft, Shield, Flag, ShieldCheck, Loader2, AlertCircle } from 'lucide-react';
import { fetchAdminAccount, fetchAdminUserDetails, type AdminUserDetailsFull } from '@/lib/adminApi';

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
  const [imgFailed, setImgFailed] = useState<boolean>(false);
  // Reports this administrator closed (dismissed or acted on), from GET /api/admin/account.
  const [reportsClosed, setReportsClosed] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchAdminAccount()
      .then((account) => {
        if (!cancelled) setReportsClosed(account.reports_closed);
      })
      .catch(() => {
        if (!cancelled) setReportsClosed(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

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

  const avatarUrl = (user as AdminUserDetailsFull & { avatar_url?: string })?.avatar_url;

  return (
    <div className="space-y-4">
      {/* Back button */}
      <button
        type="button"
        onClick={onClose}
        className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-colors"
        style={{ color: 'var(--adm-muted-fg)' }}
      >
        <ArrowLeft className="h-4 w-4" />
        Back
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
          className="rounded-[18px] border p-6 space-y-6"
          style={{
            background: 'var(--adm-card)',
            borderColor: 'var(--adm-border)',
            boxShadow: '0 4px 20px hsl(213 61% 5% / .5)',
          }}
        >
          {/* Top Profile Header */}
          <div className="flex items-center gap-4">
            {avatarUrl && !imgFailed ? (
              <img
                src={avatarUrl}
                alt={user.full_name}
                onError={() => setImgFailed(true)}
                className="shrink-0 rounded-full object-cover"
                style={{
                  width: 72,
                  height: 72,
                  boxShadow: 'var(--adm-shadow-glow)',
                  border: '2px solid var(--adm-border)',
                }}
              />
            ) : (
              <div
                className="flex shrink-0 items-center justify-center text-white"
                style={{
                  width: 72,
                  height: 72,
                  borderRadius: '50%',
                  background: 'var(--adm-grad)',
                  fontSize: 24,
                  fontWeight: 700,
                  boxShadow: 'var(--adm-shadow-glow)',
                }}
              >
                {initials}
              </div>
            )}

            <div className="min-w-0 space-y-1">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h2 className="text-xl font-bold tracking-tight" style={{ color: 'var(--adm-fg)' }}>
                  {user.full_name}
                </h2>
                <span
                  className="inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold"
                  style={{
                    background: 'hsl(271 76% 53% / .18)',
                    color: 'var(--adm-primary-text)',
                    borderColor: 'hsl(271 76% 53% / .4)',
                  }}
                >
                  <ShieldCheck className="h-3 w-3" />
                  Admin
                </span>
              </div>
              {user.username && (
                <p className="text-xs" style={{ color: 'var(--adm-muted-fg)' }}>
                  @{user.username}
                </p>
              )}
            </div>
          </div>

          {/* Stat Cards Grid */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* Administrator since card */}
            <div
              className="flex items-center gap-4 rounded-xl border p-4"
              style={{
                background: 'hsl(213 50% 15% / .6)',
                borderColor: 'var(--adm-border)',
              }}
            >
              <div
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                style={{
                  background: 'hsl(271 76% 53% / .18)',
                  color: 'var(--adm-primary)',
                }}
              >
                <Shield className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-base font-bold tracking-tight" style={{ color: 'var(--adm-fg)' }}>
                  {formatDate(user.created_at)}
                </p>
                <p className="text-xs" style={{ color: 'var(--adm-muted-fg)' }}>
                  Administrator since
                </p>
              </div>
            </div>

            {/* Reports closed card */}
            <div
              className="flex items-center gap-4 rounded-xl border p-4"
              style={{
                background: 'hsl(213 50% 15% / .6)',
                borderColor: 'var(--adm-border)',
              }}
            >
              <div
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                style={{
                  background: 'hsl(271 76% 53% / .18)',
                  color: 'var(--adm-primary)',
                }}
              >
                <Flag className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p
                  className="text-base font-bold tracking-tight"
                  style={{ color: 'var(--adm-fg)' }}
                  data-testid="reports-closed-count"
                >
                  {reportsClosed ?? '–'}
                </p>
                <p className="text-xs" style={{ color: 'var(--adm-muted-fg)' }}>
                  Reports closed by you (dismissed or acted on)
                </p>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
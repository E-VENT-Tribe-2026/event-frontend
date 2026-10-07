import { useEffect, useState } from 'react';
import { Shield, Users, Calendar, ClipboardList, Flag, LogOut, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import AppToast from '@/components/AppToast';
import AdminUsersTab from '@/components/admin/AdminUsersTab';
import AdminUserDetail from '@/components/admin/AdminUserDetail';
import { clearAuthToken } from '@/lib/auth';
import { logout } from '@/lib/storage';
import { getApiUrl } from '@/lib/api';
import { API_ENDPOINTS } from '@/lib/apiUrls';
import { getAuthToken } from '@/lib/auth';
import { fetchAdminCounts } from '@/lib/adminApi';

type AdminTab = 'users' | 'events' | 'audit' | 'reports';

type StackEntry =
  | { type: 'user-detail'; userId: string }
  | { type: 'event-detail'; eventId: string };

export default function AdminPanelPage() {
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<AdminTab>('users');
  const [stack, setStack] = useState<StackEntry[]>([]);
  const [adminName, setAdminName] = useState<string>('');
  const [openReportCount, setOpenReportCount] = useState<number | null>(null);

  const [toast, setToast] = useState<{
    show: boolean;
    message: string;
    type: 'success' | 'error' | 'info';
  }>({ show: false, message: '', type: 'success' });

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'error') => {
    setToast({ show: true, message, type });
  };

  // Fetch the admin's name from the profile endpoint
  useEffect(() => {
    const token = getAuthToken();
    if (!token) return;
    let cancelled = false;
    fetch(getApiUrl(API_ENDPOINTS.PROFILE_ME), {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    })
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data: Record<string, unknown>) => {
        if (cancelled) return;
        const profile = (data.data ?? data.user ?? data) as Record<string, unknown>;
        const name =
          (profile.full_name as string | undefined) ||
          (profile.name as string | undefined) ||
          'Administrator';
        setAdminName(name);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  // Fetch open report count for badge
  useEffect(() => {
    fetchAdminCounts()
      .then((data) => {
        // counts may include open reports in the future; for now derive from reports tab
        // API may return open_reports count
        const counts = data as typeof data & { open_reports?: number };
        if (typeof counts.open_reports === 'number') {
          setOpenReportCount(counts.open_reports);
        }
      })
      .catch(() => {});
  }, []);

  const handleSignOut = () => {
    logout();
    clearAuthToken();
    navigate('/login', { replace: true });
  };

  const pushUserDetail = (userId: string) => {
    setStack((prev) => [...prev, { type: 'user-detail', userId }]);
  };

  const pushEventDetail = (eventId: string) => {
    setStack((prev) => [...prev, { type: 'event-detail', eventId }]);
  };

  const popStack = () => {
    setStack((prev) => prev.slice(0, -1));
  };

  const switchTab = (tab: AdminTab) => {
    setStack([]);
    setActiveTab(tab);
  };

  const topOfStack = stack[stack.length - 1] ?? null;
  const showTabs = topOfStack === null;

  const TABS: { id: AdminTab; label: string; icon: React.ReactNode }[] = [
    { id: 'users', label: 'Users', icon: <Users className="h-4 w-4" /> },
    { id: 'events', label: 'Events', icon: <Calendar className="h-4 w-4" /> },
    { id: 'audit', label: 'Audit Log', icon: <ClipboardList className="h-4 w-4" /> },
    { id: 'reports', label: 'Reports', icon: <Flag className="h-4 w-4" /> },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground pb-10">
      {/* Toast */}
      <AppToast
        show={toast.show}
        message={toast.message}
        type={toast.type}
        onClose={() => setToast((prev) => ({ ...prev, show: false }))}
      />

      {/* Sticky Header */}
      <header className="sticky top-0 z-40 border-b border-border bg-card/95 backdrop-blur-lg">
        <div className="mx-auto max-w-3xl px-4 py-4 sm:px-6">
          <div className="flex items-center justify-between gap-3">
            {/* Logo + title */}
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl gradient-primary text-white shadow-glow">
                <Shield className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <h1 className="text-base font-bold tracking-tight text-foreground leading-tight">
                  Administrator Panel
                </h1>
                {adminName && (
                  <p className="text-xs text-muted-foreground truncate">
                    Signed in as <span className="font-semibold text-foreground">{adminName}</span>
                  </p>
                )}
              </div>
            </div>

            {/* Sign Out */}
            <button
              type="button"
              onClick={handleSignOut}
              aria-label="Sign out"
              className="shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-border bg-secondary px-3 py-2 text-xs font-semibold text-foreground hover:bg-secondary/70 hover:border-destructive/40 hover:text-destructive active:scale-95 transition-all"
            >
              <LogOut className="h-3.5 w-3.5" />
              Sign Out
            </button>
          </div>

          {/* 4-Tab segmented control — only visible when no stack */}
          {showTabs && (
            <div
              role="tablist"
              aria-label="Admin sections"
              className="mt-4 flex rounded-xl bg-secondary p-1 gap-0.5"
            >
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={activeTab === tab.id}
                  onClick={() => switchTab(tab.id)}
                  className={`relative flex-1 flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition-all ${
                    activeTab === tab.id
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {tab.icon}
                  <span className="hidden sm:inline">{tab.label}</span>
                  {/* Reports red badge */}
                  {tab.id === 'reports' && openReportCount !== null && openReportCount > 0 && (
                    <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-white leading-none">
                      {openReportCount > 99 ? '99+' : openReportCount}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
        {/* Stack: user detail */}
        {topOfStack?.type === 'user-detail' && (
          <AdminUserDetail
            userId={topOfStack.userId}
            onBack={popStack}
            onOpenEvent={pushEventDetail}
            onErrorToast={(msg) => showToast(msg, 'error')}
            onSuccessToast={(msg) => showToast(msg, 'success')}
          />
        )}

        {/* Stack: event detail (future) */}
        {topOfStack?.type === 'event-detail' && (
          <div className="flex flex-col items-center justify-center py-16 text-center space-y-3 rounded-2xl border border-dashed border-border bg-card/40 px-4">
            <Calendar className="h-10 w-10 text-muted-foreground/50" />
            <p className="text-sm font-semibold text-foreground">Event detail coming soon</p>
            <button
              type="button"
              onClick={popStack}
              className="rounded-lg border border-border bg-secondary px-4 py-2 text-xs font-semibold hover:bg-secondary/70 transition-colors"
            >
              Go Back
            </button>
          </div>
        )}

        {/* Tab content — only shown when stack is empty */}
        {showTabs && (
          <>
            {activeTab === 'users' && (
              <AdminUsersTab
                onOpenUser={pushUserDetail}
                onErrorToast={(msg) => showToast(msg, 'error')}
                onSuccessToast={(msg) => showToast(msg, 'success')}
              />
            )}

            {activeTab === 'events' && (
              <div className="flex flex-col items-center justify-center py-16 px-4 text-center rounded-2xl border border-dashed border-border bg-card/40 space-y-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <Calendar className="h-7 w-7" />
                </div>
                <div className="space-y-1.5 max-w-md">
                  <div className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1 text-[11px] font-medium text-muted-foreground">
                    <Sparkles className="h-3 w-3 text-primary" />
                    <span>Ticket #249 Integration Point</span>
                  </div>
                  <h3 className="text-base font-bold text-foreground">Events Management</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    The Events tab, event status counts (All, Upcoming, Past, Cancelled), event search, and the
                    dedicated panel event details view are built under Ticket #249.
                  </p>
                </div>
              </div>
            )}

            {activeTab === 'audit' && (
              <div className="flex flex-col items-center justify-center py-16 px-4 text-center rounded-2xl border border-dashed border-border bg-card/40 space-y-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <ClipboardList className="h-7 w-7" />
                </div>
                <div className="space-y-1.5 max-w-md">
                  <h3 className="text-base font-bold text-foreground">Audit Log</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    A full audit log of all administrative actions will be shown here.
                  </p>
                </div>
              </div>
            )}

            {activeTab === 'reports' && (
              <div className="flex flex-col items-center justify-center py-16 px-4 text-center rounded-2xl border border-dashed border-border bg-card/40 space-y-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <Flag className="h-7 w-7" />
                </div>
                <div className="space-y-1.5 max-w-md">
                  <h3 className="text-base font-bold text-foreground">Reports</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    User and event reports will be managed here.
                  </p>
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

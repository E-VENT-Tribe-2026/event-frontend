import { useCallback, useEffect, useState } from 'react';
import { Shield, Users, Calendar, ClipboardList, Flag, LogOut, Eye } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import AppToast from '@/components/AppToast';
import AdminUsersTab from '@/components/admin/AdminUsersTab';
import AdminUserDetail from '@/components/admin/AdminUserDetail';
import AdminEventsTab from '@/components/admin/AdminEventsTab';
import AdminEventDetail from '@/components/admin/AdminEventDetail';
import AdminAuditTab from '@/components/admin/AdminAuditTab';
import AdminReportsTab from '@/components/admin/AdminReportsTab';
import AdminReportDetail from '@/components/admin/AdminReportDetail';
import AdminUserView, { type UserViewState } from '@/components/admin/AdminUserView';
import AdminMyAccount from '@/components/admin/AdminMyAccount';
import { clearAuthToken } from '@/lib/auth';
import { logout } from '@/lib/storage';
import { getApiUrl } from '@/lib/api';
import { API_ENDPOINTS } from '@/lib/apiUrls';
import { getAuthToken } from '@/lib/auth';
import { fetchAdminCounts } from '@/lib/adminApi';

type AdminTab = 'users' | 'events' | 'audit' | 'reports';

const ADMIN_TABS: AdminTab[] = ['users', 'events', 'audit', 'reports'];

function tabFromSearch(params: URLSearchParams): AdminTab {
  const tab = params.get('tab');
  return ADMIN_TABS.includes(tab as AdminTab) ? (tab as AdminTab) : 'users';
}

type StackEntry =
  | { type: 'user-detail'; userId: string }
  | { type: 'event-detail'; eventId: string }
  | { type: 'report-detail'; reportId: string };

export default function AdminPanelPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [activeTab, setActiveTab] = useState<AdminTab>(() => tabFromSearch(searchParams));
  const [stack, setStack] = useState<StackEntry[]>([]);
  const [adminName, setAdminName] = useState<string>('');
  const [adminAvatar, setAdminAvatar] = useState<string | null>(null);
  const [avatarFailed, setAvatarFailed] = useState<boolean>(false);
  const [openReportCount, setOpenReportCount] = useState<number | null>(null);

  const [showAccount, setShowAccount] = useState(false);
  const [adminId, setAdminId] = useState<string>('');
  const [hoveredBtn, setHoveredBtn] = useState<string | null>(null);

  const [userView, setUserView] = useState<UserViewState>({
    active: false,
    screen: 'home',
    eventId: null,
    categoryFilter: '',
    searchQuery: '',
  });

  const [toast, setToast] = useState<{
    show: boolean;
    message: string;
    type: 'success' | 'error' | 'info';
  }>({ show: false, message: '', type: 'success' });

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'error') => {
    setToast({ show: true, message, type });
  }, []);

  // Fetch the admin's name and avatar from the profile endpoint
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
        
        const avatar = (profile.avatar_url as string | undefined) || null;
        setAdminAvatar(avatar);

        const profileId = (profile.id as string | undefined) || (profile.user_id as string | undefined) || '';
        setAdminId(profileId);
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
    setShowAccount(false);
    setUserView((v) => ({ ...v, active: false }));
    setStack((prev) => [...prev, { type: 'user-detail', userId }]);
  };

  const pushEventDetail = (eventId: string) => {
    setShowAccount(false);
    setUserView((v) => ({ ...v, active: false }));
    setStack((prev) => [...prev, { type: 'event-detail', eventId }]);
  };

  const pushReportDetail = (reportId: string) => {
    setShowAccount(false);
    setUserView((v) => ({ ...v, active: false }));
    setStack((prev) => [...prev, { type: 'report-detail', reportId }]);
  };

  const popStack = () => {
    setStack((prev) => prev.slice(0, -1));
  };

  const switchTab = (tab: AdminTab) => {
    setShowAccount(false);
    setUserView((v) => ({ ...v, active: false }));
    setStack([]);
    setActiveTab(tab);
  };

  const topOfStack = stack[stack.length - 1] ?? null;

  const TABS: { id: AdminTab; label: string; icon: React.ReactNode }[] = [
    { id: 'users', label: 'Users', icon: <Users className="h-4 w-4" /> },
    { id: 'events', label: 'Events', icon: <Calendar className="h-4 w-4" /> },
    { id: 'audit', label: 'Audit Log', icon: <ClipboardList className="h-4 w-4" /> },
    { id: 'reports', label: 'Reports', icon: <Flag className="h-4 w-4" /> },
  ];

  return (
    <div
      className="adm min-h-screen pb-10"
      style={{ background: 'var(--adm-bg)', color: 'var(--adm-fg)' }}
    >
      {/* Toast */}
      <AppToast
        show={toast.show}
        message={toast.message}
        type={toast.type}
        onClose={() => setToast((prev) => ({ ...prev, show: false }))}
      />

      {/* Sticky Header */}
      <header
        className="sticky top-0 z-40 border-b backdrop-blur-sm"
        style={{
          background: 'hsl(213 61% 11% / .92)',
          borderColor: 'var(--adm-border)',
        }}
      >
        <div className="mx-auto max-w-5xl px-4 py-4 sm:px-6">
          <div className="flex items-center justify-between gap-3">
            {/* Logo + title */}
            <div className="flex items-center gap-2.5 min-w-0">
              <div
                className="shrink-0 flex items-center justify-center text-white"
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 10,
                  background: 'var(--adm-grad)',
                  boxShadow: 'var(--adm-shadow-glow)',
                }}
              >
                <Shield className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <h1
                  className="text-lg font-bold tracking-tight leading-tight"
                  style={{ color: 'var(--adm-fg)' }}
                >
                  Admin Panel
                </h1>
                {adminName && (
                <p className="text-[12px] flex items-center gap-1.5 truncate" style={{ color: 'var(--adm-muted-fg)' }}>
                  <span>Signed in as</span>
                    {adminName}
                  <span
                    className="inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-medium"
                    style={{
                      background: 'hsl(271 76% 53% / .15)',
                      color: 'hsl(271 76% 75%)',
                      border: '1px solid hsl(271 76% 53% / .35)',
                    }}
                  >
                    Administrator
                  </span>
                </p>
              )}
              </div>
            </div>

            {/* Right side controls */}
            <div className="flex items-center gap-2 shrink-0">
              {/* Eye / User view toggle */}
              <button
                type="button"
                onClick={() => {
                  setUserView((v) => {
                    const nextActive = !v.active;
                    if (nextActive) {
                      setShowAccount(false);
                      setStack([]);
                    }
                    return { ...v, active: nextActive };
                  });
                }}
                aria-label="Toggle user view"
                onMouseEnter={() => setHoveredBtn('userview')}
                onMouseLeave={() => setHoveredBtn(null)}
                className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-all"
                style={
                  userView.active
                    ? {
                        background: 'var(--adm-grad)',
                        border: '1px solid var(--adm-primary)',
                        boxShadow: 'var(--adm-shadow-glow)',
                        color: 'white',
                        height: 36,
                        fontSize: 12.5,
                      }
                    : {
                        background: hoveredBtn === 'userview' ? 'hsl(213 50% 17%)' : 'var(--adm-card)',
                        borderColor: hoveredBtn === 'userview' ? 'hsl(271 76% 53% / .6)' : 'var(--adm-border)',
                        color: 'var(--adm-muted-fg)',
                        height: 36,
                        fontSize: 12.5,
                      }
                }
              >
                <Eye className="h-3.5 w-3.5" />
                User view · Read-only
              </button>

              {/* My Account button */}
              {adminName && (
                <button
                  type="button"
                  aria-label="My account"
                  onClick={() => {
                    setShowAccount((prev) => {
                      const nextShow = !prev;
                      if (nextShow) {
                        setUserView((v) => ({ ...v, active: false }));
                        setStack([]);
                      }
                      return nextShow;
                    });
                  }}
                  onMouseEnter={() => setHoveredBtn('account')}
                  onMouseLeave={() => setHoveredBtn(null)}
                  className="inline-flex items-center gap-1.5 rounded-full border transition-all"
                  style={{
                    height: 36,
                    paddingLeft: 6,
                    paddingRight: 12,
                    fontSize: 12.5,
                    fontWeight: 600,
                    borderRadius: 999,
                    background: 'var(--adm-card)',
                    borderColor: showAccount
                      ? 'var(--adm-primary)'
                      : hoveredBtn === 'account'
                        ? 'hsl(271 76% 53% / .6)'
                        : 'var(--adm-border)',
                    boxShadow: showAccount ? 'var(--adm-shadow-glow)' : 'none',
                    color: showAccount ? 'var(--adm-fg)' : 'var(--adm-muted-fg)',
                  }}
                >
                  {/* Avatar or Initials badge */}
                  {adminAvatar && !avatarFailed ? (
                    <img
                      src={adminAvatar}
                      alt={adminName}
                      onError={() => setAvatarFailed(true)}
                      className="shrink-0 rounded-full object-cover"
                      style={{ width: 28, height: 28 }}
                    />
                  ) : (
                    <span
                      className="flex items-center justify-center text-white shrink-0"
                      style={{
                        width: 28,
                        height: 28,
                        background: 'var(--adm-grad)',
                        borderRadius: '50%',
                        fontSize: 11,
                        fontWeight: 700,
                      }}
                    >
                      {adminName
                        .trim()
                        .split(/\s+/)
                        .map((w) => w[0])
                        .slice(0, 2)
                        .join('')
                        .toUpperCase()}
                    </span>
                  )}
                  My account
                </button>
              )}

              {/* Sign Out */}
              <button
                type="button"
                onClick={handleSignOut}
                aria-label="Sign out"
                onMouseEnter={() => setHoveredBtn('signout')}
                onMouseLeave={() => setHoveredBtn(null)}
                className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-all"
                style={{
                  borderColor: hoveredBtn === 'signout' ? 'hsl(271 76% 53% / .6)' : 'var(--adm-border)',
                  background: 'var(--adm-card)',
                  color: 'var(--adm-muted-fg)',
                  height: 36,
                  fontSize: 12.5,
                }}
              >
                <LogOut className="h-3.5 w-3.5" />
                Sign Out
              </button>
            </div>
          </div>

          {/* 4-Tab segmented control — only visible when no stack, not in user view, and not in My Account */}
          {!topOfStack && !userView.active && !showAccount && (
            <div
              role="tablist"
              aria-label="Admin sections"
              className="mt-4 flex rounded-[14px] border p-1 gap-1"
              style={{
                background: 'var(--adm-card)',
                borderColor: 'var(--adm-border)',
              }}
            >
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={activeTab === tab.id}
                  onClick={() => switchTab(tab.id)}
                  className="relative flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-sm font-semibold transition-all"
                  style={
                    activeTab === tab.id
                      ? {
                          background: 'var(--adm-grad)',
                          color: 'white',
                          boxShadow: 'var(--adm-shadow-glow)',
                          fontWeight: 600,
                        }
                      : {
                          background: 'transparent',
                          color: 'var(--adm-muted-fg)',
                          fontWeight: 600,
                        }
                  }
                >
                  {tab.icon}
                  <span className="inline">{tab.label}</span>
                  {/* Reports red badge */}
                  {tab.id === 'reports' && openReportCount !== null && openReportCount > 0 && (
                    <span
                      className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold text-white leading-none"
                      style={{ background: 'var(--adm-danger)' }}
                    >
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
      <main
        className={`mx-auto px-4 py-6 sm:px-6 ${
          activeTab === 'audit' && !showAccount && !userView.active && stack.length === 0
            ? 'max-w-7xl'
            : 'max-w-5xl'
        }`}
      >
        {/* Priority 1: My Account view */}
        {showAccount ? (
          <AdminMyAccount adminId={adminId} onClose={() => setShowAccount(false)} />
        ) : userView.active ? (
          /* Priority 2: User view mode */
          <>
            <div
              className="sticky top-[60px] z-30 mb-4 flex items-center justify-between gap-3 rounded-[14px] border px-4 py-2.5 text-xs font-medium"
              style={{
                background: 'hsl(38 92% 52% / .1)',
                borderColor: 'hsl(38 92% 52% / .35)',
                color: 'var(--adm-warn-text)',
              }}
            >
              <span>Read-only view — actions are disabled.</span>
              <button
                type="button"
                onClick={() => setUserView((v) => ({ ...v, active: false }))}
                className="shrink-0 rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors"
                style={{ background: 'var(--adm-secondary)', color: 'var(--adm-fg)' }}
              >
                Back to panel
              </button>
            </div>
            <AdminUserView
              state={userView}
              onStateChange={setUserView}
              onBack={() => setUserView((v) => ({ ...v, active: false }))}
            />
          </>
        ) : topOfStack?.type === 'user-detail' ? (
          /* Priority 3: Stack detail views */
          <AdminUserDetail
            userId={topOfStack.userId}
            onBack={popStack}
            onOpenEvent={pushEventDetail}
            onErrorToast={(msg) => showToast(msg, 'error')}
            onSuccessToast={(msg) => showToast(msg, 'success')}
          />
        ) : topOfStack?.type === 'event-detail' ? (
          <AdminEventDetail
            eventId={topOfStack.eventId}
            onBack={popStack}
            onNavigateToUser={pushUserDetail}
            onErrorToast={(msg) => showToast(msg, 'error')}
            onSuccessToast={(msg) => showToast(msg, 'success')}
          />
        ) : topOfStack?.type === 'report-detail' ? (
          <AdminReportDetail
            reportId={topOfStack.reportId}
            onBack={popStack}
            onErrorToast={(msg) => showToast(msg, 'error')}
            onSuccessToast={(msg) => showToast(msg, 'success')}
          />
        ) : (
          /* Priority 4: Active tab views */
          <>
            {activeTab === 'users' && (
              <AdminUsersTab
                onOpenUser={pushUserDetail}
                onErrorToast={(msg) => showToast(msg, 'error')}
                onSuccessToast={(msg) => showToast(msg, 'success')}
              />
            )}

            {activeTab === 'events' && (
              <AdminEventsTab
                onOpenEvent={pushEventDetail}
                onErrorToast={(msg) => showToast(msg, 'error')}
                onSuccessToast={(msg) => showToast(msg, 'success')}
              />
            )}

            {activeTab === 'audit' && (
              <AdminAuditTab
                onNavigateToUser={pushUserDetail}
                onNavigateToEvent={pushEventDetail}
                onErrorToast={(msg) => showToast(msg, 'error')}
              />
            )}

            {activeTab === 'reports' && (
              <AdminReportsTab
                onOpenReport={pushReportDetail}
                onErrorToast={(msg) => showToast(msg, 'error')}
              />
            )}
          </>
        )}
      </main>
    </div>
  );
}
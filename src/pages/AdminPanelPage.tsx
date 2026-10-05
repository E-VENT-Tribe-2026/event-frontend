import { useState } from 'react';
import { Shield, Users, Calendar, Sparkles } from 'lucide-react';
import BottomNav from '@/components/BottomNav';
import AppToast from '@/components/AppToast';
import AdminUsersTab from '@/components/admin/AdminUsersTab';

type AdminTab = 'users' | 'events';

export default function AdminPanelPage() {
  const [activeTab, setActiveTab] = useState<AdminTab>('users');
  const [toast, setToast] = useState<{ show: boolean; message: string; type: 'success' | 'error' | 'info' }>({
    show: false,
    message: '',
    type: 'success',
  });

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'error') => {
    setToast({ show: true, message, type });
  };

  return (
    <div className="min-h-screen bg-background text-foreground pb-24">
      {/* Toast Alert */}
      <AppToast
        show={toast.show}
        message={toast.message}
        type={toast.type}
        onClose={() => setToast((prev) => ({ ...prev, show: false }))}
      />

      {/* Top Header */}
      <header className="sticky top-0 z-40 border-b border-border bg-card/95 backdrop-blur-lg">
        <div className="mx-auto max-w-3xl px-4 py-4 sm:px-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl gradient-primary text-white shadow-glow">
                <Shield className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-lg font-bold tracking-tight text-foreground">
                  Administrator Panel
                </h1>
                <p className="text-xs text-muted-foreground">Manage application users and permissions</p>
              </div>
            </div>
          </div>

          {/* Navigation Tabs (Users and Events) */}
          <div className="mt-4 flex rounded-xl bg-secondary p-1">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'users'}
              onClick={() => setActiveTab('users')}
              className={`flex-1 flex items-center justify-center gap-2 rounded-lg py-2 text-xs font-semibold transition-all ${
                activeTab === 'users'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Users className="h-4 w-4" />
              Users
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'events'}
              onClick={() => setActiveTab('events')}
              className={`flex-1 flex items-center justify-center gap-2 rounded-lg py-2 text-xs font-semibold transition-all ${
                activeTab === 'events'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Calendar className="h-4 w-4" />
              Events
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
        {activeTab === 'users' ? (
          <AdminUsersTab
            onErrorToast={(msg) => showToast(msg, 'error')}
            onSuccessToast={(msg) => showToast(msg, 'success')}
          />
        ) : (
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
      </main>

      {/* Persistent Bottom Navigation */}
      <BottomNav />
    </div>
  );
}

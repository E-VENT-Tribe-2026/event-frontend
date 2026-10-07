import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Shield, Users, Calendar } from 'lucide-react';
import BottomNav from '@/components/BottomNav';
import AppToast from '@/components/AppToast';
import AdminUsersTab from '@/components/admin/AdminUsersTab';
import AdminEventsTab from '@/components/admin/AdminEventsTab';

type AdminTab = 'users' | 'events';

export default function AdminPanelPage() {
  // /admin?tab=events opens the Events tab directly (used when coming back from an event's page).
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<AdminTab>(
    searchParams.get('tab') === 'events' ? 'events' : 'users',
  );
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
          <AdminEventsTab onErrorToast={(msg) => showToast(msg, 'error')} />
        )}
      </main>

      {/* Persistent Bottom Navigation */}
      <BottomNav />
    </div>
  );
}

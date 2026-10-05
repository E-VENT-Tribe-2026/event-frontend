import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ShieldCheck, Calendar, UserCheck, Loader2, AlertCircle } from 'lucide-react';
import { UserAvatar } from '@/components/UserAvatar';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { fetchAdminUserDetails, grantAdminRole, type AdminUserDetails, type AdminEventSummary } from '@/lib/adminApi';

interface AdminUserDetailsModalProps {
  userId: string | null;
  isOpen: boolean;
  onClose: () => void;
  onRoleGranted?: (userId: string) => void;
  onErrorToast: (message: string) => void;
  onSuccessToast: (message: string) => void;
}

function formatDate(isoString: string): string {
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;
    return d.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return isoString;
  }
}

function formatEventDateTime(isoString: string): string {
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return isoString;
  }
}

function EventSubList({
  title,
  events,
  emptyMessage,
}: {
  title: string;
  events?: AdminEventSummary[];
  emptyMessage: string;
}) {
  const items = events || [];
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground uppercase tracking-wider">
        <span>{title}</span>
        <span className="text-[11px] font-normal">({items.length})</span>
      </div>
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground/70 italic py-1">{emptyMessage}</p>
      ) : (
        <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
          {items.map((event) => {
            const isCancelled = event.is_cancelled || event.status === 'cancelled';
            return (
              <div
                key={event.id}
                className="flex items-center justify-between rounded-lg bg-secondary/50 p-2 text-xs border border-border/40"
              >
                <div className="min-w-0 flex-1 pr-2">
                  <p className="font-medium text-foreground truncate">{event.title}</p>
                  <p className="text-[11px] text-muted-foreground">{formatEventDateTime(event.date)}</p>
                </div>
                {isCancelled ? (
                  <span className="shrink-0 rounded-full bg-destructive/15 px-2 py-0.5 text-[10px] font-semibold text-destructive">
                    Cancelled
                  </span>
                ) : (
                  <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary capitalize">
                    {event.status || 'Active'}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function AdminUserDetailsModal({
  userId,
  isOpen,
  onClose,
  onRoleGranted,
  onErrorToast,
  onSuccessToast,
}: AdminUserDetailsModalProps) {
  const [user, setUser] = useState<AdminUserDetails | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [confirmOpen, setConfirmOpen] = useState<boolean>(false);
  const [granting, setGranting] = useState<boolean>(false);

  useEffect(() => {
    if (!isOpen || !userId) {
      setUser(null);
      setError('');
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError('');

    fetchAdminUserDetails(userId)
      .then((data) => {
        if (!cancelled) {
          setUser(data);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load user details');
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, userId]);

  const handleGrantRole = async () => {
    if (!user || granting) return;
    setGranting(true);
    try {
      const res = await grantAdminRole(user.id);
      // Update local state without page reload
      setUser((prev) => (prev ? { ...prev, is_admin: true, role: 'administrator' } : null));
      setConfirmOpen(false);
      onSuccessToast(res.message || 'Administrator role granted successfully.');
      onRoleGranted?.(user.id);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to grant administrator role.';
      onErrorToast(msg);
    } finally {
      setGranting(false);
    }
  };

  if (!isOpen) return null;

  const isAdmin = Boolean(user?.is_admin || user?.role === 'administrator');

  return (
    <>
      <AnimatePresence>
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="relative w-full max-w-lg rounded-2xl border border-border bg-card shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border/60 px-5 py-4">
              <h2 className="text-base font-bold text-foreground">User Details</h2>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close user details"
                className="rounded-lg p-1 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Content Body */}
            <div className="overflow-y-auto px-5 py-5 space-y-5">
              {loading ? (
                <div className="flex flex-col items-center justify-center py-12 space-y-3">
                  <Loader2 className="h-7 w-7 animate-spin text-primary" />
                  <p className="text-xs text-muted-foreground">Loading details...</p>
                </div>
              ) : error ? (
                <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-center space-y-2">
                  <AlertCircle className="mx-auto h-6 w-6 text-destructive" />
                  <p className="text-xs text-destructive font-medium">{error}</p>
                </div>
              ) : user ? (
                <>
                  {/* Identity Box */}
                  <div className="flex items-start gap-4 rounded-xl bg-secondary/40 p-4 border border-border/50">
                    <UserAvatar
                      src={user.avatar_url}
                      srcSecondary={user.avatar_url}
                      seed={user.id}
                      name={user.full_name}
                      size="lg"
                    />
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-base font-bold text-foreground truncate">{user.full_name}</h3>
                        {isAdmin ? (
                          <span
                            data-testid="admin-role-badge"
                            className="inline-flex items-center gap-1 rounded-full bg-primary/20 px-2.5 py-0.5 text-xs font-semibold text-primary border border-primary/30"
                          >
                            <ShieldCheck className="h-3.5 w-3.5" />
                            Admin
                          </span>
                        ) : (
                          <span
                            data-testid="user-role-badge"
                            className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground border border-border"
                          >
                            <UserCheck className="h-3.5 w-3.5" />
                            User
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-muted-foreground">
                        {user.username ? `@${user.username}` : <span className="italic">No username chosen</span>}
                      </p>

                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground pt-1">
                        <Calendar className="h-3.5 w-3.5" />
                        <span>Member since {formatDate(user.created_at)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Role Promotion Button for Non-Admins */}
                  {!isAdmin && (
                    <div className="rounded-xl border border-border bg-card p-3.5 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold text-foreground">Grant Administrator Privileges</p>
                        <p className="text-[11px] text-muted-foreground">
                          Allows this user to access the administrator panel.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setConfirmOpen(true)}
                        className="inline-flex items-center gap-1.5 rounded-lg gradient-primary px-3 py-2 text-xs font-semibold text-primary-foreground shadow-glow hover:opacity-90 active:scale-95 transition-all shrink-0"
                      >
                        <ShieldCheck className="h-4 w-4" />
                        Grant Admin
                      </button>
                    </div>
                  )}

                  {/* Events Tabs / Sections */}
                  <div className="space-y-4 pt-1">
                    {/* Organized Events */}
                    <div className="rounded-xl border border-border/60 bg-card p-3.5 space-y-3">
                      <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                        <span>Organized Events</span>
                      </h4>
                      <EventSubList
                        title="Upcoming"
                        events={user.organized_events?.upcoming}
                        emptyMessage="No upcoming organized events."
                      />
                      <EventSubList
                        title="Past"
                        events={user.organized_events?.past}
                        emptyMessage="No past organized events."
                      />
                      <EventSubList
                        title="Cancelled"
                        events={user.organized_events?.cancelled}
                        emptyMessage="No cancelled organized events."
                      />
                    </div>

                    {/* Joined Events */}
                    <div className="rounded-xl border border-border/60 bg-card p-3.5 space-y-3">
                      <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                        <span>Joined Events</span>
                      </h4>
                      <EventSubList
                        title="Upcoming"
                        events={user.joined_events?.upcoming}
                        emptyMessage="No upcoming joined events."
                      />
                      <EventSubList
                        title="Past"
                        events={user.joined_events?.past}
                        emptyMessage="No past joined events."
                      />
                      <EventSubList
                        title="Cancelled"
                        events={user.joined_events?.cancelled}
                        emptyMessage="No cancelled joined events."
                      />
                    </div>
                  </div>
                </>
              ) : null}
            </div>
          </motion.div>
        </div>
      </AnimatePresence>

      {/* Confirmation Dialog */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent className="rounded-2xl max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-bold">Grant Administrator Role?</AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-muted-foreground">
              Are you sure you want to promote{' '}
              <span className="font-semibold text-foreground">{user?.full_name || 'this user'}</span> to an
              administrator? They will receive full administrative access to user and event management.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row gap-2 justify-end">
            <AlertDialogCancel disabled={granting} className="rounded-lg text-xs mt-0">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={granting}
              onClick={(e) => {
                e.preventDefault();
                void handleGrantRole();
              }}
              className="rounded-lg gradient-primary text-xs font-semibold text-white"
            >
              {granting ? (
                <>
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  Granting...
                </>
              ) : (
                'Yes, Grant Admin'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

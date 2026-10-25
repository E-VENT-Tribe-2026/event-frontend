import { useEffect, useMemo, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { ArrowLeft, Ban, Calendar, Clock, UserMinus, UserPlus, X, Check, Users } from 'lucide-react';
import { motion } from 'framer-motion';
import BottomNav from '@/components/BottomNav';
import AppToast from '@/components/AppToast';
import { UserAvatar } from '@/components/UserAvatar';
import PlanBadge from '@/components/PlanBadge';
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
import { getCurrentUser } from '@/lib/storage';
import { getAuthToken, setAuthToken } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { mapApiEventToItem } from '@/lib/mapApiEvent';
import { useUserProfile, invalidateUserProfile, invalidateNotifications, QK } from '@/lib/queries';
import { invalidatePrefix } from '@/lib/queryCache';
import { queryClient } from '@/lib/queryClient';
import {
  FriendsApiError,
  acceptFriendRequest,
  blockUser,
  cancelFriendRequest,
  declineFriendRequest,
  findSentRequestId,
  readRequestId,
  removeFriend,
  sendFriendRequest,
  unblockUser,
  userAvatarUrl,
  userProfilePath,
  type UserSummary,
} from '@/lib/friendsApi';
import {
  PROFILE_UNAVAILABLE_MESSAGE,
  ProfileLoadError,
  fetchUserFriends,
  isProfileUnavailable,
  type ProfileEventGroup,
  type UserProfile,
} from '@/lib/userProfileApi';
import { fetchAdminUserDetails, isAdministratorRole, type AdminUserDetailsFull } from '@/lib/adminApi';

type MainTab = 'events' | 'friends';
type EventTab = 'upcoming' | 'past';
type FriendshipAction = 'send' | 'cancel' | 'accept' | 'decline' | 'remove';
type BlockAction = 'block' | 'unblock';

// The profile carries the first 10 friends; later pages use the same size so offsets line up.
const FRIENDS_PAGE_SIZE = 10;

function errorMessage(error: unknown): string {
  if (error instanceof FriendsApiError) return error.message;
  return 'Something went wrong. Please try again.';
}

function profileLoadMessage(error: unknown): string {
  if (error instanceof ProfileLoadError) return error.message;
  return 'Could not load this profile.';
}

function EventRow({ event }: { event: Record<string, unknown> }) {
  const navigate = useNavigate();
  const item = mapApiEventToItem(event);
  return (
    <button
      type="button"
      onClick={() => navigate(`/event/${item.id}`)}
      className="flex w-full items-center gap-3 rounded-2xl glass-card p-2.5 text-left transition-all hover:border-primary/40"
    >
      <img src={item.image} alt="" className="h-12 w-12 flex-shrink-0 rounded-xl object-cover" />
      <div className="min-w-0 flex-1">
        <p className="line-clamp-1 text-xs font-bold text-foreground">{item.title}</p>
        <p className="mt-0.5 text-[10px] text-muted-foreground">{item.date}</p>
      </div>
    </button>
  );
}

function EventSection({ title, events }: { title: string; events: Array<Record<string, unknown>> }) {
  return (
    <section className="space-y-2" aria-label={title}>
      <h3 className="text-xs font-semibold text-muted-foreground">{title}</h3>
      {events.length === 0 ? (
        <p className="py-3 text-center text-xs text-muted-foreground">No events.</p>
      ) : (
        <div className="space-y-2.5">
          {events.map((e) => (
            <EventRow key={String(e.id)} event={e} />
          ))}
        </div>
      )}
    </section>
  );
}

/** Event lists the backend returned, in display order; a list it left out is not shown. */
function availableEventTabs(groups: Array<ProfileEventGroup | undefined>): EventTab[] {
  return (['upcoming', 'past'] as const).filter((tab) => groups.some((g) => Array.isArray(g?.[tab])));
}

function userProfileFromAdmin(data: AdminUserDetailsFull): UserProfile {
  return {
    id: data.id,
    username: data.username,
    full_name: data.full_name,
    avatar_url: data.avatar_url ?? null,
    avatar_kind: data.avatar_kind ?? 'icon',
    icon_id: data.icon_id ?? null,
    events: {
      organized: {
        upcoming: data.organized_events?.upcoming,
        past: data.organized_events?.past,
      },
      joined: {
        upcoming: data.joined_events?.upcoming,
        past: data.joined_events?.past,
      },
    },
    is_suspended: data.is_suspended,
    suspension: data.suspension,
  };
}

export default function UserProfilePage() {
  const navigate = useNavigate();
  const { userId = '' } = useParams<{ userId: string }>();
  const viewer = getCurrentUser();
  const isSelf = Boolean(viewer?.id) && viewer!.id.trim().toLowerCase() === userId.trim().toLowerCase();

  const [mainTab, setMainTab] = useState<MainTab>('events');
  const [eventTab, setEventTab] = useState<EventTab>('upcoming');
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' as 'success' | 'error' });
  const [confirmBlock, setConfirmBlock] = useState<BlockAction | null>(null);

  // Friends of the viewed user beyond the first page, which comes with the profile.
  const [moreFriends, setMoreFriends] = useState<UserSummary[]>([]);
  const [friendsPage, setFriendsPage] = useState(1);
  const [friendsHasMore, setFriendsHasMore] = useState(false);
  const [friendsLoadingMore, setFriendsLoadingMore] = useState(false);

  const [tokenReady, setTokenReady] = useState(() => Boolean(getAuthToken()));
  useEffect(() => {
    if (tokenReady) return;
    let cancelled = false;
    (async () => {
      try {
        const { data } = (await supabase?.auth.getSession()) ?? { data: null };
        const token = data?.session?.access_token;
        if (token) setAuthToken(token);
      } catch {
        // fall through
      }
      if (!cancelled) setTokenReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [tokenReady]);

  const { data: publicProfile, isLoading, error, refetch } = useUserProfile(
    isSelf || !tokenReady ? undefined : viewer?.id,
    userId,
  );

  const viewerIsAdmin = isAdministratorRole(viewer?.role);
  const [adminOverride, setAdminOverride] = useState<UserProfile | null>(null);
  const [adminOverrideLoading, setAdminOverrideLoading] = useState(false);
  const publicUnavailable = isProfileUnavailable(error);

  useEffect(() => {
    if (!viewerIsAdmin || !publicUnavailable || !userId) {
      setAdminOverride(null);
      return;
    }
    let cancelled = false;
    setAdminOverrideLoading(true);
    fetchAdminUserDetails(userId)
      .then((data) => {
        if (!cancelled) setAdminOverride(userProfileFromAdmin(data));
      })
      .catch(() => {
        if (!cancelled) setAdminOverride(null);
      })
      .finally(() => {
        if (!cancelled) setAdminOverrideLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [viewerIsAdmin, publicUnavailable, userId]);

  const profile = publicProfile ?? adminOverride;

  // A new first page (other user, refetch after an action) restarts the friends list.
  const firstFriendsPage = profile?.friends;
  useEffect(() => {
    setMoreFriends([]);
    setFriendsPage(1);
    // A full first page may have more behind it; an empty next page then hides "Load more".
    setFriendsHasMore((firstFriendsPage?.length ?? 0) >= FRIENDS_PAGE_SIZE);
  }, [firstFriendsPage]);

  const refreshProfile = async () => {
    invalidateUserProfile(userId);
    await refetch();
  };

  const action = useMutation({
    mutationFn: async (kind: FriendshipAction) => {
      if (!profile) return;
      const requestId = readRequestId(profile.friendship) ?? profile.friendship?.request_id ?? null;
      switch (kind) {
        case 'send':
          return sendFriendRequest(profile.id);
        case 'cancel': {
          const id = typeof requestId === 'number' ? requestId : await findSentRequestId(profile.id);
          if (typeof id !== 'number') {
            throw new FriendsApiError('Friend request not found.', 404, 'request_not_found');
          }
          return cancelFriendRequest(id);
        }
        case 'accept':
          return acceptFriendRequest(requestId as number);
        case 'decline':
          return declineFriendRequest(requestId as number);
        case 'remove':
          return removeFriend(profile.id);
      }
    },
    onSuccess: async (data, kind) => {
      if (kind === 'send') {
        const sentId = readRequestId(data);
        if (sentId != null && viewer?.id) {
          queryClient.setQueryData(QK.userProfile(viewer.id, userId), (old: UserProfile | undefined) =>
            old ? { ...old, friendship: { status: 'request_sent', request_id: sentId } } : old,
          );
        }
      }
      invalidatePrefix('/api/notifications');
      invalidateNotifications();
      await refreshProfile();
    },
    onError: (err) => {
      setToast({ show: true, message: errorMessage(err), type: 'error' });
      void refreshProfile();
    },
  });

  const block = useMutation({
    mutationFn: async (kind: BlockAction) => {
      if (kind === 'block') await blockUser(userId);
      else await unblockUser(userId);
    },
    onSuccess: async (_data, kind) => {
      invalidatePrefix('/api/notifications');
      invalidateNotifications();
      setToast({ show: true, message: kind === 'block' ? 'User blocked.' : 'User unblocked.', type: 'success' });
      await refreshProfile();
    },
    onError: (err) => {
      setToast({ show: true, message: errorMessage(err), type: 'error' });
      void refreshProfile();
    },
  });

  const eventGroups = useMemo(() => {
    const groups: Array<{ title: string; group: ProfileEventGroup }> = [];
    if (profile?.events?.organized) groups.push({ title: 'Organized', group: profile.events.organized });
    if (profile?.events?.joined) groups.push({ title: 'Joined', group: profile.events.joined });
    return groups;
  }, [profile]);

  const eventTabs = useMemo(() => availableEventTabs(eventGroups.map((g) => g.group)), [eventGroups]);

  const mainTabs = useMemo(() => {
    const list: Array<{ id: MainTab; label: string; icon: typeof Calendar }> = [];
    if (eventTabs.length > 0) list.push({ id: 'events', label: 'Events', icon: Calendar });
    if (profile?.friends) list.push({ id: 'friends', label: 'Friends', icon: Users });
    return list;
  }, [eventTabs, profile]);

  // Keep the selected tabs on parts the backend returned.
  const activeMainTab = mainTabs.some((t) => t.id === mainTab) ? mainTab : mainTabs[0]?.id;
  const activeEventTab = eventTabs.includes(eventTab) ? eventTab : eventTabs[0];

  if (isSelf) return <Navigate to="/profile" replace />;

  const run = (kind: FriendshipAction) => action.mutate(kind);
  const busy = action.isPending || block.isPending;

  const friends = [...(profile?.friends ?? []), ...moreFriends];

  const loadMoreFriends = async () => {
    const next = friendsPage + 1;
    setFriendsLoadingMore(true);
    try {
      const res = await fetchUserFriends(userId, next, FRIENDS_PAGE_SIZE);
      setMoreFriends((prev) => [...prev, ...res.data]);
      setFriendsPage(next);
      setFriendsHasMore(res.has_more);
    } catch (err) {
      setToast({ show: true, message: errorMessage(err), type: 'error' });
    } finally {
      setFriendsLoadingMore(false);
    }
  };

  const primary =
    'flex items-center justify-center gap-1.5 rounded-full px-5 py-2 text-xs font-semibold disabled:opacity-60';
  const gradient = `${primary} gradient-primary text-primary-foreground shadow-glow`;
  const outline = `${primary} border border-border bg-secondary text-foreground hover:bg-secondary/80`;

  const renderFriendshipAction = (p: UserProfile) => {
    switch (p.friendship?.status) {
      case 'none':
        return (
          <button type="button" onClick={() => run('send')} disabled={busy} className={gradient}>
            <UserPlus className="h-3.5 w-3.5" /> Send Friend Request
          </button>
        );
      case 'request_sent':
        return (
          <button type="button" onClick={() => run('cancel')} disabled={busy} className={outline}>
            <X className="h-3.5 w-3.5" /> Cancel Friend Request
          </button>
        );
      case 'request_received':
        return (
          <>
            <button type="button" onClick={() => run('accept')} disabled={busy} className={gradient}>
              <Check className="h-3.5 w-3.5" /> Accept
            </button>
            <button type="button" onClick={() => run('decline')} disabled={busy} className={outline}>
              <X className="h-3.5 w-3.5" /> Decline
            </button>
          </>
        );
      case 'friends':
        return (
          <button type="button" onClick={() => run('remove')} disabled={busy} className={outline}>
            <UserMinus className="h-3.5 w-3.5" /> Remove Friend
          </button>
        );
      default:
        return null;
    }
  };

  const renderActions = (p: UserProfile) => {
    if (p.blocked_by_me || p.friendship?.status === 'blocked') {
      return (
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setConfirmBlock('unblock')} disabled={busy} className={outline}>
            <Ban className="h-3.5 w-3.5" /> Unblock
          </button>
        </div>
      );
    }
    return (
      <div className="flex flex-wrap gap-2">
        {renderFriendshipAction(p)}
        <button
          type="button"
          onClick={() => setConfirmBlock('block')}
          disabled={busy}
          className={`${primary} border border-destructive/40 bg-secondary text-destructive hover:bg-destructive/10`}
        >
          <Ban className="h-3.5 w-3.5" /> Block
        </button>
      </div>
    );
  };

  const displayName = profile ? profile.full_name || profile.username || 'this user' : 'this user';

  return (
    <div className="min-h-screen bg-background pb-20">
      <AppToast
        message={toast.message}
        type={toast.type}
        show={toast.show}
        onClose={() => setToast((t) => ({ ...t, show: false }))}
      />

      <header className="sticky top-0 z-40 flex items-center gap-3 border-b border-border bg-background/95 px-4 py-3 backdrop-blur-lg">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="rounded-full glass-card p-2 transition-colors hover:bg-secondary/80 active:scale-90"
          aria-label="Back"
        >
          <ArrowLeft className="h-5 w-5 text-foreground" />
        </button>
        <h1 className="text-lg font-bold text-foreground">Profile</h1>
      </header>

      {!tokenReady || isLoading || adminOverrideLoading ? (
        <p className="py-16 text-center text-sm text-muted-foreground">Loading profile…</p>
      ) : !getAuthToken() ? (
        <div className="px-4 py-16 text-center" role="alert">
          <p className="text-sm text-muted-foreground">You are not signed in on this tab. Please log in again.</p>
          <button
            type="button"
            onClick={() => navigate('/login')}
            className="mt-4 rounded-full gradient-primary px-5 py-2 text-xs font-semibold text-primary-foreground shadow-glow"
          >
            Log in
          </button>
        </div>
      ) : publicUnavailable && !adminOverride ? (
        <div className="px-4 py-16 text-center" role="alert">
          <p className="text-sm text-muted-foreground">{PROFILE_UNAVAILABLE_MESSAGE}</p>
        </div>
      ) : (error && !adminOverride) || !profile ? (
        <div className="px-4 py-16 text-center" role="alert">
          <p className="text-sm text-muted-foreground">{profileLoadMessage(error)}</p>
          <button
            type="button"
            onClick={() => {
              void queryClient.invalidateQueries({ queryKey: ['userProfile'] });
              void refetch();
            }}
            className="mt-4 rounded-full border border-border bg-secondary px-5 py-2 text-xs font-semibold"
          >
            Try again
          </button>
        </div>
      ) : (
        <main className="mx-auto max-w-lg space-y-5 pb-6">
          <div className="relative">
            <div
              className="h-32 w-full bg-gradient-to-br from-primary/40 to-accent/40 bg-cover bg-center"
              style={profile.banner_url ? { backgroundImage: `url(${profile.banner_url})` } : undefined}
              data-testid="profile-banner"
            />
            <div className="absolute -bottom-10 left-4">
              <UserAvatar
                src={userAvatarUrl(profile)}
                seed={profile.id}
                name={profile.full_name || profile.username}
                size="xl"
                className="ring-4"
              />
            </div>
          </div>

          <div className="space-y-3 px-4 pt-8">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg font-bold text-foreground">{profile.full_name || profile.username}</h2>
                <PlanBadge plan={profile} />
                {profile.is_suspended && (
                  <span
                    data-testid="account-status-badge"
                    className="inline-flex items-center rounded-full border border-destructive/40 bg-destructive/10 px-2.5 py-0.5 text-[11px] font-semibold text-destructive"
                  >
                    Suspended
                  </span>
                )}
              </div>
              {profile.username && <p className="text-sm text-muted-foreground">@{profile.username}</p>}
            </div>

            {profile.is_suspended && (
              <div
                className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-xs text-foreground"
                role="status"
              >
                <p>
                  <strong>This account is suspended.</strong>
                  {profile.suspension?.reason ? ` Reason: ${profile.suspension.reason}` : ''}
                </p>
              </div>
            )}

            {!profile.is_suspended && renderActions(profile)}

            {profile.bio ? (
              <p className="whitespace-pre-line text-sm text-foreground/90">{profile.bio}</p>
            ) : null}

            {profile.interests && profile.interests.length > 0 && (
              <div className="flex flex-wrap gap-2" aria-label="Interests">
                {profile.interests.map((interest) => (
                  <span
                    key={interest}
                    className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-medium text-primary"
                  >
                    {interest}
                  </span>
                ))}
              </div>
            )}
          </div>

          {mainTabs.length > 0 && (
            <div className="mx-auto max-w-lg px-4 space-y-4">
              <div className="flex rounded-xl glass-card p-1 gap-1" role="tablist">
                {mainTabs.map((tab) => {
                  const active = activeMainTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      data-testid={`user-main-tab-${tab.id}`}
                      onClick={() => setMainTab(tab.id)}
                      className={`flex flex-1 items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-xs font-semibold transition-all ${
                        active
                          ? 'gradient-primary text-primary-foreground shadow-glow'
                          : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
                      }`}
                    >
                      <tab.icon className="h-4 w-4" />
                      <span>{tab.label}</span>
                    </button>
                  );
                })}
              </div>

              {activeMainTab === 'events' && activeEventTab ? (
                <div className="space-y-4">
                  <div className="flex gap-1 rounded-xl glass-card p-1" role="tablist">
                    {eventTabs.map((id) => {
                      const active = activeEventTab === id;
                      const Icon = id === 'upcoming' ? Calendar : Clock;
                      return (
                        <button
                          key={id}
                          type="button"
                          role="tab"
                          aria-selected={active}
                          data-testid={`user-tab-${id}`}
                          onClick={() => setEventTab(id)}
                          className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition-all ${
                            active ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                          }`}
                        >
                          <Icon className="h-3.5 w-3.5" />
                          {id === 'upcoming' ? 'Upcoming' : 'Past'}
                        </button>
                      );
                    })}
                  </div>

                  {eventGroups.map(({ title, group }) => {
                    const list = group[activeEventTab];
                    return Array.isArray(list) ? <EventSection key={title} title={title} events={list} /> : null;
                  })}
                </div>
              ) : activeMainTab === 'friends' ? (
                <div className="space-y-3" aria-label="Friends">
                  {friends.length === 0 ? (
                    <p className="text-center py-8 text-xs text-muted-foreground">No friends yet.</p>
                  ) : (
                    <ul className="space-y-2">
                      {friends.map((f) => {
                        const name = f.full_name || f.display_name || f.username || 'User';
                        return (
                          <motion.li
                            key={f.id}
                            layout
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0 }}
                            className="flex items-center gap-3 rounded-2xl glass-card px-4 py-3 cursor-pointer hover:border-primary/40 transition-all"
                            onClick={() => navigate(userProfilePath(f.id, viewer?.id ?? null))}
                          >
                            <UserAvatar src={userAvatarUrl(f)} seed={f.id} name={name} size="md" />
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-semibold text-foreground">{name}</p>
                              {f.username && (
                                <p className="truncate text-xs text-muted-foreground">@{f.username}</p>
                              )}
                            </div>
                          </motion.li>
                        );
                      })}
                    </ul>
                  )}
                  {friendsHasMore && (
                    <button
                      type="button"
                      onClick={() => void loadMoreFriends()}
                      disabled={friendsLoadingMore}
                      className="w-full rounded-full border border-border bg-secondary py-2 text-xs font-semibold text-foreground hover:bg-secondary/80 disabled:opacity-60"
                    >
                      {friendsLoadingMore ? 'Loading…' : 'Load more'}
                    </button>
                  )}
                </div>
              ) : null}
            </div>
          )}
        </main>
      )}

      <AlertDialog open={confirmBlock !== null} onOpenChange={(open) => !open && setConfirmBlock(null)}>
        <AlertDialogContent className="rounded-3xl glass-card border border-border">
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmBlock === 'unblock' ? `Unblock ${displayName}?` : `Block ${displayName}?`}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmBlock === 'unblock'
                ? 'Your previous friendship will not be restored. To be friends again, one of you will need to send a new friend request.'
                : 'They will no longer be able to see your profile or send you friend requests. Your friendship and any pending friend requests between you will be removed.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-2xl">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirmBlock) block.mutate(confirmBlock);
                setConfirmBlock(null);
              }}
              className={`rounded-2xl ${confirmBlock === 'block' ? 'bg-destructive text-destructive-foreground' : ''}`}
            >
              {confirmBlock === 'unblock' ? 'Unblock' : 'Block'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <BottomNav />
    </div>
  );
}

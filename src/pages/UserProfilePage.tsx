import { useEffect, useMemo, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { ArrowLeft, Calendar, Clock, UserMinus, UserPlus, X, Check, Users, UserCheck } from 'lucide-react';
import { motion } from 'framer-motion';
import BottomNav from '@/components/BottomNav';
import AppToast from '@/components/AppToast';
import { UserAvatar } from '@/components/UserAvatar';
import { getCurrentUser } from '@/lib/storage';
import { getAuthToken, setAuthToken } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { mapApiEventToItem } from '@/lib/mapApiEvent';
import { useUserProfile, invalidateUserProfile, invalidateNotifications } from '@/lib/queries';
import { invalidatePrefix } from '@/lib/queryCache';
import { queryClient } from '@/lib/queryClient';
import {
  FriendsApiError,
  acceptFriendRequest,
  cancelFriendRequest,
  declineFriendRequest,
  removeFriend,
  sendFriendRequest,
  userAvatarUrl,
  userProfilePath,
  fetchFriends,
  type FriendItem,
} from '@/lib/friendsApi';
import { ProfileLoadError, type ProfileEventGroup, type UserProfile } from '@/lib/userProfileApi';

type MainTab = 'events' | 'friends';
type EventTab = 'upcoming' | 'past';
type FriendshipAction = 'send' | 'cancel' | 'accept' | 'decline' | 'remove';

const EMPTY_GROUP: ProfileEventGroup = { upcoming: [], past: [] };

function errorMessage(error: unknown): string {
  if (error instanceof FriendsApiError) return error.message;
  return 'Something went wrong. Please try again.';
}

function profileLoadMessage(error: unknown): string {
  if (error instanceof ProfileLoadError) {
    if (error.status === 403) return 'This profile is private.';
    if (error.status === 404) return 'This user could not be found.';
    return error.message;
  }
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

export default function UserProfilePage() {
  const navigate = useNavigate();
  const { userId = '' } = useParams<{ userId: string }>();
  const viewer = getCurrentUser();
  const isSelf = Boolean(viewer?.id) && viewer!.id.trim().toLowerCase() === userId.trim().toLowerCase();

  const [mainTab, setMainTab] = useState<MainTab>('events');
  const [eventTab, setEventTab] = useState<EventTab>('upcoming');
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' as 'success' | 'error' });

  // Friends Data State for the viewed user
  const [userFriends, setUserFriends] = useState<FriendItem[]>([]);
  const [friendsLoading, setFriendsLoading] = useState(false);

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

  const { data: profile, isLoading, error, refetch } = useUserProfile(
    isSelf || !tokenReady ? undefined : viewer?.id,
    userId,
  );

  // Fetch friends list
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    setFriendsLoading(true);
    fetchFriends(1, 50)
      .then((res) => {
        if (!cancelled) setUserFriends(res.data || []);
      })
      .catch(() => {
        if (!cancelled) setUserFriends([]);
      })
      .finally(() => {
        if (!cancelled) setFriendsLoading(false);
      });
    return () => { cancelled = true; };
  }, [userId]);

  const action = useMutation({
    mutationFn: async (kind: FriendshipAction) => {
      if (!profile) return;
      const requestId = profile.friendship.request_id;
      switch (kind) {
        case 'send':
          return sendFriendRequest(profile.id);
        case 'cancel':
          return cancelFriendRequest(requestId as number);
        case 'accept':
          return acceptFriendRequest(requestId as number);
        case 'decline':
          return declineFriendRequest(requestId as number);
        case 'remove':
          return removeFriend(profile.id);
      }
    },
    onSuccess: async () => {
      invalidatePrefix('/api/notifications');
      invalidateNotifications();
      invalidateUserProfile(userId);
      await refetch();
    },
    onError: (err) => {
      setToast({ show: true, message: errorMessage(err), type: 'error' });
      invalidateUserProfile(userId);
      void refetch();
    },
  });

  const events = useMemo(() => {
    const grouped = profile?.events;
    return {
      organized: grouped?.organized ?? EMPTY_GROUP,
      joined: grouped?.joined ?? EMPTY_GROUP,
    };
  }, [profile]);

  if (isSelf) return <Navigate to="/profile" replace />;

  const run = (kind: FriendshipAction) => action.mutate(kind);
  const busy = action.isPending;

  const renderAction = (p: UserProfile) => {
    const primary =
      'flex items-center justify-center gap-1.5 rounded-full px-5 py-2 text-xs font-semibold disabled:opacity-60';
    const gradient = `${primary} gradient-primary text-primary-foreground shadow-glow`;
    const outline = `${primary} border border-border bg-secondary text-foreground hover:bg-secondary/80`;

    switch (p.friendship.status) {
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
          <div className="flex gap-2">
            <button type="button" onClick={() => run('accept')} disabled={busy} className={gradient}>
              <Check className="h-3.5 w-3.5" /> Accept
            </button>
            <button type="button" onClick={() => run('decline')} disabled={busy} className={outline}>
              <X className="h-3.5 w-3.5" /> Decline
            </button>
          </div>
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

  const tabs: Array<{ id: EventTab; label: string; icon: typeof Calendar }> = [
    { id: 'upcoming', label: 'Upcoming', icon: Calendar },
    { id: 'past', label: 'Past', icon: Clock },
  ];

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

      {!tokenReady || isLoading ? (
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
      ) : error || !profile ? (
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
              <h2 className="text-lg font-bold text-foreground">{profile.full_name || profile.username}</h2>
              {profile.username && <p className="text-sm text-muted-foreground">@{profile.username}</p>}
            </div>

            {renderAction(profile)}

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

          {/* Main Parent Tabs: Events vs Friends */}
          <div className="mx-auto max-w-lg px-4 space-y-4">
            <div className="flex rounded-xl glass-card p-1 gap-1" role="tablist">
              {[
                { id: 'events' as const, label: 'Events', icon: Calendar },
                { id: 'friends' as const, label: 'Friends', icon: Users },
              ].map((tab) => {
                const active = mainTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={active}
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

            {/* Main Content Sections */}
            {mainTab === 'events' ? (
              <div className="space-y-4">
                <div className="flex gap-1 rounded-xl glass-card p-1" role="tablist">
                  {tabs.map((tab) => {
                    const active = eventTab === tab.id;
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        role="tab"
                        aria-selected={active}
                        data-testid={`user-tab-${tab.id}`}
                        onClick={() => setEventTab(tab.id)}
                        className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition-all ${
                          active ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        <tab.icon className="h-3.5 w-3.5" />
                        {tab.label}
                      </button>
                    );
                  })}
                </div>

                <EventSection title="Organized" events={events.organized[eventTab]} />
                <EventSection title="Joined" events={events.joined[eventTab]} />
              </div>
            ) : (
              <div className="space-y-3">
                {friendsLoading ? (
                  <div className="flex justify-center py-8">
                    <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-primary" />
                  </div>
                ) : userFriends.length === 0 ? (
                  <p className="text-center py-8 text-xs text-muted-foreground">No friends found.</p>
                ) : (
                  <ul className="space-y-2">
                    {userFriends.map((f) => {
                      const label = f.user.username || f.user.display_name || f.user.full_name || 'User';
                      return (
                        <motion.li
                          key={f.user.id}
                          layout
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0 }}
                          className="flex items-center gap-3 rounded-2xl glass-card px-4 py-3 cursor-pointer hover:border-primary/40 transition-all"
                          onClick={() => navigate(userProfilePath(f.user.id, viewer?.id ?? null))}
                        >
                          <UserAvatar src={userAvatarUrl(f.user)} seed={f.user.id} name={label} size="md" />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-foreground">@{label}</p>
                            {f.user.full_name && <p className="truncate text-xs text-muted-foreground">{f.user.full_name}</p>}
                          </div>
                        </motion.li>
                      );
                    })}
                  </ul>
                )}
              </div>
            )}
          </div>
        </main>
      )}

      <BottomNav />
    </div>
  );
}
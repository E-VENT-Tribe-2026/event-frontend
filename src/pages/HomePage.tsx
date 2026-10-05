import { useState, useMemo, useEffect, useCallback } from 'react';
import { getCurrentUser, getEvents as getLocalEvents, type EventItem, updateUser } from '@/lib/storage';
import { UserAvatar } from '@/components/UserAvatar';
import { ALL_INTERESTS } from '@/lib/interests';
import TopBar from '@/components/TopBar';
import BottomNav from '@/components/BottomNav';
import EventCard from '@/components/EventCard';
import AppToast from '@/components/AppToast';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, Link } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import { Sparkles, Users, MapPin, Calendar, Music, Cpu, Utensils, Dumbbell, Palette, Gamepad2, Film, BookOpen, Plane, Coffee, Network, Leaf, LayoutGrid, SlidersHorizontal, X, ArrowRight, UserPlus, Trophy } from 'lucide-react';
import { getApiUrl } from '@/lib/api';
import { getAuthToken } from '@/lib/auth';
import { extractCityFromLocation, getEventCities } from '@/lib/eventLocation';
import { isEventUpcoming, eventStartMs } from '@/lib/eventTime';
import { useMaxPrice, useFavorites, useEvents, useRecommendations, useMyEvents, useJoinedEvents } from '@/lib/queries';
import { invalidate, invalidatePrefix, cachedFetch, TTL } from '@/lib/queryCache';
import { userProfilePath } from '@/lib/friendsApi';

const EMPTY_EVENTS: EventItem[] = [];
const EMPTY_SET = new Set<string>();
const INTEREST_PROMPT_DISMISSED_KEY = 'event_interest_prompt_dismissed';

const SUGGESTIONS_PATH = '/api/friends/suggestions';
const MAX_SUGGESTIONS = 5;
const PAGE = 6;

type SuggestedUser = {
  id: string;
  username?: string | null;
  full_name?: string | null;
  display_name?: string | null;
  avatar_url?: string | null;
};

const FRIEND_LIST_PATHS = ['/api/friends'];
const REQUEST_PATHS = ['/api/friends/requests/sent', '/api/friends/requests/incoming'];

const INTEREST_EMOJI: Record<string, string> = {
  Music: '🎵', Sports: '⚽', Gaming: '🎮', Movies: '🎬', Study: '📚', Travel: '✈️', Tech: '💻',
  Art: '🎨', Fitness: '💪', Coffee: '☕', Networking: '🤝', Food: '🍕', Wellness: '🧘',
};

const CATS = [
  { id: 'All',       icon: LayoutGrid, iconColor: '#94a3b8', activeBg: 'rgba(148,163,184,0.15)', activeBorderColor: 'rgba(148,163,184,0.5)' },
  { id: 'Music',     icon: Music,      iconColor: '#a78bfa', activeBg: 'rgba(167,139,250,0.15)', activeBorderColor: 'rgba(167,139,250,0.5)' },
  { id: 'Tech',      icon: Cpu,        iconColor: '#60a5fa', activeBg: 'rgba(96,165,250,0.15)',  activeBorderColor: 'rgba(96,165,250,0.5)'  },
  { id: 'Food',      icon: Utensils,   iconColor: '#fb923c', activeBg: 'rgba(251,146,60,0.15)',  activeBorderColor: 'rgba(251,146,60,0.5)'  },
  { id: 'Fitness',   icon: Dumbbell,   iconColor: '#4ade80', activeBg: 'rgba(74,222,128,0.15)',  activeBorderColor: 'rgba(74,222,128,0.5)'  },
  { id: 'Art',       icon: Palette,    iconColor: '#f472b6', activeBg: 'rgba(244,114,182,0.15)', activeBorderColor: 'rgba(244,114,182,0.5)' },
  { id: 'Gaming',    icon: Gamepad2,   iconColor: '#818cf8', activeBg: 'rgba(129,140,248,0.15)', activeBorderColor: 'rgba(129,140,248,0.5)' },
  { id: 'Sports',    icon: Trophy,     iconColor: '#34d399', activeBg: 'rgba(52,211,153,0.15)',  activeBorderColor: 'rgba(52,211,153,0.5)'  },
  { id: 'Movies',    icon: Film,       iconColor: '#f87171', activeBg: 'rgba(248,113,113,0.15)', activeBorderColor: 'rgba(248,113,113,0.5)' },
  { id: 'Study',     icon: BookOpen,   iconColor: '#facc15', activeBg: 'rgba(250,204,21,0.15)',  activeBorderColor: 'rgba(250,204,21,0.5)'  },
  { id: 'Travel',    icon: Plane,      iconColor: '#38bdf8', activeBg: 'rgba(56,189,248,0.15)',  activeBorderColor: 'rgba(56,189,248,0.5)'  },
  { id: 'Coffee',    icon: Coffee,     iconColor: '#fbbf24', activeBg: 'rgba(251,191,36,0.15)',  activeBorderColor: 'rgba(251,191,36,0.5)'  },
  { id: 'Networking',icon: Network,    iconColor: '#22d3ee', activeBg: 'rgba(34,211,238,0.15)',  activeBorderColor: 'rgba(34,211,238,0.5)'  },
  { id: 'Wellness',  icon: Leaf,       iconColor: '#2dd4bf', activeBg: 'rgba(45,212,191,0.15)',  activeBorderColor: 'rgba(45,212,191,0.5)'  },
] as const;

function toArray(body: unknown): any[] {
  if (Array.isArray(body)) return body;
  if (body && typeof body === 'object') {
    for (const v of Object.values(body as Record<string, unknown>)) {
      if (Array.isArray(v)) return v;
    }
  }
  return [];
}

function collectUserIds(body: unknown, selfId: string | undefined, rowsAreUsers: boolean): string[] {
  const ids: string[] = [];
  for (const item of toArray(body)) {
    if (!item || typeof item !== 'object') continue;
    const o = item as Record<string, any>;
    const found = [
      o.user?.id, o.friend?.id, o.sender?.id, o.receiver?.id, o.requester?.id, o.addressee?.id,
      o.user_id, o.friend_id, o.sender_id, o.receiver_id, o.requester_id, o.addressee_id,
    ].filter((v): v is string => typeof v === 'string');
    if (found.length === 0 && rowsAreUsers && typeof o.id === 'string') found.push(o.id);
    for (const id of found) if (id !== selfId) ids.push(id);
  }
  return ids;
}

async function fetchExcludedIds(token: string, selfId: string | undefined): Promise<string[]> {
  const jobs = [
    ...FRIEND_LIST_PATHS.map((p) => ({ path: p, rowsAreUsers: true })),
    ...REQUEST_PATHS.map((p) => ({ path: p, rowsAreUsers: false })),
  ];
  const results = await Promise.all(
    jobs.map(async ({ path, rowsAreUsers }) => {
      try {
        const res = await fetch(getApiUrl(path), {
          headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
        });
        if (!res.ok) return [] as string[];
        return collectUserIds(await res.json().catch(() => null), selfId, rowsAreUsers);
      } catch {
        return [] as string[];
      }
    }),
  );
  return results.flat();
}

function SectionHeader({
  icon: Icon, title, badge, collapsed, onToggle,
}: { icon: LucideIcon; title: string; badge?: string; collapsed?: boolean; onToggle?: () => void }) {
  return (
    <button type="button" onClick={onToggle} className="flex w-full items-center gap-2.5 pt-5 pb-3 group">
      <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/15 group-hover:bg-primary/25 transition-colors shrink-0 shadow-sm">
        <Icon className="h-4 w-4 text-primary" />
      </div>
      <h2 className="text-base font-bold text-foreground tracking-tight">{title}</h2>
      {badge && <span className="ml-1.5 rounded-full gradient-primary px-2.5 py-0.5 text-[10px] font-bold text-primary-foreground shadow-glow">{badge}</span>}
      {collapsed !== undefined && onToggle && (
        <motion.span className="ml-auto text-muted-foreground text-sm" animate={{ rotate: collapsed ? -90 : 0 }} transition={{ duration: 0.2 }}>▾</motion.span>
      )}
    </button>
  );
}

export default function HomePage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [budgetMin, setBudgetMin] = useState(0);
  const [budgetMax, setBudgetMax] = useState(500);
  const [filterDate, setFilterDate] = useState('');
  const [debouncedDate, setDebouncedDate] = useState('');
  const [selectedCity, setSelectedCity] = useState('');
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' as 'success' | 'error' });
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [visibleAll, setVisibleAll] = useState(PAGE);
  const [showFilterModal, setShowFilterModal] = useState(false);

  const today = new Date();
  const minDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  const [currentUser, setCurrentUser] = useState(getCurrentUser());
  const [showInterestPrompt, setShowInterestPrompt] = useState(false);
  const [pickedInterests, setPickedInterests] = useState<string[]>([]);
  const [savingInterests, setSavingInterests] = useState(false);
  const [profileLoaded, setProfileLoaded] = useState(false);

  const [suggestedUsers, setSuggestedUsers] = useState<SuggestedUser[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(true);
  const [addingFriendId, setAddingFriendId] = useState<string | null>(null);

  const user = currentUser;
  const userId = user?.id;

  const { data: maxPriceData } = useMaxPrice();
  const { data: favoriteIdsData } = useFavorites(userId);
  const { data: eventsData, isLoading: eventsLoading } = useEvents({
    category: category !== 'All' ? category : undefined,
    search: debouncedSearch || undefined,
    event_date: debouncedDate || undefined,
  });
  const { data: recommendationsData, isLoading: recsLoading } = useRecommendations(
    userId,
    Boolean(user?.interests?.length),
  );
  const { data: myEventsData, isLoading: myEventsLoading } = useMyEvents(userId);
  const { data: joinedEventsData, isLoading: joinedEventsLoading } = useJoinedEvents(userId);

  // Only treat a query as "loading" when there is nothing to show yet.
  // Cached data renders instantly and refreshes silently in the background.
  const eventsInitialLoading = eventsLoading && eventsData === undefined;
  const recsInitialLoading = recsLoading && recommendationsData === undefined;
  const upcomingInitialLoading =
    (myEventsLoading && myEventsData === undefined) || (joinedEventsLoading && joinedEventsData === undefined);

  const maxPrice = maxPriceData?.max_price ?? 500;
  const favoriteIds = favoriteIdsData ?? EMPTY_SET;
  const apiEvents = eventsData ?? EMPTY_EVENTS;
  const interestRecommendations = recommendationsData ?? EMPTY_EVENTS;

  const friendsKey = Array.isArray(user?.friends) ? user.friends.join(',') : '';

  // ---------- Suggestions (cached) ----------
  const loadSuggestions = useCallback(async () => {
    const token = getAuthToken();
    if (!token || !userId) { setSuggestedUsers([]); setSuggestionsLoading(false); return; }
    try {
      const [body, excludedIds] = await Promise.all([
        cachedFetch(
          `${SUGGESTIONS_PATH}:${userId}`,
          async () => {
            const res = await fetch(getApiUrl(SUGGESTIONS_PATH), {
              headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
            });
            if (!res.ok) throw new Error('Failed to load suggestions');
            return res.json().catch(() => null);
          },
          TTL.MEDIUM,
        ),
        cachedFetch(`/api/friends/excluded:${userId}`, () => fetchExcludedIds(token, userId), TTL.MEDIUM),
      ]);

      const blocked = new Set<string>(excludedIds as string[]);
      blocked.add(userId);
      friendsKey.split(',').filter(Boolean).forEach((id) => blocked.add(id));

      const users: SuggestedUser[] = toArray(body)
        .map((item) => (item && typeof item === 'object' && 'user' in item ? item.user : item))
        .filter((u): u is SuggestedUser => Boolean(u && u.id))
        .filter((u) => !blocked.has(u.id))
        .filter((u) => Boolean(u.display_name || u.full_name || u.username));
      setSuggestedUsers(users.slice(0, MAX_SUGGESTIONS));
    } catch {
      setSuggestedUsers([]);
    } finally {
      setSuggestionsLoading(false);
    }
  }, [userId, friendsKey]);

  useEffect(() => {
    if (userId) loadSuggestions();
    else { setSuggestedUsers([]); setSuggestionsLoading(false); }
  }, [userId, loadSuggestions]);

  const handleAddFriend = async (receiverId: string) => {
    const token = getAuthToken();
    if (!token) {
      setToast({ show: true, message: 'Please log in first', type: 'error' });
      return;
    }
    setAddingFriendId(receiverId);
    try {
      const res = await fetch(getApiUrl('/api/friends/requests'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ receiver_id: receiverId }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Failed to send friend request');
      }
      setToast({ show: true, message: 'Friend request sent', type: 'success' });
      setSuggestedUsers((prev) => prev.filter((p) => p.id !== receiverId));
      // The "excluded" list changed (a new sent request), so drop its cache.
      invalidate(`/api/friends/excluded:${userId ?? ''}`);
      invalidatePrefix('/api/friends');
    } catch (e: any) {
      setToast({ show: true, message: e?.message || 'Could not send request', type: 'error' });
    } finally {
      setAddingFriendId(null);
    }
  };

  // ---------- Budget bounds follow the API max ----------
  useEffect(() => {
    if (maxPriceData?.max_price) {
      setBudgetMax(maxPriceData.max_price);
      setBudgetMin(0);
    }
  }, [maxPriceData?.max_price]);

  // ---------- Keep user in sync with storage ----------
  useEffect(() => {
    const syncUser = () => setCurrentUser(getCurrentUser());
    window.addEventListener('eventapp:user-updated', syncUser);
    return () => window.removeEventListener('eventapp:user-updated', syncUser);
  }, []);

  const toggleSection = (key: string) => setCollapsed((prev) => ({ ...prev, [key]: !prev[key] }));

  // ---------- Profile (cached, shares its key with ProfilePage) ----------
  useEffect(() => {
    if (!userId) return;
    const token = getAuthToken();
    if (!token) {
      setProfileLoaded(true);
      return;
    }

    let cancelled = false;

    cachedFetch(
      `/api/profile/me:${userId}`,
      async () => {
        const res = await fetch(getApiUrl('/api/profile/me'), {
          headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
        });
        if (!res.ok) throw new Error('Failed to fetch profile');
        return res.json();
      },
      TTL.LONG,
    )
      .then((data: Record<string, unknown>) => {
        if (cancelled) return;
        const profile = (data.data || data.user || data) as Record<string, unknown>;
        const apiInterests = (Array.isArray(profile.interests) ? profile.interests : []) as string[];
        const local = getCurrentUser();
        const sameInterests = JSON.stringify(local?.interests ?? []) === JSON.stringify(apiInterests);
        // Only write + re-render when something actually changed.
        if (!sameInterests) {
          updateUser({
            interests: apiInterests,
            avatar: typeof profile.avatar_url === 'string' ? profile.avatar_url : (local?.avatar || local?.profilePhoto),
            name: typeof profile.full_name === 'string' ? profile.full_name : local?.name,
          });
          setCurrentUser(getCurrentUser());
        }
      })
      .catch(() => { /* fall back to locally stored user */ })
      .finally(() => {
        if (!cancelled) setProfileLoaded(true);
      });

    return () => { cancelled = true; };
  }, [userId]);

  // ---------- Interest prompt (waits for profile, never blocks the page) ----------
  useEffect(() => {
    if (!userId || !profileLoaded) {
      setShowInterestPrompt(false);
      return;
    }
    if (Array.isArray(user?.interests) && user.interests.length > 0) {
      setShowInterestPrompt(false);
      return;
    }
    try {
      const raw = window.localStorage.getItem(INTEREST_PROMPT_DISMISSED_KEY);
      const parsed = raw ? (JSON.parse(raw) as Record<string, boolean>) : {};
      if (parsed[userId]) {
        setShowInterestPrompt(false);
        return;
      }
    } catch { /* ignore */ }

    setShowInterestPrompt(true);
  }, [userId, user?.interests, profileLoaded]);

  const handleSkipInterestPrompt = () => {
    if (userId) {
      try {
        const raw = window.localStorage.getItem(INTEREST_PROMPT_DISMISSED_KEY);
        const parsed = raw ? (JSON.parse(raw) as Record<string, boolean>) : {};
        parsed[userId] = true;
        window.localStorage.setItem(INTEREST_PROMPT_DISMISSED_KEY, JSON.stringify(parsed));
      } catch { /* ignore */ }
    }
    setShowInterestPrompt(false);
  };

  const handleSaveInterests = async () => {
    if (pickedInterests.length === 0) return;
    setSavingInterests(true);
    try {
      const token = getAuthToken();
      if (token) {
        const res = await fetch(getApiUrl('/api/profile/me'), {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ interests: pickedInterests }),
        });
        if (!res.ok) throw new Error('Failed to save interests');
        invalidatePrefix('/api/profile');
      }
      updateUser({ interests: pickedInterests });
      window.dispatchEvent(new CustomEvent('eventapp:user-updated'));
      setShowInterestPrompt(false);
    } catch {
      setToast({ show: true, message: 'Could not save interests. Try again.', type: 'error' });
    } finally {
      setSavingInterests(false);
    }
  };

  // ---------- Debounce ----------
  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(search.trim()), 350);
    return () => window.clearTimeout(t);
  }, [search]);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedDate(filterDate.trim()), 350);
    return () => window.clearTimeout(t);
  }, [filterDate]);

  useEffect(() => {
    setVisibleAll(PAGE);
  }, [budgetMin, budgetMax, category, debouncedDate, selectedCity, debouncedSearch]);

  // ---------- Derived data ----------
  const events = useMemo(() => {
    const local = getLocalEvents().filter((e) => !e.isDraft);
    const byId = new Map<string, EventItem>();
    [...apiEvents, ...local].filter(isEventUpcoming).forEach((e) => byId.set(e.id, e));
    return Array.from(byId.values());
  }, [apiEvents]);

  const availableCities = useMemo(() => getEventCities(events), [events]);

  const upcomingForYou = useMemo(() => {
    const combined = [...(myEventsData ?? []), ...(joinedEventsData ?? [])];
    const byId = new Map<string, EventItem>();
    combined.forEach((e) => byId.set(e.id, e));
    return Array.from(byId.values())
      .filter((e) => isEventUpcoming(e) && String(e.status || '').toLowerCase() !== 'cancelled')
      .sort((a, b) => eventStartMs(a) - eventStartMs(b));
  }, [myEventsData, joinedEventsData]);

  const applyFilters = useCallback(
    (list: EventItem[]) =>
      list.filter((e) => {
        if (!isEventUpcoming(e)) return false;
        if (e.budget < budgetMin || e.budget > budgetMax) return false;
        if (category !== 'All' && e.category !== category) return false;
        if (debouncedDate && e.date !== debouncedDate) return false;
        if (selectedCity && extractCityFromLocation(e.location || '') !== selectedCity) return false;
        return true;
      }),
    [budgetMin, budgetMax, category, debouncedDate, selectedCity],
  );

  const filtered = useMemo(() => applyFilters(events), [events, applyFilters]);
  const filteredRecommendations = useMemo(
    () => applyFilters(interestRecommendations),
    [interestRecommendations, applyFilters],
  );

  const friendActivity = useMemo(() => {
    const firstEvent = events[0];
    if (!user?.friends?.length || !firstEvent) return [];
    return user.friends
      .slice(0, 4)
      .map((fId) => ({ friend: { id: fId, name: 'Friend', profilePhoto: '', avatar: '' }, event: firstEvent }));
  }, [user, events]);

  const handleJoin = (id: string) => {
    if (!user) { navigate('/login'); return; }
    if (user.role === 'organizer') {
      setToast({ show: true, message: 'Organizers cannot join events', type: 'error' });
      return;
    }
    const selectedEvent = events.find((event) => event.id === id) ?? null;
    navigate(`/event/${id}`, { state: selectedEvent ? { event: selectedEvent } : undefined });
  };

  const activeFiltersCount =
    (filterDate ? 1 : 0) + (selectedCity ? 1 : 0) + (budgetMin > 0 || budgetMax < maxPrice ? 1 : 0);

  const clearFilters = () => {
    setFilterDate('');
    setSelectedCity('');
    setBudgetMin(0);
    setBudgetMax(maxPrice);
  };

  return (
    <div className="min-h-screen bg-background pb-20 relative">
      <AppToast message={toast.message} type={toast.type} show={toast.show} onClose={() => setToast((t) => ({ ...t, show: false }))} />

      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-md border-b border-border/40">
        <TopBar search={search} onSearchChange={setSearch} />

        <div className="mx-auto max-w-7xl px-4 pt-2 pb-3">
          <div className="flex items-center gap-2">
            <div className="flex flex-wrap flex-1 gap-1.5">
              {CATS.map(({ id, icon: Icon, iconColor, activeBg, activeBorderColor }) => {
                const active = category === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setCategory(id)}
                    style={active ? { background: activeBg, borderColor: activeBorderColor, color: iconColor } : { background: activeBg.replace('0.15', '0.08'), borderColor: activeBorderColor.replace('0.5', '0.25') }}
                    className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-all active:scale-95 ${
                      active ? 'border-transparent shadow-sm' : 'border-transparent text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5 shrink-0" style={{ color: iconColor }} />
                    {id}
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => setShowFilterModal(true)}
              className="relative shrink-0 flex items-center justify-center h-9 w-9 rounded-full glass-card hover:bg-secondary transition-colors self-start"
              aria-label="Open filters"
            >
              <SlidersHorizontal className="h-4 w-4 text-foreground" />
              {activeFiltersCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full gradient-primary text-[9px] font-bold text-primary-foreground shadow-glow">
                  {activeFiltersCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Two-column dashboard layout */}
      <main className="mx-auto max-w-7xl px-4 pt-6">
        <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6 items-start">

          {/* Left Sidebar */}
          <aside className="space-y-4">
            {user && (
              <div className="rounded-2xl bg-indigo-500/10 border border-indigo-500/20 p-4 space-y-3 shadow-lg shadow-black/5 backdrop-blur-sm">
                <Link to="/profile" className="flex items-center justify-between group">
                  <div className="flex items-center gap-3 min-w-0">
                    <UserAvatar src={user.avatar || user.profilePhoto} seed={user.id} name={user.name} size="md" className="ring-2 ring-indigo-500/40 shrink-0" />
                    <div className="min-w-0">
                      <h2 className="text-sm font-bold text-foreground truncate group-hover:text-indigo-500 transition-colors">{user.name}</h2>
                      <p className="text-[10px] text-muted-foreground">View profile</p>
                    </div>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-indigo-500 transition-colors shrink-0" />
                </Link>
              </div>
            )}

            {user && (
              <div className="rounded-2xl bg-secondary/40 border border-border/80 p-4 space-y-3.5 shadow-lg shadow-black/5 backdrop-blur-sm">
                <div className="flex items-center justify-between pb-1 border-b border-border/40">
                  <div className="flex items-center gap-2">
                    <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-primary/20">
                      <Calendar className="h-3.5 w-3.5 text-primary" />
                    </div>
                    <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">Upcoming events</h3>
                  </div>
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">{upcomingForYou.length} events</span>
                </div>

                {upcomingForYou.length > 0 ? (
                  <div className="space-y-2">
                    {upcomingForYou.slice(0, 3).map((event) => (
                      <button
                        type="button"
                        key={event.id}
                        onClick={() => navigate(`/event/${event.id}`, { state: { event } })}
                        className="block w-full text-left p-3 rounded-xl bg-background/60 border border-border/40 hover:border-primary/50 transition-all group"
                      >
                        <p className="text-xs font-semibold text-foreground line-clamp-1 group-hover:text-primary transition-colors">{event.title}</p>
                        <p className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
                          <Calendar className="h-3 w-3 opacity-70" /> {event.date} · {event.time}
                        </p>
                      </button>
                    ))}
                  </div>
                ) : upcomingInitialLoading ? (
                  <div className="h-16 shimmer rounded-xl" />
                ) : (
                  <div className="text-center py-6 space-y-2.5">
                    <p className="text-xs text-muted-foreground font-medium">Nothing planned yet</p>
                    <button
                      type="button"
                      onClick={() => document.getElementById('all-events-section')?.scrollIntoView({ behavior: 'smooth' })}
                      className="rounded-full gradient-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground shadow-glow active:scale-95 transition-transform"
                    >
                      Find events
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* People You May Know */}
            {user && (
              <div className="rounded-2xl bg-indigo-500/10 border border-indigo-500/20 p-4 space-y-3.5 shadow-lg shadow-black/5 backdrop-blur-sm">
                <div className="flex items-center justify-between pb-1 border-b border-indigo-500/20">
                  <div className="flex items-center gap-2">
                    <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-indigo-500/20">
                      <Users className="h-3.5 w-3.5 text-indigo-500" />
                    </div>
                    <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">People you may know</h3>
                  </div>
                </div>

                {suggestionsLoading && suggestedUsers.length === 0 ? (
                  <div className="space-y-2.5" aria-busy="true">
                    <span className="sr-only">Loading suggestions...</span>
                    {Array.from({ length: 3 }).map((_, i) => (
                      <div key={i} className="flex items-center gap-2.5 p-2.5 rounded-xl bg-background/60 border border-border/40">
                        <div className="h-8 w-8 rounded-full shimmer shrink-0" />
                        <div className="flex-1 space-y-1.5">
                          <div className="h-3 w-3/4 rounded-full shimmer" />
                          <div className="h-2.5 w-1/2 rounded-full shimmer" />
                        </div>
                        <div className="h-7 w-7 rounded-full shimmer shrink-0" />
                      </div>
                    ))}
                  </div>
                ) : suggestedUsers.length > 0 ? (
                  <div className="space-y-2.5">
                    {suggestedUsers.map((person) => {
                      const displayName = person.full_name || person.display_name || person.username || 'User';
                      return (
                        <div key={person.id} className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-background/60 border border-border/40">
                          <button
                            type="button"
                            onClick={() => navigate(userProfilePath(person.id, user.id))}
                            className="flex items-center gap-2.5 min-w-0 cursor-pointer group flex-1 text-left bg-transparent border-none p-0"
                          >
                            <UserAvatar src={person.avatar_url || undefined} seed={person.id} name={displayName} size="sm" className="shrink-0" />
                            <div className="min-w-0">
                              <p className="text-xs font-semibold text-foreground truncate group-hover:text-indigo-500 transition-colors">{displayName}</p>
                              {person.username && (
                                <p className="text-[10px] text-muted-foreground truncate">@{person.username}</p>
                              )}
                            </div>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleAddFriend(person.id)}
                            disabled={addingFriendId === person.id}
                            className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500 hover:text-white transition-all active:scale-90 shrink-0 disabled:opacity-50"
                            title="Send friend request"
                            aria-label={`Send friend request to ${displayName}`}
                          >
                            <UserPlus className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground text-center py-2">No suggestions right now</p>
                )}
              </div>
            )}
          </aside>

          {/* Right Main Area */}
          <div className="space-y-6 min-w-0">
            {/* Friend Activity */}
            {friendActivity.length > 0 && (
              <div className="space-y-1">
                <SectionHeader icon={Users} title="Friend activity" collapsed={!!collapsed['friends']} onToggle={() => toggleSection('friends')} />
                {!collapsed['friends'] && (
                  <div className="space-y-3 rounded-2xl glass-card p-4">
                    {friendActivity.map((item, i) => (
                      <div key={i} className="flex items-center gap-3">
                        <UserAvatar src={item.friend.avatar || item.friend.profilePhoto} seed={item.friend.id} name={item.friend.name} size="sm" />
                        <p className="text-xs text-foreground"><span className="font-semibold">{item.friend.name}</span> joined <span className="font-medium text-primary">{item.event.title}</span></p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Interest-Based Discovery */}
            {user && (
              <div className="space-y-2">
                <SectionHeader icon={Sparkles} title="Based on your interests" />
                {user.interests?.length ? (
                  recsInitialLoading ? (
                    <div className="flex gap-4 overflow-hidden pt-1">
                      {Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className="w-[260px] sm:w-[280px] h-44 animate-pulse rounded-2xl glass-card shrink-0" />
                      ))}
                    </div>
                  ) : filteredRecommendations.length > 0 ? (
                    <div className="flex gap-4 overflow-x-auto pb-4 pt-1 snap-x custom-scrollbar">
                      {filteredRecommendations.map((event) => (
                        <div key={event.id} className="w-[260px] sm:w-[280px] shrink-0 snap-start scale-[0.95] origin-top-left">
                          <EventCard event={event} onJoin={handleJoin} isFavorite={favoriteIds.has(event.id)} />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-2xl glass-card px-4 py-5 text-xs text-muted-foreground text-center">
                      No events match your interests yet. Update them from your profile to discover more.
                    </div>
                  )
                ) : (
                  <div className="rounded-2xl glass-card px-4 py-5 text-xs text-muted-foreground text-center">
                    Add interests in your profile to get personalized events.
                  </div>
                )}
              </div>
            )}

            {/* All Events */}
            <div id="all-events-section" className="space-y-2">
              <SectionHeader icon={Sparkles} title="All events" collapsed={!!collapsed['events']} onToggle={() => toggleSection('events')} />
              {!collapsed['events'] && (
                eventsInitialLoading ? (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 pt-2">
                    <span className="sr-only">Loading the latest events...</span>
                    {Array.from({ length: 6 }).map((_, i) => (
                      <div key={i} className="rounded-2xl glass-card overflow-hidden">
                        <div className="h-40 shimmer" />
                        <div className="p-4 space-y-2">
                          <div className="h-3.5 w-3/4 rounded-full shimmer" />
                          <div className="h-3 w-1/2 rounded-full shimmer" />
                          <div className="h-3 w-2/3 rounded-full shimmer" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      {filtered.slice(0, visibleAll).map((event) => (
                        <EventCard key={event.id} event={event} onJoin={handleJoin} isFavorite={favoriteIds.has(event.id)} />
                      ))}
                    </div>

                    {(visibleAll < filtered.length || visibleAll > PAGE) && (
                      <div className="flex gap-2 pt-2">
                        {visibleAll < filtered.length && (
                          <button
                            type="button"
                            onClick={() => setVisibleAll((v) => v + PAGE)}
                            className="flex-1 rounded-xl border border-border py-2.5 text-sm font-medium text-primary hover:bg-secondary/50 transition-colors"
                          >
                            View more · {filtered.length - visibleAll} remaining
                          </button>
                        )}
                        {visibleAll > PAGE && (
                          <button
                            type="button"
                            onClick={() => setVisibleAll(PAGE)}
                            className="flex-1 rounded-xl border border-border py-2.5 text-sm font-medium text-muted-foreground hover:bg-secondary/50 transition-colors"
                          >
                            Show less
                          </button>
                        )}
                      </div>
                    )}

                    {filtered.length === 0 && (
                      <div className="rounded-3xl py-16 px-6 text-center glass-card space-y-3">
                        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-secondary/60">
                          <Sparkles className="h-6 w-6 text-muted-foreground" />
                        </div>
                        <p className="text-sm font-semibold text-foreground">No events match your filters.</p>
                        <p className="text-xs text-muted-foreground">Try a different date, location, or budget.</p>
                        <button
                          type="button"
                          onClick={() => { setCategory('All'); clearFilters(); }}
                          className="mt-1 rounded-xl border border-border px-4 py-2 text-xs font-semibold text-primary hover:bg-secondary/50 transition-colors"
                        >
                          Clear filters
                        </button>
                      </div>
                    )}
                  </>
                )
              )}
            </div>
          </div>
        </div>
      </main>

      <BottomNav />

      {/* Filter Popup Modal */}
      <AnimatePresence>
        {showFilterModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-background/80 backdrop-blur-sm px-4 pb-4 sm:pb-0"
          >
            <motion.div
              initial={{ opacity: 0, y: 48 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 48 }}
              transition={{ type: 'spring', stiffness: 280, damping: 26 }}
              className="w-full max-w-sm rounded-3xl glass-card overflow-hidden bg-background border border-border shadow-xl"
            >
              <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b border-border/40">
                <h3 className="text-base font-bold text-foreground">Filters</h3>
                <button
                  type="button"
                  onClick={() => setShowFilterModal(false)}
                  aria-label="Close filters"
                  className="rounded-full p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="p-6 space-y-4">
                <label className="flex flex-col gap-1.5">
                  <span className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                    <Calendar className="h-3.5 w-3.5 text-primary" /> Event date
                  </span>
                  <input
                    type="date"
                    value={filterDate}
                    min={minDate}
                    onChange={(e) => setFilterDate(e.target.value)}
                    className="rounded-xl bg-secondary px-3.5 py-2.5 text-xs text-foreground outline-none focus:ring-2 focus:ring-primary/40 border border-border/50"
                  />
                </label>

                <label className="flex flex-col gap-1.5">
                  <span className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                    <MapPin className="h-3.5 w-3.5 text-accent" /> Location
                  </span>
                  <select
                    id="home-city-filter"
                    value={selectedCity}
                    onChange={(e) => setSelectedCity(e.target.value)}
                    className="rounded-xl bg-secondary px-3.5 py-2.5 text-xs text-foreground outline-none focus:ring-2 focus:ring-primary/40 border border-border/50"
                    aria-label="Filter events by location"
                  >
                    <option value="">All locations</option>
                    {availableCities.map((city) => (
                      <option key={city} value={city}>{city}</option>
                    ))}
                  </select>
                </label>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-muted-foreground">Budget range</span>
                    <span className="text-xs font-medium text-foreground">€{budgetMin} to €{budgetMax}</span>
                  </div>
                  <div className="relative h-6 flex items-center px-1">
                    <div className="absolute inset-x-0 h-1.5 rounded-full bg-secondary" />
                    <div
                      className="absolute h-1.5 rounded-full bg-primary pointer-events-none"
                      style={{
                        left: `${maxPrice > 0 ? (budgetMin / maxPrice) * 100 : 0}%`,
                        right: `${maxPrice > 0 ? 100 - (budgetMax / maxPrice) * 100 : 0}%`,
                      }}
                    />
                    <input type="range" min={0} max={maxPrice} value={budgetMin}
                      aria-label="Minimum budget"
                      onChange={(e) => setBudgetMin(Math.min(Number(e.target.value), budgetMax - 1))}
                      className="dual-range-input absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      style={{ zIndex: budgetMin > maxPrice * 0.9 ? 5 : 3 }}
                    />
                    <input type="range" min={0} max={maxPrice} value={budgetMax}
                      aria-label="Maximum budget"
                      onChange={(e) => setBudgetMax(Math.max(Number(e.target.value), budgetMin + 1))}
                      className="dual-range-input absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      style={{ zIndex: 4 }}
                    />
                    <div className="absolute h-3.5 w-3.5 rounded-full bg-primary border-2 border-background shadow pointer-events-none"
                      style={{ left: `calc(${maxPrice > 0 ? (budgetMin / maxPrice) * 100 : 0}% - 7px)` }} />
                    <div className="absolute h-3.5 w-3.5 rounded-full bg-primary border-2 border-background shadow pointer-events-none"
                      style={{ left: `calc(${maxPrice > 0 ? (budgetMax / maxPrice) * 100 : 100}% - 7px)` }} />
                  </div>
                </div>
              </div>

              <div className="px-6 pb-6 pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={clearFilters}
                  className="flex-1 rounded-2xl border border-border bg-secondary py-3 text-xs font-semibold text-foreground hover:bg-secondary/80 transition-colors"
                >
                  Clear all
                </button>
                <button
                  type="button"
                  onClick={() => setShowFilterModal(false)}
                  className="flex-1 rounded-2xl gradient-primary py-3 text-xs font-bold text-primary-foreground shadow-glow active:scale-[0.98] transition-transform"
                >
                  Apply filters
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Interest selection modal */}
      <AnimatePresence>
        {showInterestPrompt && user && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-background/80 backdrop-blur-sm px-4 pb-4 sm:pb-0"
          >
            <motion.div
              initial={{ opacity: 0, y: 48 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 48 }}
              transition={{ type: 'spring', stiffness: 280, damping: 26 }}
              className="w-full max-w-sm rounded-3xl glass-card overflow-hidden"
            >
              <div className="px-6 pt-7 pb-5 text-center space-y-2">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl gradient-primary shadow-glow">
                  <Sparkles className="h-5 w-5 text-primary-foreground" />
                </div>
                <h2 className="text-lg font-bold text-foreground">What are you into?</h2>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Pick a few interests so we can show you events you'll love.
                </p>
              </div>

              <div className="px-5 pb-2 grid grid-cols-3 gap-2.5">
                {ALL_INTERESTS.map((interest) => {
                  const selected = pickedInterests.includes(interest);
                  return (
                    <button
                      key={interest}
                      type="button"
                      onClick={() =>
                        setPickedInterests((prev) =>
                          selected ? prev.filter((i) => i !== interest) : [...prev, interest],
                        )
                      }
                      className={`flex flex-col items-center gap-1.5 rounded-2xl border py-3 px-2 text-center transition-all active:scale-95 ${
                        selected
                          ? 'gradient-primary border-transparent text-primary-foreground shadow-glow'
                          : 'border-border/40 bg-secondary/50 text-muted-foreground hover:border-border hover:text-foreground'
                      }`}
                    >
                      <span className="text-xl leading-none">{INTEREST_EMOJI[interest] ?? '✨'}</span>
                      <span className="text-[11px] font-medium leading-tight">{interest}</span>
                    </button>
                  );
                })}
              </div>

              <div className="px-5 pt-4 pb-6 flex gap-3">
                <button
                  type="button"
                  onClick={handleSkipInterestPrompt}
                  className="flex-1 rounded-2xl border border-border bg-secondary py-3 text-sm font-semibold text-foreground hover:bg-secondary/80 transition-colors active:scale-[0.98]"
                >
                  Skip
                </button>
                <button
                  type="button"
                  disabled={pickedInterests.length === 0 || savingInterests}
                  onClick={handleSaveInterests}
                  className="flex-1 rounded-2xl gradient-primary py-3 text-sm font-bold text-primary-foreground shadow-glow disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98] transition-transform"
                >
                  {savingInterests ? 'Saving…' : pickedInterests.length > 0 ? `Done (${pickedInterests.length})` : 'Done'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
import { useState, useMemo, useEffect, useCallback } from 'react';
import { getCurrentUser, getEvents as getLocalEvents, type EventItem, updateUser } from '@/lib/storage';
import TopBar from '@/components/TopBar';
import BottomNav from '@/components/BottomNav';
import AppToast from '@/components/AppToast';
import { useNavigate } from 'react-router-dom';
import { SlidersHorizontal } from 'lucide-react';
import CategoryPills from '@/components/CategoryPills';
import { getApiUrl } from '@/lib/api';
import { getAuthToken } from '@/lib/auth';
import { extractCityFromLocation, getEventCities } from '@/lib/eventLocation';
import { isEventUpcoming, eventStartMs } from '@/lib/eventTime';
import { EVENTS_CHANGED_EVENT } from '@/lib/realtimeEvents';
import { useMaxPrice, useFavorites, useEvents, useRecommendations, useMyEvents, useJoinedEvents } from '@/lib/queries';
import { invalidate, invalidatePrefix, cachedFetch, TTL } from '@/lib/queryCache';
import { applyMyProfileToSession, fetchMyProfile } from '@/lib/profileMe';
import { FRIENDS_CHANGED_EVENT, fetchSentRequests, sendFriendRequest } from '@/lib/friendsApi';
import { useFriendsGoingEvents } from '@/hooks/useFriendsGoing';
import HomeFeed from '@/pages/home/HomeFeed';
import HomeFilterModal from '@/pages/home/HomeFilterModal';
import HomeInterestPrompt from '@/pages/home/HomeInterestPrompt';
import HomeSidebar from '@/pages/home/HomeSidebar';
import {
  EMPTY_EVENTS,
  EMPTY_SET,
  INTEREST_PROMPT_DISMISSED_KEY,
  MAX_SUGGESTIONS,
  PAGE,
  SUGGESTIONS_PATH,
  UPCOMING_PREVIEW,
  type SuggestedUser,
  fetchExcludedIds,
  toArray,
} from '@/pages/home/homeModel';

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
  const [eventsEpoch, setEventsEpoch] = useState(0);
  const [upcomingLimit, setUpcomingLimit] = useState(UPCOMING_PREVIEW);
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
      const [body, excludedIds, sent] = await Promise.all([
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
        fetchSentRequests(1, 50).catch(() => ({ data: [] as Array<{ user?: { id?: string } }> })),
      ]);

      const blocked = new Set<string>(excludedIds as string[]);
      blocked.add(userId);
      friendsKey.split(',').filter(Boolean).forEach((id) => blocked.add(id));
      for (const row of sent.data) {
        const id = row.user?.id;
        if (typeof id === 'string' && id.trim()) blocked.add(id);
      }

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
    const refresh = () => {
      if (userId) {
        invalidate(`/api/friends/excluded:${userId}`);
        invalidatePrefix('/api/friends/requests');
        void loadSuggestions();
      }
    };
    window.addEventListener(FRIENDS_CHANGED_EVENT, refresh);
    return () => window.removeEventListener(FRIENDS_CHANGED_EVENT, refresh);
  }, [userId, loadSuggestions]);

  const handleAddFriend = async (receiverId: string) => {
    const token = getAuthToken();
    if (!token) {
      setToast({ show: true, message: 'Please log in first', type: 'error' });
      return;
    }
    setAddingFriendId(receiverId);
    try {
      await sendFriendRequest(receiverId);
      setToast({ show: true, message: 'Friend request sent', type: 'success' });
      setSuggestedUsers((prev) => prev.filter((p) => p.id !== receiverId));
      invalidate(`/api/friends/excluded:${userId ?? ''}`);
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

  useEffect(() => {
    const refresh = () => setEventsEpoch((n) => n + 1);
    window.addEventListener(EVENTS_CHANGED_EVENT, refresh);
    return () => window.removeEventListener(EVENTS_CHANGED_EVENT, refresh);
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

    fetchMyProfile(token)
      .then((data: unknown) => {
        if (cancelled) return;
        applyMyProfileToSession(data);
        setCurrentUser(getCurrentUser());
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

  const events = useMemo(() => {
    const local = getLocalEvents().filter((e) => !e.isDraft);
    const byId = new Map<string, EventItem>();
    // API rows win over localStorage so realtime refreshes are not clobbered.
    for (const e of [...local, ...apiEvents]) {
      if (!isEventUpcoming(e) || String(e.status || '').toLowerCase() === 'cancelled') continue;
      byId.set(e.id, e);
    }
    return Array.from(byId.values()).sort((a, b) => eventStartMs(a) - eventStartMs(b));
  }, [apiEvents, eventsEpoch]);

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
      if (String(e.status || '').toLowerCase() === 'cancelled') return false;
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

  const friendActivityEvents = useMemo(() => {
    const byId = new Map<string, EventItem>();
    for (const event of [...events, ...interestRecommendations, ...upcomingForYou]) {
      if (!isEventUpcoming(event) || String(event.status || '').toLowerCase() === 'cancelled') continue;
      byId.set(event.id, event);
    }
    return Array.from(byId.values()).sort((a, b) => eventStartMs(a) - eventStartMs(b));
  }, [events, interestRecommendations, upcomingForYou]);
  const {
    rows: friendsGoingEvents,
    loading: friendsGoingLoading,
    friendCount,
  } = useFriendsGoingEvents(user ? friendActivityEvents : EMPTY_EVENTS);

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

      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-md border-b border-border/40">
        <TopBar search={search} onSearchChange={setSearch} />

        <div className="mx-auto max-w-7xl px-4 pt-2 pb-3">
          <div className="flex items-center gap-2">
            <CategoryPills
              includeAll
              value={category}
              onChange={setCategory}
              className="flex-1"
              aria-label="Filter by category"
            />

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

      <main className="mx-auto max-w-7xl px-4 pt-6">
        <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6 items-start">
          {user ? (
            <HomeSidebar
              user={user}
              upcomingForYou={upcomingForYou}
              upcomingLimit={upcomingLimit}
              upcomingInitialLoading={upcomingInitialLoading}
              onUpcomingLimitChange={setUpcomingLimit}
              onOpenEvent={(event) => navigate(`/event/${event.id}`, { state: { event } })}
              suggestedUsers={suggestedUsers}
              suggestionsLoading={suggestionsLoading}
              addingFriendId={addingFriendId}
              onAddFriend={handleAddFriend}
              onOpenProfile={(path) => navigate(path)}
            />
          ) : (
            <aside className="space-y-4" />
          )}

          <HomeFeed
            showSocial={Boolean(user)}
            collapsed={collapsed}
            onToggleSection={toggleSection}
            friendsGoingLoading={friendsGoingLoading}
            friendsGoingEvents={friendsGoingEvents}
            friendCount={friendCount}
            hasInterests={Boolean(user?.interests?.length)}
            recsInitialLoading={recsInitialLoading}
            filteredRecommendations={filteredRecommendations}
            eventsInitialLoading={eventsInitialLoading}
            filtered={filtered}
            visibleAll={visibleAll}
            onVisibleAllChange={setVisibleAll}
            favoriteIds={favoriteIds}
            onJoin={handleJoin}
            onClearFilters={() => { setCategory('All'); clearFilters(); }}
          />
        </div>
      </main>

      <BottomNav />

      <HomeFilterModal
        open={showFilterModal}
        onClose={() => setShowFilterModal(false)}
        filterDate={filterDate}
        minDate={minDate}
        onFilterDateChange={setFilterDate}
        selectedCity={selectedCity}
        onSelectedCityChange={setSelectedCity}
        availableCities={availableCities}
        budgetMin={budgetMin}
        budgetMax={budgetMax}
        maxPrice={maxPrice}
        onBudgetMinChange={setBudgetMin}
        onBudgetMaxChange={setBudgetMax}
        onClearFilters={clearFilters}
      />

      <HomeInterestPrompt
        open={showInterestPrompt && Boolean(user)}
        pickedInterests={pickedInterests}
        savingInterests={savingInterests}
        onToggleInterest={(interest) =>
          setPickedInterests((prev) =>
            prev.includes(interest) ? prev.filter((i) => i !== interest) : [...prev, interest],
          )
        }
        onSkip={handleSkipInterestPrompt}
        onSave={() => void handleSaveInterests()}
      />
    </div>
  );
}

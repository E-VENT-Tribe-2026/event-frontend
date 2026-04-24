import { useState, useMemo, useEffect } from 'react';
import { getCurrentUser, getUsers, getEvents as getLocalEvents, type EventItem } from '@/lib/storage';
import { mapApiEventToItem, parseEventsApiList } from '@/lib/mapApiEvent';
import { UserAvatar } from '@/components/UserAvatar';
import { CATEGORIES } from '@/lib/seedData';
import TopBar from '@/components/TopBar';
import BottomNav from '@/components/BottomNav';
import EventCard from '@/components/EventCard';
import AppToast from '@/components/AppToast';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Sparkles, Users, MapPin, Calendar } from 'lucide-react';
import { getApiUrl } from '@/lib/api';
import { getAuthToken } from '@/lib/auth';
import { extractCityFromLocation, getEventCities } from '@/lib/eventLocation';
import { isEventUpcoming } from '@/lib/eventTime';

export default function HomePage() {
  const INTEREST_PROMPT_DISMISSED_KEY = 'event_interest_prompt_dismissed';
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [budgetMax, setBudgetMax] = useState(500);
  const [filterDate, setFilterDate] = useState('');
  const [debouncedDate, setDebouncedDate] = useState('');
  const [selectedCity, setSelectedCity] = useState('');
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' as 'success' | 'error' });
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [maxPrice, setMaxPrice] = useState(500);
  const [usingLocalFallback, setUsingLocalFallback] = useState(false);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const today = new Date();
  const minDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  // ── Favorites ────────────────────────────────────────────────────────────
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [interestRecommendations, setInterestRecommendations] = useState<EventItem[]>([]);
  const [interestRecommendationsLoading, setInterestRecommendationsLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState(getCurrentUser());
  const [interestsRefreshTick, setInterestsRefreshTick] = useState(0);
  const [showInterestPrompt, setShowInterestPrompt] = useState(false);

  const user = currentUser;
  const allUsers = getUsers();

  useEffect(() => {
    const syncUser = () => {
      setCurrentUser(getCurrentUser());
      setInterestsRefreshTick((tick) => tick + 1);
    };
    window.addEventListener('eventapp:user-updated', syncUser);
    return () => window.removeEventListener('eventapp:user-updated', syncUser);
  }, []);

  const toggleSection = (key: string) => setCollapsed(prev => ({ ...prev, [key]: !prev[key] }));

  useEffect(() => {
    if (!user?.id) {
      setShowInterestPrompt(false);
      return;
    }
    const hasInterests = Array.isArray(user.interests) && user.interests.length > 0;
    if (hasInterests) {
      try {
        const raw = window.localStorage.getItem(INTEREST_PROMPT_DISMISSED_KEY);
        const parsed = raw ? (JSON.parse(raw) as Record<string, boolean>) : {};
        if (parsed[user.id]) {
          delete parsed[user.id];
          window.localStorage.setItem(INTEREST_PROMPT_DISMISSED_KEY, JSON.stringify(parsed));
        }
      } catch {
        // ignore storage errors
      }
      setShowInterestPrompt(false);
      return;
    }
    let dismissedForUser = false;
    try {
      const raw = window.localStorage.getItem(INTEREST_PROMPT_DISMISSED_KEY);
      const parsed = raw ? (JSON.parse(raw) as Record<string, boolean>) : {};
      dismissedForUser = Boolean(parsed[user.id]);
    } catch {
      dismissedForUser = false;
    }
    setShowInterestPrompt(!dismissedForUser);
  }, [user?.id, interestsRefreshTick, user?.interests]);

  const handleSkipInterestPrompt = () => {
    if (user?.id) {
      try {
        const raw = window.localStorage.getItem(INTEREST_PROMPT_DISMISSED_KEY);
        const parsed = raw ? (JSON.parse(raw) as Record<string, boolean>) : {};
        parsed[user.id] = true;
        window.localStorage.setItem(INTEREST_PROMPT_DISMISSED_KEY, JSON.stringify(parsed));
      } catch {
        // ignore storage errors
      }
    }
    setShowInterestPrompt(false);
  };

  // ── 1. Load Max Price ──────────────────────────────────────────────────────
  useEffect(() => {
    fetch(getApiUrl('/api/events/max-price'))
      .then((res) => res.ok ? res.json() : Promise.reject())
      .then((data: { max_price: number }) => {
        setMaxPrice(data.max_price);
        setBudgetMax(data.max_price);
      })
      .catch(() => {});
  }, []);

  // ── 2. Load Favorites ──────────────────────────────────────────────────────
  useEffect(() => {
    const token = getAuthToken();
    if (!user || !token) return;

    fetch(getApiUrl('/api/favorites/all'), {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.ok ? res.json() : Promise.reject())
      .then((data: any[]) => {
        const ids = data.map(fav => fav.id || fav.event_id);
        setFavoriteIds(new Set(ids));
      })
      .catch(() => console.error("Failed to load favorites"));
  }, [user?.id, interestsRefreshTick]);

  // ── 3. Load Interest Recommendations ─────────────────────────────────────
  useEffect(() => {
    const token = getAuthToken();
    if (!user?.id || !token || !user.interests?.length) {
      setInterestRecommendations([]);
      setInterestRecommendationsLoading(false);
      return;
    }

    let cancelled = false;
    setInterestRecommendationsLoading(true);
    fetch(getApiUrl('/api/recommendations?limit=6'), {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data: { data?: unknown[] }) => {
        if (cancelled) return;
        const rows = Array.isArray(data.data) ? data.data : [];
        setInterestRecommendations(rows.map((row) => mapApiEventToItem(row as Record<string, unknown>)).filter(isEventUpcoming));
      })
      .catch(() => {
        if (!cancelled) setInterestRecommendations([]);
      })
      .finally(() => {
        if (!cancelled) setInterestRecommendationsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [user?.id, user?.interests, interestsRefreshTick]);

  // ── 4. Debouncing ─────────────────────────────────────────────────────────
  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(search.trim()), 350);
    return () => window.clearTimeout(t);
  }, [search]);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedDate(filterDate.trim()), 350);
    return () => window.clearTimeout(t);
  }, [filterDate]);

  // ── 5. Main Events Fetch ──────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams({ limit: '50', page: '1' });
    if (category !== 'All') params.set('category', category);
    if (debouncedSearch) params.set('search', debouncedSearch);
    if (debouncedDate) params.set('event_date', debouncedDate);

    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 8000);
    setLoading(true);

    fetch(getApiUrl(`/api/events?${params}`), { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error('Failed to load events'))))
      .then((data: unknown) => {
        if (cancelled) return;
        const list = parseEventsApiList(data).map(mapApiEventToItem);
        const local = getLocalEvents().filter((e) => !e.isDraft);
        const byId = new Map<string, EventItem>();
        [...list, ...local].filter(isEventUpcoming).forEach((e) => byId.set(e.id, e));
        setEvents(Array.from(byId.values()));
        setUsingLocalFallback(false);
      })
      .catch(() => {
        if (!cancelled) {
          const local = getLocalEvents().filter((e) => !e.isDraft && isEventUpcoming(e));
          setEvents(local);
          setUsingLocalFallback(true);
        }
      })
      .finally(() => {
        window.clearTimeout(timeout);
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [category, debouncedSearch, debouncedDate]);

  const availableCities = useMemo(() => getEventCities(events), [events]);

  // ── 6. Filtered Events logic ──────────────────────────────────────────────
  const filtered = useMemo(() => {
    return events.filter((e) => {
      if (!isEventUpcoming(e)) return false;
      if (e.budget > budgetMax) return false;
      if (category !== 'All' && e.category !== category) return false;
      if (debouncedDate && e.date !== debouncedDate) return false;
      const city = extractCityFromLocation(e.location || '');
      if (selectedCity && city !== selectedCity) return false;
      return true;
    });
  }, [events, budgetMax, category, debouncedDate, selectedCity]);

  const friendActivity = useMemo(() => {
    if (!user?.friends?.length) return [];
    return user.friends
      .map((fId) => {
        const friend = allUsers.find((u) => u.id === fId);
        if (!friend) return null;
        const joinedEvent = events.find((e) => e.participants.includes(fId));
        return friend && joinedEvent ? { friend, event: joinedEvent } : null;
      })
      .filter(Boolean)
      .slice(0, 4);
  }, [user, allUsers, events]);

  const handleJoin = (id: string) => {
    if (!user) { navigate('/login'); return; }
    if (user.role === 'organizer') {
      setToast({ show: true, message: 'Organizers cannot join events', type: 'error' });
      return;
    }
    const selectedEvent = events.find((event) => event.id === id) ?? null;
    navigate(`/event/${id}`, { state: selectedEvent ? { event: selectedEvent } : undefined });
  };

  // ── 7. Components ──────────────────────────────────────────────────────────
  const SectionHeader = ({ icon: Icon, title, badge, sectionKey }: { icon: any; title: string; badge?: string; sectionKey: string }) => (
    <button type="button" onClick={() => toggleSection(sectionKey)} className="flex w-full items-center gap-2 pt-6 pb-2">
      <Icon className="h-5 w-5 text-primary shrink-0" />
      <h2 className="text-base font-bold text-foreground">{title}</h2>
      {badge && <span className="ml-2 rounded-full bg-primary/20 px-2.5 py-0.5 text-[10px] font-semibold text-primary">{badge}</span>}
      <motion.span className="ml-auto text-muted-foreground" animate={{ rotate: collapsed[sectionKey] ? -90 : 0 }} transition={{ duration: 0.2 }}>▾</motion.span>
    </button>
  );

  return (
    <div className="min-h-screen bg-background pb-20">
      <AppToast message={toast.message} type={toast.type} show={toast.show} onClose={() => setToast((t) => ({ ...t, show: false }))} />
      <TopBar search={search} onSearchChange={setSearch} />

      <div className="mx-auto max-w-3xl space-y-4 px-4 pt-4">
        {showInterestPrompt && user && (
          <div className="rounded-2xl border border-primary/30 bg-primary/10 p-4">
            <p className="text-sm font-semibold text-foreground">Personalize your events</p>
            <p className="mt-1 text-xs text-muted-foreground">
              You have not selected interests yet. Add them in your profile to get better event suggestions.
            </p>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => navigate('/profile')}
                className="rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground"
              >
                Go to profile
              </button>
              <button
                type="button"
                onClick={handleSkipInterestPrompt}
                className="rounded-lg bg-secondary px-3 py-2 text-xs font-semibold text-foreground"
              >
                Skip for now
              </button>
            </div>
          </div>
        )}

        {/* Category Filter */}
        <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
          {['All', ...CATEGORIES].map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCategory(c)}
              className={`shrink-0 rounded-full px-4 py-1.5 text-xs font-medium transition-all ${
                category === c ? 'gradient-primary text-primary-foreground shadow-glow' : 'glass-card text-secondary-foreground hover:text-foreground'
              }`}
            >
              {c}
            </button>
          ))}
        </div>

        {/* Search/Location Filters */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5 rounded-2xl glass-card p-3">
            <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase text-muted-foreground"><Calendar className="h-3 w-3" /> Event date</span>
            <input 
              type="date" 
              value={filterDate} 
              min={minDate} 
              onChange={(e) => setFilterDate(e.target.value)} 
              className="rounded-lg bg-secondary/80 px-3 py-2 text-xs text-foreground outline-none focus:ring-2 focus:ring-primary/40" 
            />
          </label>
          <label className="flex flex-col gap-1.5 rounded-2xl glass-card p-3">
            <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase text-muted-foreground">
              <MapPin className="h-3 w-3" /> Location
            </span>
            <select
              id="home-city-filter"
              value={selectedCity}
              onChange={(e) => setSelectedCity(e.target.value)}
              className="rounded-lg bg-secondary/80 px-3 py-2 text-xs text-foreground outline-none focus:ring-2 focus:ring-primary/40"
              aria-label="Filter events by location"
            >
              <option value="">All locations</option>
              {availableCities.map((city) => (
                <option key={city} value={city}>
                  {city}
                </option>
              ))}
            </select>
            {!loading && availableCities.length === 0 && (
              <span className="text-[10px] text-muted-foreground">Locations are built from event addresses (first part before a comma).</span>
            )}
          </label>
        </div>

        {/* Budget Slider */}
        <div className="flex items-center gap-3 rounded-2xl glass-card p-4">
          <span className="shrink-0 text-xs font-medium text-muted-foreground">Budget: ${budgetMax}</span>
          <input type="range" min={0} max={maxPrice} value={budgetMax} onChange={(e) => setBudgetMax(Number(e.target.value))} className="h-1 flex-1 accent-primary cursor-pointer" />
        </div>

        {/* Friend Activity Section */}
        {friendActivity.length > 0 && (
          <div className="space-y-1">
            <SectionHeader icon={Users} title="Friend Activity" sectionKey="friends" />
            {!collapsed['friends'] && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} className="space-y-3 rounded-2xl glass-card p-5">
                {friendActivity.map((item: any, i: number) => (
                  <div key={i} className="flex items-center gap-3">
                    <UserAvatar seed={item.friend.id} name={item.friend.name} size="sm" />
                    <p className="text-xs text-foreground"><span className="font-semibold">{item.friend.name}</span> joined <span className="font-medium text-primary">{item.event.title}</span></p>
                  </div>
                ))}
              </motion.div>
            )}
          </div>
        )}

        {/* Interest-Based Discovery */}
        {user && (
          <div className="space-y-2">
            <SectionHeader icon={Sparkles} title="Based On Your Interests" sectionKey="interests" />
            {!collapsed['interests'] && (
              user.interests?.length ? (
                interestRecommendationsLoading ? (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <div key={i} className="h-52 animate-pulse rounded-2xl glass-card" />
                    ))}
                  </div>
                ) : interestRecommendations.length > 0 ? (
                  <motion.div layout className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {interestRecommendations.map((event, i) => (
                      <motion.div key={event.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.02 }}>
                        <EventCard event={event} onJoin={handleJoin} isFavorite={favoriteIds.has(event.id)} />
                      </motion.div>
                    ))}
                  </motion.div>
                ) : (
                  <div className="rounded-2xl glass-card px-4 py-5 text-xs text-muted-foreground text-center">
                    No events match your saved interests yet. Update them from your profile to discover more.
                  </div>
                )
              ) : (
                <div className="rounded-2xl glass-card px-4 py-5 text-xs text-muted-foreground text-center">
                  Add interests in your profile to get personalized event discovery.
                </div>
              )
            )}
          </div>
        )}

        {/* All Events Section */}
        <div className="space-y-2">
          <SectionHeader icon={Sparkles} title="All Events" sectionKey="events" />
          {!collapsed['events'] && (
            loading ? (
              <div className="py-20 text-center">
                <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-t-2 border-primary" />
                <p className="text-sm text-muted-foreground">Loading the latest events...</p>
              </div>
            ) : (
              <>
                {usingLocalFallback && (
                  <div className="mb-4 rounded-xl bg-amber-500/10 border border-amber-500/20 px-4 py-2 text-xs text-amber-500 text-center">
                    Offline mode: Showing cached local events.
                  </div>
                )}
                
                <motion.div layout className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {filtered.map((event, i) => (
                    <motion.div key={event.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.02 }}>
                      <EventCard event={event} onJoin={handleJoin} isFavorite={favoriteIds.has(event.id)} />
                    </motion.div>
                  ))}
                </motion.div>

                {filtered.length === 0 && (
                  <div className="rounded-3xl py-20 text-center glass-card">
                    <p className="text-sm text-muted-foreground">No events match your current filters.</p>
                    <p className="mt-2 text-xs text-muted-foreground">Try another date, location, or budget.</p>
                  </div>
                )}
              </>
            )
          )}
        </div>
      </div>
      <BottomNav />
    </div>
  );
}
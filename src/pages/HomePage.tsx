import { useState, useMemo, useEffect } from 'react';
import { getCurrentUser, getUsers, getEvents as getLocalEvents, type EventItem, updateUser } from '@/lib/storage';
import { mapApiEventToItem, parseEventsApiList } from '@/lib/mapApiEvent';
import { UserAvatar } from '@/components/UserAvatar';
import { ALL_INTERESTS } from '@/lib/interests';
import TopBar from '@/components/TopBar';
import BottomNav from '@/components/BottomNav';
import EventCard from '@/components/EventCard';
import AppToast from '@/components/AppToast';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Sparkles, Users, MapPin, Calendar, Music, Cpu, Utensils, Dumbbell, Palette, Gamepad2, Film, BookOpen, Plane, Coffee, Network, Leaf, LayoutGrid } from 'lucide-react';
import { getApiUrl } from '@/lib/api';
import { getAuthToken } from '@/lib/auth';
import { extractCityFromLocation, getEventCities } from '@/lib/eventLocation';
import { isEventUpcoming } from '@/lib/eventTime';
import { cachedFetch, invalidatePrefix, TTL } from '@/lib/queryCache';

export default function HomePage() {
  const INTEREST_PROMPT_DISMISSED_KEY = 'event_interest_prompt_dismissed';
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
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [maxPrice, setMaxPrice] = useState(500);
  const [usingLocalFallback, setUsingLocalFallback] = useState(false);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [visibleInterests, setVisibleInterests] = useState(3);
  const [visibleAll, setVisibleAll] = useState(6);
  const PAGE = 6;
  const today = new Date();
  const minDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  // ── Favorites ────────────────────────────────────────────────────────────
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [interestRecommendations, setInterestRecommendations] = useState<EventItem[]>([]);
  const [interestRecommendationsLoading, setInterestRecommendationsLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState(getCurrentUser());
  const [interestsRefreshTick, setInterestsRefreshTick] = useState(0);
  const [showInterestPrompt, setShowInterestPrompt] = useState(false);
  const [pickedInterests, setPickedInterests] = useState<string[]>([]);
  const [savingInterests, setSavingInterests] = useState(false);

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

  // ── Load profile immediately on mount to check interests ─────────────────
  useEffect(() => {
    if (!user?.id) return;
    const token = getAuthToken();
    if (!token) return;

    let cancelled = false;

    cachedFetch(
      `/api/profile/me:${user.id}`,
      () => fetch(getApiUrl('/api/profile/me'), {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      }).then((res) => res.ok ? res.json() : Promise.reject()),
      TTL.MEDIUM,
    )
      .then((data: Record<string, unknown>) => {
        if (cancelled) return;
        const profile = (data.data || data.user || data) as Record<string, unknown>;
        const apiInterests = Array.isArray(profile.interests) ? profile.interests : [];
        // Always update local state with what the API says
        updateUser({ interests: apiInterests as string[] });
        // Force React re-render by updating currentUser state directly
        setCurrentUser(getCurrentUser());
        setInterestsRefreshTick(t => t + 1);
      })
      .catch(() => {
        if (cancelled) return;
        // API failed — treat as no interests to show the prompt
        setInterestsRefreshTick(t => t + 1);
      });

    return () => { cancelled = true; };
  }, [user?.id]);

  // ── Show interest prompt when interests are empty ─────────────────────────
  useEffect(() => {
    if (!user?.id) {
      setShowInterestPrompt(false);
      return;
    }
    // Don't show if user already has interests (including when still loading — undefined)
    if (Array.isArray(user.interests) && user.interests.length > 0) {
      setShowInterestPrompt(false);
      return;
    }
    // Don't show if user previously dismissed it
    try {
      const raw = window.localStorage.getItem(INTEREST_PROMPT_DISMISSED_KEY);
      const parsed = raw ? (JSON.parse(raw) as Record<string, boolean>) : {};
      if (parsed[user.id]) {
        setShowInterestPrompt(false);
        return;
      }
    } catch { /* ignore */ }

    setShowInterestPrompt(true);
  }, [user?.id, user?.interests, interestsRefreshTick]);

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

  const handleSaveInterests = async () => {
    if (pickedInterests.length === 0) return;
    setSavingInterests(true);
    try {
      const token = getAuthToken();
      if (token) {
        await fetch(getApiUrl('/api/profile/me'), {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ interests: pickedInterests }),
        });
        // Invalidate profile cache so next visit re-fetches fresh data
        invalidatePrefix(`/api/profile/me:${user?.id ?? ''}`);
      }
      // Update local user state
      updateUser({ interests: pickedInterests });
      window.dispatchEvent(new CustomEvent('eventapp:user-updated'));
      setShowInterestPrompt(false);
    } catch {
      // Still update locally even if API fails
      updateUser({ interests: pickedInterests });
      window.dispatchEvent(new CustomEvent('eventapp:user-updated'));
      setShowInterestPrompt(false);
    } finally {
      setSavingInterests(false);
    }
  };

  // ── 1. Load Max Price (cached 5 min — rarely changes) ────────────────────
  useEffect(() => {
    cachedFetch(
      '/api/events/max-price',
      () => fetch(getApiUrl('/api/events/max-price')).then((res) => res.ok ? res.json() : Promise.reject()),
      TTL.LONG,
      true, // persist to sessionStorage
    )
      .then((data: { max_price: number }) => {
        setMaxPrice(data.max_price);
        setBudgetMax(data.max_price);
        setBudgetMin(0);
      })
      .catch(() => {});
  }, []);

  // ── 2. Load Favorites (cached 2 min, per user) ────────────────────────────
  useEffect(() => {
    const token = getAuthToken();
    if (!user || !token) return;

    cachedFetch(
      `/api/favorites/all:${user.id}`,
      () => fetch(getApiUrl('/api/favorites/all'), { headers: { Authorization: `Bearer ${token}` } })
        .then((res) => res.ok ? res.json() : Promise.reject()),
      TTL.MEDIUM,
    )
      .then((data: any[]) => {
        const ids = data.map(fav => fav.id || fav.event_id);
        setFavoriteIds(new Set(ids));
      })
      .catch(() => console.error("Failed to load favorites"));
  }, [user?.id, interestsRefreshTick]);

  // ── 3. Load Interest Recommendations (cached 2 min, per user) ────────────
  useEffect(() => {
    const token = getAuthToken();
    if (!user?.id || !token || !user.interests?.length) {
      setInterestRecommendations([]);
      setInterestRecommendationsLoading(false);
      return;
    }

    let cancelled = false;
    setInterestRecommendationsLoading(true);

    cachedFetch(
      `/api/recommendations:${user.id}`,
      () => fetch(getApiUrl('/api/recommendations?limit=6'), { headers: { Authorization: `Bearer ${token}` } })
        .then((res) => (res.ok ? res.json() : Promise.reject())),
      TTL.MEDIUM,
    )
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

    return () => { cancelled = true; };
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

  // ── 5. Main Events Fetch (cached 2 min per filter combination) ───────────
  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams({ limit: '50', page: '1' });
    if (category !== 'All') params.set('category', category);
    if (debouncedSearch) params.set('search', debouncedSearch);
    if (debouncedDate) params.set('event_date', debouncedDate);

    const cacheKey = `/api/events?${params}`;
    setLoading(true);

    cachedFetch(
      cacheKey,
      () => {
        const controller = new AbortController();
        const timeout = window.setTimeout(() => controller.abort(), 8000);
        return fetch(getApiUrl(`/api/events?${params}`), { signal: controller.signal })
          .then((res) => (res.ok ? res.json() : Promise.reject(new Error('Failed to load events'))))
          .finally(() => window.clearTimeout(timeout));
      },
      TTL.MEDIUM,
    )
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
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [category, debouncedSearch, debouncedDate]);

  const availableCities = useMemo(() => getEventCities(events), [events]);

  // ── 6. Filtered Events logic ──────────────────────────────────────────────
  const applyFilters = (list: EventItem[]) =>
    list.filter((e) => {
      if (!isEventUpcoming(e)) return false;
      if (e.budget < budgetMin || e.budget > budgetMax) return false;
      if (category !== 'All' && e.category !== category) return false;
      if (debouncedDate && e.date !== debouncedDate) return false;
      const city = extractCityFromLocation(e.location || '');
      if (selectedCity && city !== selectedCity) return false;
      if (debouncedSearch && !e.title.toLowerCase().includes(debouncedSearch.toLowerCase())) return false;
      return true;
    });

  const filtered = useMemo(
    () => applyFilters(events),
    [events, budgetMin, budgetMax, category, debouncedDate, selectedCity, debouncedSearch],
  );

  const filteredRecommendations = useMemo(
    () => applyFilters(interestRecommendations),
    [interestRecommendations, budgetMin, budgetMax, category, debouncedDate, selectedCity, debouncedSearch],
  );

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
    <button type="button" onClick={() => toggleSection(sectionKey)} className="flex w-full items-center gap-2 pt-6 pb-2 group">
      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/15 group-hover:bg-primary/25 transition-colors shrink-0">
        <Icon className="h-3.5 w-3.5 text-primary" />
      </div>
      <h2 className="text-base font-bold text-foreground">{title}</h2>
      {badge && <span className="ml-1 rounded-full gradient-primary px-2.5 py-0.5 text-[10px] font-bold text-primary-foreground shadow-glow">{badge}</span>}
      <motion.span className="ml-auto text-muted-foreground text-sm" animate={{ rotate: collapsed[sectionKey] ? -90 : 0 }} transition={{ duration: 0.2 }}>▾</motion.span>
    </button>
  );

  return (
    <div className="min-h-screen bg-background pb-20">
      <AppToast message={toast.message} type={toast.type} show={toast.show} onClose={() => setToast((t) => ({ ...t, show: false }))} />
      <TopBar search={search} onSearchChange={setSearch} />

      {/* Category Filter — two centred rows */}
      <div className="px-4 pt-3 pb-5 space-y-2">
        {(() => {
          const cats = [
            { id: 'All',        icon: LayoutGrid, iconColor: '#94a3b8', activeBg: 'rgba(148,163,184,0.15)', activeBorderColor: 'rgba(148,163,184,0.5)' },
            { id: 'Music',      icon: Music,      iconColor: '#a78bfa', activeBg: 'rgba(167,139,250,0.15)', activeBorderColor: 'rgba(167,139,250,0.5)' },
            { id: 'Tech',       icon: Cpu,        iconColor: '#60a5fa', activeBg: 'rgba(96,165,250,0.15)',  activeBorderColor: 'rgba(96,165,250,0.5)'  },
            { id: 'Food',       icon: Utensils,   iconColor: '#fb923c', activeBg: 'rgba(251,146,60,0.15)',  activeBorderColor: 'rgba(251,146,60,0.5)'  },
            { id: 'Fitness',    icon: Dumbbell,   iconColor: '#4ade80', activeBg: 'rgba(74,222,128,0.15)',  activeBorderColor: 'rgba(74,222,128,0.5)'  },
            { id: 'Art',        icon: Palette,    iconColor: '#f472b6', activeBg: 'rgba(244,114,182,0.15)', activeBorderColor: 'rgba(244,114,182,0.5)' },
            { id: 'Gaming',     icon: Gamepad2,   iconColor: '#818cf8', activeBg: 'rgba(129,140,248,0.15)', activeBorderColor: 'rgba(129,140,248,0.5)' },
            { id: 'Sports',     icon: Dumbbell,   iconColor: '#34d399', activeBg: 'rgba(52,211,153,0.15)',  activeBorderColor: 'rgba(52,211,153,0.5)'  },
            { id: 'Movies',     icon: Film,       iconColor: '#f87171', activeBg: 'rgba(248,113,113,0.15)', activeBorderColor: 'rgba(248,113,113,0.5)' },
            { id: 'Study',      icon: BookOpen,   iconColor: '#facc15', activeBg: 'rgba(250,204,21,0.15)',  activeBorderColor: 'rgba(250,204,21,0.5)'  },
            { id: 'Travel',     icon: Plane,      iconColor: '#38bdf8', activeBg: 'rgba(56,189,248,0.15)',  activeBorderColor: 'rgba(56,189,248,0.5)'  },
            { id: 'Coffee',     icon: Coffee,     iconColor: '#fbbf24', activeBg: 'rgba(251,191,36,0.15)',  activeBorderColor: 'rgba(251,191,36,0.5)'  },
            { id: 'Networking', icon: Network,    iconColor: '#22d3ee', activeBg: 'rgba(34,211,238,0.15)',  activeBorderColor: 'rgba(34,211,238,0.5)'  },
            { id: 'Wellness',   icon: Leaf,       iconColor: '#2dd4bf', activeBg: 'rgba(45,212,191,0.15)',  activeBorderColor: 'rgba(45,212,191,0.5)'  },
          ] as const;
          const mid = Math.ceil(cats.length / 2);
          const rows = [cats.slice(0, mid), cats.slice(mid)];
          return rows.map((row, ri) => (
            <div key={ri} className="flex justify-center gap-2 flex-wrap">
              {row.map(({ id, icon: Icon, iconColor, activeBg, activeBorderColor }) => {
                const active = category === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setCategory(id)}
                    style={active ? { background: activeBg, borderColor: activeBorderColor, color: iconColor } : { background: activeBg.replace('0.15', '0.08'), borderColor: activeBorderColor.replace('0.5', '0.25') }}
                    className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-all active:scale-95 ${
                      active
                        ? 'border-transparent'
                        : 'border-transparent text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <Icon className="h-3 w-3 shrink-0" style={{ color: iconColor }} />
                    {id}
                  </button>
                );
              })}
            </div>
          ));
        })()}
      </div>

      <div className="mx-auto max-w-3xl space-y-4 px-4">

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
                <option key={city} value={city}>{city}</option>
              ))}
            </select>
          </label>
        </div>

        {/* Budget Range */}
        <div className="rounded-2xl glass-card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase text-muted-foreground">Budget range</span>
            <span className="text-xs font-medium text-foreground">${budgetMin} — ${budgetMax === maxPrice ? `${maxPrice}` : budgetMax}</span>
          </div>
          <div className="relative h-6 flex items-center">
            <div className="absolute inset-x-0 h-1.5 rounded-full bg-secondary" />
            <div
              className="absolute h-1.5 rounded-full bg-primary pointer-events-none"
              style={{
                left: `${maxPrice > 0 ? (budgetMin / maxPrice) * 100 : 0}%`,
                right: `${maxPrice > 0 ? 100 - (budgetMax / maxPrice) * 100 : 0}%`,
              }}
            />
            <input type="range" min={0} max={maxPrice} value={budgetMin}
              onChange={(e) => { const v = Math.min(Number(e.target.value), budgetMax - 1); setBudgetMin(v); }}
              className="dual-range-input absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              style={{ zIndex: budgetMin > maxPrice * 0.9 ? 5 : 3 }}
            />
            <input type="range" min={0} max={maxPrice} value={budgetMax}
              onChange={(e) => { const v = Math.max(Number(e.target.value), budgetMin + 1); setBudgetMax(v); }}
              className="dual-range-input absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              style={{ zIndex: 4 }}
            />
            <div className="absolute h-4 w-4 rounded-full bg-primary border-2 border-background shadow pointer-events-none"
              style={{ left: `calc(${maxPrice > 0 ? (budgetMin / maxPrice) * 100 : 0}% - 8px)` }} />
            <div className="absolute h-4 w-4 rounded-full bg-primary border-2 border-background shadow pointer-events-none"
              style={{ left: `calc(${maxPrice > 0 ? (budgetMax / maxPrice) * 100 : 100}% - 8px)` }} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-muted-foreground">Min ($)</label>
              <input type="number" min={0} max={budgetMax - 1} value={budgetMin}
                onChange={(e) => { const v = Math.min(Math.max(0, Number(e.target.value)), budgetMax - 1); setBudgetMin(isNaN(v) ? 0 : v); }}
                className="rounded-lg bg-secondary px-3 py-1.5 text-xs text-foreground outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-muted-foreground">Max ($)</label>
              <input type="number" min={budgetMin + 1} max={maxPrice} value={budgetMax}
                onChange={(e) => { const v = Math.max(Math.min(maxPrice, Number(e.target.value)), budgetMin + 1); setBudgetMax(isNaN(v) ? maxPrice : v); }}
                className="rounded-lg bg-secondary px-3 py-1.5 text-xs text-foreground outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
          </div>
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
                ) : filteredRecommendations.length > 0 ? (
                  <>
                    <motion.div layout className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      {filteredRecommendations.slice(0, visibleInterests).map((event, i) => (
                        <motion.div key={event.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.02 }}>
                          <EventCard event={event} onJoin={handleJoin} isFavorite={favoriteIds.has(event.id)} />
                        </motion.div>
                      ))}
                    </motion.div>
                    {visibleInterests < filteredRecommendations.length && (
                      <button
                        type="button"
                        onClick={() => setVisibleInterests((v) => v + PAGE)}
                        className="mt-2 w-full rounded-xl border border-border py-2.5 text-sm font-medium text-primary hover:bg-secondary/50 transition-colors"
                      >
                        View more · {filteredRecommendations.length - visibleInterests} remaining
                      </button>
                    )}
                    {visibleInterests > 3 && (
                      <button
                        type="button"
                        onClick={() => setVisibleInterests(3)}
                        className="mt-2 w-full rounded-xl border border-border py-2.5 text-sm font-medium text-primary hover:bg-secondary/50 transition-colors"
                      >
                        Show less
                      </button>
                    )}
                  </>
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
                {usingLocalFallback && (
                  <div className="mb-2 flex items-center gap-2 rounded-xl bg-amber-500/10 border border-amber-500/20 px-4 py-2.5 text-xs text-amber-500">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0" />
                    Offline mode — showing cached local events.
                  </div>
                )}
                
                <motion.div layout className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {filtered.slice(0, visibleAll).map((event, i) => (
                    <motion.div key={event.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.02 }}>
                      <EventCard event={event} onJoin={handleJoin} isFavorite={favoriteIds.has(event.id)} />
                    </motion.div>
                  ))}
                </motion.div>
                {visibleAll < filtered.length && (
                  <button
                    type="button"
                    onClick={() => setVisibleAll((v) => v + PAGE)}
                    className="mt-2 w-full rounded-xl border border-border py-2.5 text-sm font-medium text-primary hover:bg-secondary/50 transition-colors"
                  >
                    View more · {filtered.length - visibleAll} remaining
                  </button>
                )}
                {visibleAll > 9 && (
                  <button
                    type="button"
                    onClick={() => setVisibleAll(9)}
                    className="mt-2 w-full rounded-xl border border-border py-2.5 text-sm font-medium text-primary hover:bg-secondary/50 transition-colors"
                  >
                    Show less
                  </button>
                )}

                {filtered.length === 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="rounded-3xl py-16 px-6 text-center glass-card space-y-3"
                  >
                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-secondary/60">
                      <Sparkles className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <p className="text-sm font-semibold text-foreground">No events match your current filters.</p>
                    <p className="text-xs text-muted-foreground">Try adjusting the date, location, or budget filters.</p>
                    <button
                      type="button"
                      onClick={() => { setCategory('All'); setFilterDate(''); setSelectedCity(''); setBudgetMin(0); setBudgetMax(maxPrice); }}
                      className="mt-1 rounded-xl border border-border px-4 py-2 text-xs font-semibold text-primary hover:bg-secondary/50 transition-colors"
                    >
                      Clear all filters
                    </button>
                  </motion.div>
                )}
              </>
            )
          )}
        </div>
      </div>
      <BottomNav />

      {/* ── Interest selection modal — shown immediately for new users ── */}
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
              {/* Header */}
              <div className="px-6 pt-7 pb-5 text-center space-y-2">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl gradient-primary shadow-glow">
                  <Sparkles className="h-5 w-5 text-primary-foreground" />
                </div>
                <h2 className="text-lg font-bold text-foreground">What are you into?</h2>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Pick a few interests so we can show you events you'll love.
                </p>
              </div>

              {/* Interest grid — 3 columns */}
              <div className="px-5 pb-2 grid grid-cols-3 gap-2.5">
                {ALL_INTERESTS.map((interest) => {
                  const meta: Record<string, { emoji: string }> = {
                    Music:      { emoji: '🎵' },
                    Sports:     { emoji: '⚽' },
                    Gaming:     { emoji: '🎮' },
                    Movies:     { emoji: '🎬' },
                    Study:      { emoji: '📚' },
                    Travel:     { emoji: '✈️' },
                    Tech:       { emoji: '💻' },
                    Art:        { emoji: '🎨' },
                    Fitness:    { emoji: '💪' },
                    Coffee:     { emoji: '☕' },
                    Networking: { emoji: '🤝' },
                    Food:       { emoji: '🍕' },
                    Wellness:   { emoji: '🧘' },
                  };
                  const selected = pickedInterests.includes(interest);
                  return (
                    <button
                      key={interest}
                      type="button"
                      onClick={() =>
                        setPickedInterests(prev =>
                          selected ? prev.filter(i => i !== interest) : [...prev, interest]
                        )
                      }
                      className={`flex flex-col items-center gap-1.5 rounded-2xl border py-3 px-2 text-center transition-all active:scale-95 ${
                        selected
                          ? 'gradient-primary border-transparent text-primary-foreground shadow-glow'
                          : 'border-border/40 bg-secondary/50 text-muted-foreground hover:border-border hover:text-foreground'
                      }`}
                    >
                      <span className="text-xl leading-none">{meta[interest]?.emoji ?? '✨'}</span>
                      <span className="text-[11px] font-medium leading-tight">{interest}</span>
                    </button>
                  );
                })}
              </div>

              {/* Actions */}
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
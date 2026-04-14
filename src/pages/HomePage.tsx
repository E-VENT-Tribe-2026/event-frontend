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
import { Sparkles, Users, UserPlus, MapPin, Calendar } from 'lucide-react';
import { getApiUrl } from '@/lib/api';
import { apiClient } from '@/lib/apiClient';
import { getAuthToken } from '@/lib/auth';


export default function HomePage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [budgetMax, setBudgetMax] = useState(500);
  const [filterDate, setFilterDate] = useState('');
  const [debouncedDate, setDebouncedDate] = useState('');
  const [filterLocation, setFilterLocation] = useState('');
  const [debouncedLocation, setDebouncedLocation] = useState('');
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' as 'success' | 'error' });
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [maxPrice, setMaxPrice] = useState(500);
  const [usingLocalFallback, setUsingLocalFallback] = useState(false);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
const toggleSection = (key: string) => setCollapsed(prev => ({ ...prev, [key]: !prev[key] }));

  // ── Recommendations state ──────────────────────────────────────────────────
  const [recommendations, setRecommendations] = useState<EventItem[]>([]);
  const [recsLoading, setRecsLoading] = useState(false);

  const user = getCurrentUser();
  const allUsers = getUsers();


  // ── Max price ──────────────────────────────────────────────────────────────
  useEffect(() => {
    fetch(getApiUrl('/api/events/max-price'))
      .then((res) => res.ok ? res.json() : Promise.reject())
      .then((data: { max_price: number }) => {
        setMaxPrice(data.max_price);
        setBudgetMax(data.max_price);
      })
      .catch(() => {});
  }, []);

  // ── Recommendations ────────────────────────────────────────────────────────
 useEffect(() => {
  if (!user) return;
  const token = getAuthToken();
  if (!token) return;

  setRecsLoading(true);

  fetch(getApiUrl('/api/recommendations?limit=6'), {
    headers: { Authorization: `Bearer ${token}` },
  })
    .then((res) => res.ok ? res.json() : Promise.reject())
    .then((data: { data: unknown[] }) =>
      setRecommendations((data.data || []).map(mapApiEventToItem))
    )
    .catch(() => setRecommendations([]))
    .finally(() => setRecsLoading(false));
}, [user?.id]);

  // ── Debounced inputs ───────────────────────────────────────────────────────
  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(search.trim()), 350);
    return () => window.clearTimeout(t);
  }, [search]);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedDate(filterDate.trim()), 350);
    return () => window.clearTimeout(t);
  }, [filterDate]);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedLocation(filterLocation.trim()), 350);
    return () => window.clearTimeout(t);
  }, [filterLocation]);

  // ── All events fetch ───────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams({ limit: '50', page: '1' });
    if (category !== 'All') params.set('category', category);
    if (debouncedSearch) params.set('search', debouncedSearch);
    if (debouncedDate) params.set('event_date', debouncedDate);
    if (debouncedLocation) params.set('location', debouncedLocation);

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
        [...list, ...local].forEach((e) => byId.set(e.id, e));
        setEvents(Array.from(byId.values()));
        setUsingLocalFallback(false);
      })
      .catch(() => {
        if (!cancelled) {
          const local = getLocalEvents().filter((e) => !e.isDraft);
          setEvents(local);
          setUsingLocalFallback(true);
        }
      })
      .finally(() => {
        window.clearTimeout(timeout);
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [category, debouncedSearch, debouncedDate, debouncedLocation]);

  // ── Derived data ───────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    return events.filter((e) => {
      if (e.budget > budgetMax) return false;
      if (category !== 'All' && e.category !== category) return false;
      if (debouncedDate && e.date !== debouncedDate) return false;
      if (debouncedLocation && !e.location.toLowerCase().includes(debouncedLocation.toLowerCase())) return false;
      return true;
    });
  }, [events, budgetMax, category, debouncedDate, debouncedLocation]);

  const suggestedPeople = useMemo(
    () => allUsers.filter((u) => u.id !== user?.id).slice(0, 8),
    [allUsers, user],
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

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleJoin = (id: string) => {
    if (!user) { navigate('/login'); return; }
    if (user.role === 'organizer') {
      setToast({ show: true, message: 'Organizers cannot join events', type: 'error' });
      return;
    }
    navigate(`/event/${id}`);
  };

  // ── Shared components ──────────────────────────────────────────────────────
  const SectionHeader = ({ icon: Icon, title, badge, sectionKey }: { icon: any; title: string; badge?: string; sectionKey: string }) => (
  <button
    type="button"
    onClick={() => toggleSection(sectionKey)}
    className="flex w-full items-center gap-2 pt-6 pb-2"
  >
    <Icon className="h-5 w-5 text-primary shrink-0" />
    <h2 className="text-base font-bold text-foreground">{title}</h2>
    {badge && (
      <span className="rounded-full bg-primary/20 px-2.5 py-0.5 text-[10px] font-semibold text-primary">
        {badge}
      </span>
    )}
    <motion.span
      className="ml-auto text-muted-foreground"
      animate={{ rotate: collapsed[sectionKey] ? -90 : 0 }}
      transition={{ duration: 0.2 }}
    >
      ▾
    </motion.span>
  </button>
);

  const RecommendationsSkeleton = () => (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="h-52 animate-pulse rounded-2xl glass-card" />
      ))}
    </div>
  );

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background pb-20">
      <AppToast
        message={toast.message}
        type={toast.type}
        show={toast.show}
        onClose={() => setToast((t) => ({ ...t, show: false }))}
      />
      <TopBar search={search} onSearchChange={setSearch} />

      <div className="mx-auto max-w-3xl space-y-4 px-4 pt-4">

        {/* Category pills */}
        <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
          {['All', ...CATEGORIES].map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCategory(c)}
              className={`shrink-0 rounded-full px-4 py-1.5 text-xs font-medium transition-all ${
                category === c
                  ? 'gradient-primary text-primary-foreground shadow-glow'
                  : 'glass-card text-secondary-foreground hover:text-foreground'
              }`}
            >
              {c}
            </button>
          ))}
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5 rounded-2xl glass-card p-3">
            <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase text-muted-foreground">
              <Calendar className="h-3 w-3" /> Event date
            </span>
            <input
              type="date"
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              className="rounded-lg bg-secondary/80 px-3 py-2 text-xs text-foreground outline-none focus:ring-2 focus:ring-primary/40"
            />
          </label>
          <label className="flex flex-col gap-1.5 rounded-2xl glass-card p-3">
            <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase text-muted-foreground">
              <MapPin className="h-3 w-3" /> Location
            </span>
            <input
              type="text"
              value={filterLocation}
              onChange={(e) => setFilterLocation(e.target.value)}
              placeholder="City, venue, area…"
              className="rounded-lg bg-secondary/80 px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-primary/40"
            />
          </label>
        </div>

        {/* Budget slider */}
        <div className="flex items-center gap-3 rounded-2xl glass-card p-4">
          <span className="shrink-0 text-xs font-medium text-muted-foreground">Budget: ${budgetMax}</span>
          <input
            type="range"
            min={0}
            max={maxPrice}
            value={budgetMax}
            onChange={(e) => setBudgetMax(Number(e.target.value))}
            className="h-1 flex-1 accent-primary cursor-pointer"
          />
        </div>

        {/* Friend Activity */}
        {friendActivity.length > 0 && (
          <div className="space-y-1">
            <SectionHeader icon={Users} title="Friend Activity" sectionKey="friends" />
            {!collapsed['friends'] && (
              <div className="space-y-3 rounded-2xl glass-card p-5">
                {friendActivity.map((item: any, i: number) => (
                  <div key={i} className="flex items-center gap-3">
                    <UserAvatar seed={item.friend.id} name={item.friend.name} size="sm" />
                    <p className="text-xs text-foreground">
                      <span className="font-semibold">{item.friend.name}</span>
                      <span className="text-muted-foreground"> joined </span>
                      <span className="font-medium text-primary">{item.event.title}</span>
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Suggested People */}
        {suggestedPeople.length > 0 && (
          <div className="space-y-1">
            <SectionHeader icon={UserPlus} title="People You May Match" badge="AI" sectionKey="people" />
            {!collapsed['people'] && (
              <div className="no-scrollbar flex snap-x snap-mandatory gap-3 overflow-x-auto pb-4">
                {suggestedPeople.map((p, i) => (
                  <motion.div
                    key={p.id}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: i * 0.05 }}
                    className="flex w-32 shrink-0 snap-start flex-col items-center gap-2 rounded-2xl glass-card p-4 text-center"
                  >
                    <UserAvatar seed={p.id} name={p.name} size="lg" className="ring-2 ring-primary/30" />
                    <p className="line-clamp-1 text-xs font-semibold text-foreground">{p.name}</p>
                    <p className="line-clamp-1 text-[10px] text-muted-foreground">{p.interests?.[0] || 'Social'}</p>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Recommended For You */}
        {user && (recsLoading || recommendations.length > 0) && (
          <div className="space-y-2">
            <SectionHeader icon={Sparkles} title="Recommended For You" badge="AI" sectionKey="recs" />
            {!collapsed['recs'] && (
              recsLoading ? (
                <RecommendationsSkeleton />
              ) : (
                <div className="no-scrollbar flex snap-x snap-mandatory gap-4 overflow-x-auto pb-4">
                  {recommendations.map((event, i) => (
                    <motion.div
                      key={event.id}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className="w-72 shrink-0 snap-start"
                    >
                      <EventCard event={event} onJoin={handleJoin} />
                    </motion.div>
                  ))}
                </div>
              )
            )}
          </div>
        )}

        {/* All Events */}
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
                <motion.div layout className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {filtered.map((event, i) => (
                    <motion.div
                      key={event.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.02 }}
                    >
                      <EventCard event={event} onJoin={handleJoin} />
                    </motion.div>
                  ))}
                </motion.div>

                {filtered.length === 0 && (
                  <div className="rounded-3xl py-20 text-center glass-card">
                    <p className="text-sm text-muted-foreground">No events match your current filters.</p>
                    <p className="mt-2 text-xs text-muted-foreground">Try another date, location, or category.</p>
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
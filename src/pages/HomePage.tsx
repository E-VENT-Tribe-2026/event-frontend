import { useState, useMemo, useEffect } from 'react';
import { getCurrentUser, getUsers, getEvents as getLocalEvents, type EventItem } from '@/lib/storage';
import { mapApiEventToItem } from '@/lib/mapApiEvent';
import { UserAvatar } from '@/components/UserAvatar';
import { CATEGORIES } from '@/lib/seedData';
import TopBar from '@/components/TopBar';
import BottomNav from '@/components/BottomNav';
import EventCard from '@/components/EventCard';
import AppToast from '@/components/AppToast';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Sparkles, Users, UserPlus } from 'lucide-react';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:8001';

export default function HomePage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [budgetMax, setBudgetMax] = useState(500);
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' as 'success' | 'error' });
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [maxPrice, setMaxPrice] = useState(500);
  const [usingLocalFallback, setUsingLocalFallback] = useState(false);
  const user = getCurrentUser();
  const allUsers = getUsers();

  
useEffect(() => {
  fetch(`${API_BASE_URL}/api/events/max-price`)
    .then((res) => res.ok ? res.json() : Promise.reject())
    .then((data: { max_price: number }) => {
      setMaxPrice(data.max_price);
      setBudgetMax(data.max_price); // reset slider to new max
    })
    .catch(() => {
      // silently fall back to default 500
    });
}, []);

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams({ limit: '50', page: '1' });
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 8000);
    setLoading(true);
    fetch(`${API_BASE_URL}/api/events?${params}`, { signal: controller.signal })
      .then((res) => res.ok ? res.json() : Promise.reject(new Error('Failed to load events')))
      .then((data: { data?: Record<string, unknown>[] }) => {
        if (cancelled) return;
        const list = Array.isArray(data?.data) ? data.data.map(mapApiEventToItem) : [];
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
  }, []);

  const filtered = useMemo(() => {
    return events.filter(e => {
      if (category !== 'All' && e.category !== category) return false;
      if (e.budget > budgetMax) return false;
      if (search && !e.title.toLowerCase().includes(search.toLowerCase()) && !e.location.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [events, search, category, budgetMax]);

  const suggestedPeople = useMemo(() => allUsers.filter(u => u.id !== user?.id).slice(0, 8), [allUsers, user]);

  const friendActivity = useMemo(() => {
    if (!user?.friends?.length) return [];
    return user.friends.map(fId => {
      const friend = allUsers.find(u => u.id === fId);
      if (!friend) return null;
      const joinedEvent = events.find(e => e.participants.includes(fId));
      return friend && joinedEvent ? { friend, event: joinedEvent } : null;
    }).filter(Boolean).slice(0, 4);
  }, [user, allUsers, events]);

  const handleJoin = (id: string) => {
    if (!user) { navigate('/login'); return; }
    if (user.role === 'organizer') {
      setToast({ show: true, message: 'Organizers cannot join events', type: 'error' });
      return;
    }
    navigate(`/event/${id}`);
  };

  const SectionHeader = ({ icon: Icon, title, badge }: { icon: any; title: string; badge?: string }) => (
    <div className="flex items-center gap-2 pt-6 pb-2">
      <Icon className="h-5 w-5 text-primary" />
      <h2 className="text-base font-bold text-foreground">{title}</h2>
      {badge && (
        <span className="ml-auto rounded-full bg-primary/20 px-2.5 py-0.5 text-[10px] font-semibold text-primary">{badge}</span>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-background pb-20">
      <AppToast message={toast.message} type={toast.type} show={toast.show} onClose={() => setToast(t => ({ ...t, show: false }))} />
      <TopBar search={search} onSearchChange={setSearch} />

      <div className="mx-auto max-w-3xl px-4 pt-4 space-y-4">
        
        {/* Category chips */}
        <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
          {['All', ...CATEGORIES].map(c => (
            <button key={c} onClick={() => setCategory(c)}
              className={`shrink-0 rounded-full px-4 py-1.5 text-xs font-medium transition-all ${category === c ? 'gradient-primary text-primary-foreground shadow-glow' : 'glass-card text-secondary-foreground hover:text-foreground'}`}>
              {c}
            </button>
          ))}
        </div>

        {/* Budget filter */}
        <div className="flex items-center gap-3 glass-card p-4 rounded-2xl">
          <span className="text-xs text-muted-foreground shrink-0 font-medium">Budget: ${budgetMax}</span>
          <input
            type="range"
            min={0}
            max={maxPrice}          
            value={budgetMax}
            onChange={e => setBudgetMax(Number(e.target.value))}
            className="flex-1 accent-primary h-1"
          />
        </div>

        {/* Friend Activity */}
        {friendActivity.length > 0 && (
          <div className="space-y-1">
            <SectionHeader icon={Users} title="Friend Activity" />
            <div className="rounded-2xl glass-card p-5 space-y-3">
              {friendActivity.map((item: any, i: number) => (
                <div key={i} className="flex items-center gap-3">
                  <UserAvatar seed={item.friend.id} name={item.friend.name} size="sm" />
                  <p className="text-xs text-foreground">
                    <span className="font-semibold">{item.friend.name}</span>
                    <span className="text-muted-foreground"> joined </span>
                    <span className="text-primary font-medium">{item.event.title}</span>
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* People You May Match With */}
        {suggestedPeople.length > 0 && (
          <div className="space-y-1">
            <SectionHeader icon={UserPlus} title="People You May Match" badge="AI" />
            <div className="flex gap-3 overflow-x-auto pb-4 no-scrollbar snap-x snap-mandatory">
              {suggestedPeople.map((p, i) => (
                <motion.div key={p.id} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.05 }}
                  className="shrink-0 w-32 rounded-2xl glass-card p-4 flex flex-col items-center gap-2 text-center snap-start">
                  <UserAvatar seed={p.id} name={p.name} size="lg" className="ring-2 ring-primary/30" />
                  <p className="text-xs font-semibold text-foreground line-clamp-1">{p.name}</p>
                  <p className="text-[10px] text-muted-foreground line-clamp-1">{p.interests?.[0] || 'Social'}</p>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {/* All Events - Clean Main Feed */}
        <div className="space-y-2">
          <SectionHeader icon={Sparkles} title="All Events" />
          
          {loading ? (
            <div className="text-center py-20">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-primary mx-auto mb-4"></div>
              <p className="text-sm text-muted-foreground">Loading the latest events...</p>
            </div>
          ) : (
            <>
              {usingLocalFallback && (
                <div className="mb-4 rounded-xl bg-amber-500/10 border border-amber-500/20 px-4 py-2 text-xs text-amber-500 text-center">
                  Offline mode: Showing cached events.
                </div>
              )}
              
              <motion.div layout className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                {filtered.map((event, i) => (
                  <motion.div key={event.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.02 }}>
                    <EventCard event={event} onJoin={handleJoin} />
                  </motion.div>
                ))}
              </motion.div>

              {filtered.length === 0 && (
                <div className="text-center py-20 glass-card rounded-3xl">
                  <p className="text-sm text-muted-foreground">No events match your current filters.</p>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <BottomNav />
    </div>
  );
}
import { useState, useMemo } from 'react';
import { getEvents, joinEvent, getCurrentUser, type EventItem } from '@/lib/storage';
import { CATEGORIES } from '@/lib/seedData';
import TopBar from '@/components/TopBar';
import BottomNav from '@/components/BottomNav';
import EventCard from '@/components/EventCard';
import AppToast from '@/components/AppToast';
import { motion } from 'framer-motion';

export default function HomePage() {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [budgetMax, setBudgetMax] = useState(500);
  const [events, setEvents] = useState<EventItem[]>(getEvents());
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' as const });

  const filtered = useMemo(() => {
    return events.filter(e => {
      if (category !== 'All' && e.category !== category) return false;
      if (e.budget > budgetMax) return false;
      if (search && !e.title.toLowerCase().includes(search.toLowerCase()) && !e.location.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [events, search, category, budgetMax]);

  const handleJoin = (id: string) => {
    const user = getCurrentUser();
    if (!user) return;
    joinEvent(id, user.id);
    setEvents(getEvents());
    setToast({ show: true, message: 'Joined event!', type: 'success' });
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <AppToast message={toast.message} type={toast.type} show={toast.show} onClose={() => setToast(t => ({ ...t, show: false }))} />
      <TopBar search={search} onSearchChange={setSearch} />

      <div className="mx-auto max-w-lg px-4 pt-4 space-y-4">
        {/* Category chips */}
        <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar">
          {['All', ...CATEGORIES].map(c => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={`shrink-0 rounded-full px-4 py-1.5 text-xs font-medium transition-all ${
                category === c
                  ? 'gradient-primary text-primary-foreground shadow-glow'
                  : 'bg-secondary text-secondary-foreground hover:bg-muted'
              }`}
            >
              {c}
            </button>
          ))}
        </div>

        {/* Budget filter */}
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground shrink-0">Budget: ${budgetMax}</span>
          <input
            type="range"
            min={0}
            max={500}
            value={budgetMax}
            onChange={e => setBudgetMax(Number(e.target.value))}
            className="flex-1 accent-primary h-1"
          />
        </div>

        {/* Event grid */}
        <motion.div layout className="grid gap-4 sm:grid-cols-2">
          {filtered.map((event, i) => (
            <motion.div key={event.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <EventCard event={event} onJoin={handleJoin} />
            </motion.div>
          ))}
        </motion.div>

        {filtered.length === 0 && (
          <div className="text-center py-12 text-muted-foreground text-sm">No events found matching your filters</div>
        )}
      </div>

      <BottomNav />
    </div>
  );
}

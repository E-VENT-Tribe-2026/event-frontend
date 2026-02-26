import { useState, useMemo } from 'react';
import { getEvents, getCurrentUser, getUsers, type EventItem } from '@/lib/storage';
import { CATEGORIES } from '@/lib/seedData';
import TopBar from '@/components/TopBar';
import BottomNav from '@/components/BottomNav';
import EventCard from '@/components/EventCard';
import AppToast from '@/components/AppToast';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Lock, TrendingUp, MapPin, Sparkles, Users, Crown, Brain, Eye, UserPlus } from 'lucide-react';

export default function HomePage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [budgetMax, setBudgetMax] = useState(500);
  const [events] = useState<EventItem[]>(getEvents());
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' as 'success' | 'error' });
  const user = getCurrentUser();
  const allUsers = getUsers();

  const filtered = useMemo(() => {
    return events.filter(e => {
      if (e.isDraft) return false;
      if (category !== 'All' && e.category !== category) return false;
      if (e.budget > budgetMax) return false;
      if (search && !e.title.toLowerCase().includes(search.toLowerCase()) && !e.location.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [events, search, category, budgetMax]);

  const trending = useMemo(() => [...events].filter(e => !e.isDraft).sort((a, b) => b.participants.length - a.participants.length).slice(0, 4), [events]);
  const recommended = useMemo(() => {
    if (!user) return filtered.slice(0, 4);
    return filtered.filter(e => user.interests?.some(i => e.category === i)).slice(0, 4);
  }, [filtered, user]);
  const nearby = useMemo(() => filtered.slice(0, 4), [filtered]);

  // AI-powered sections (mock)
  const recentlyViewed = useMemo(() => events.filter(e => !e.isDraft).slice(2, 5), [events]);
  const suggestedPeople = useMemo(() => allUsers.filter(u => u.id !== user?.id).slice(0, 4), [allUsers, user]);
  const suggestedCollaborators = useMemo(() => allUsers.filter(u => u.role === 'organizer' && u.id !== user?.id).slice(0, 3), [allUsers, user]);

  // Friend activity data
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

  const SectionHeader = ({ icon: Icon, title, accent, badge }: { icon: any; title: string; accent?: boolean; badge?: string }) => (
    <div className="flex items-center gap-2 pt-5 pb-2">
      <Icon className={`h-5 w-5 ${accent ? 'text-accent' : 'text-primary'}`} />
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

      <div className="mx-auto max-w-lg px-4 pt-4 space-y-2">
        {/* Category chips */}
        <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar">
          {['All', ...CATEGORIES].map(c => (
            <button key={c} onClick={() => setCategory(c)}
              className={`shrink-0 rounded-full px-4 py-1.5 text-xs font-medium transition-all ${category === c ? 'gradient-primary text-primary-foreground shadow-glow' : 'glass-card text-secondary-foreground hover:text-foreground'}`}>
              {c}
            </button>
          ))}
        </div>

        {/* Budget filter */}
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground shrink-0">Budget: ${budgetMax}</span>
          <input type="range" min={0} max={500} value={budgetMax} onChange={e => setBudgetMax(Number(e.target.value))} className="flex-1 accent-primary h-1" />
        </div>

        {/* Premium banner */}
        {user && !user.isPremium && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl p-4 flex items-center gap-3 cursor-pointer hover:shadow-glow transition-shadow glass-card glow-border"
            onClick={() => navigate('/premium')}>
            <div className="rounded-xl gradient-primary p-2.5">
              <Crown className="h-6 w-6 text-primary-foreground" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold text-foreground">Upgrade to Premium</p>
              <p className="text-xs text-muted-foreground">Unlock friend activity, analytics & more</p>
            </div>
            <span className="text-xs font-semibold text-primary">→</span>
          </motion.div>
        )}

        {/* Recommended */}
        {recommended.length > 0 && (
          <>
            <SectionHeader icon={Sparkles} title="Recommended for You" badge="AI" />
            <div className="flex gap-4 overflow-x-auto pb-2 custom-scrollbar">
              {recommended.map((event, i) => (
                <motion.div key={event.id} className="shrink-0 w-64" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}>
                  <EventCard event={event} onJoin={handleJoin} />
                </motion.div>
              ))}
            </div>
          </>
        )}

        {/* Trending */}
        <SectionHeader icon={TrendingUp} title="Trending Events" accent />
        <div className="flex gap-4 overflow-x-auto pb-2 custom-scrollbar">
          {trending.map((event, i) => (
            <motion.div key={event.id} className="shrink-0 w-64" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}>
              <EventCard event={event} onJoin={handleJoin} />
            </motion.div>
          ))}
        </div>

        {/* Nearby */}
        <SectionHeader icon={MapPin} title="Nearby Events" />
        <motion.div layout className="grid gap-4 sm:grid-cols-2">
          {nearby.map((event, i) => (
            <motion.div key={event.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <EventCard event={event} onJoin={handleJoin} />
            </motion.div>
          ))}
        </motion.div>

        {/* Friend Activity (Premium locked) */}
        <SectionHeader icon={Users} title="Friend Activity" />
        <div className="relative rounded-2xl glass-card p-6 text-center overflow-hidden">
          {user?.isPremium ? (
            friendActivity.length > 0 ? (
              <div className="space-y-3 text-left">
                {friendActivity.map((item: any, i: number) => (
                  <div key={i} className="flex items-center gap-3">
                    <img src={item.friend.avatar} alt="" className="h-8 w-8 rounded-full bg-secondary" />
                    <p className="text-xs text-foreground">
                      <span className="font-semibold">{item.friend.name}</span>
                      <span className="text-muted-foreground"> joined </span>
                      <span className="text-primary font-medium">{item.event.title}</span>
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No friend activity yet. Add friends to see what events they're joining!</p>
            )
          ) : (
            <>
              <div className="absolute inset-0 backdrop-blur-sm bg-background/60 z-10 flex flex-col items-center justify-center gap-2">
                <Lock className="h-8 w-8 text-primary" />
                <p className="text-sm font-medium text-foreground">Premium Feature</p>
                <button onClick={() => navigate('/premium')} className="gradient-primary rounded-full px-4 py-1.5 text-xs font-semibold text-primary-foreground shadow-glow">
                  Unlock Now
                </button>
              </div>
              <div className="space-y-2 blur-locked">
                <div className="h-10 shimmer rounded-lg" />
                <div className="h-10 shimmer rounded-lg" />
                <div className="h-10 shimmer rounded-lg" />
              </div>
            </>
          )}
        </div>

        {/* People You May Match With */}
        {suggestedPeople.length > 0 && (
          <>
            <SectionHeader icon={UserPlus} title="People You May Match" badge="AI" />
            <div className="flex gap-3 overflow-x-auto pb-2 custom-scrollbar">
              {suggestedPeople.map((p, i) => (
                <motion.div key={p.id} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.05 }}
                  className="shrink-0 w-28 rounded-2xl glass-card p-3 flex flex-col items-center gap-2 text-center">
                  <img src={p.profilePhoto || p.avatar} alt="" className="h-12 w-12 rounded-full bg-secondary ring-2 ring-primary/30 object-cover" />
                  <p className="text-xs font-semibold text-foreground line-clamp-1">{p.name}</p>
                  <p className="text-[10px] text-muted-foreground">{p.interests?.slice(0, 2).join(', ')}</p>
                </motion.div>
              ))}
            </div>
          </>
        )}

        {/* Suggested Collaborators */}
        {user?.role === 'organizer' && suggestedCollaborators.length > 0 && (
          <>
            <SectionHeader icon={Brain} title="Suggested Collaborators" badge="AI" />
            <div className="space-y-2">
              {suggestedCollaborators.map((c, i) => (
                <motion.div key={c.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
                  className="flex items-center gap-3 rounded-2xl glass-card p-3">
                  <img src={c.profilePhoto || c.avatar} alt="" className="h-10 w-10 rounded-full bg-secondary" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{c.name}</p>
                    <p className="text-xs text-muted-foreground">{c.orgCategory || 'Organizer'}</p>
                  </div>
                  <button className="rounded-full bg-primary/20 px-3 py-1 text-xs font-medium text-primary">Invite</button>
                </motion.div>
              ))}
            </div>
          </>
        )}

        {/* Recently Viewed */}
        {recentlyViewed.length > 0 && (
          <>
            <SectionHeader icon={Eye} title="Recently Viewed" />
            <div className="flex gap-4 overflow-x-auto pb-2 custom-scrollbar">
              {recentlyViewed.map((event, i) => (
                <motion.div key={event.id} className="shrink-0 w-64" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}>
                  <EventCard event={event} onJoin={handleJoin} />
                </motion.div>
              ))}
            </div>
          </>
        )}

        {/* All Events */}
        <SectionHeader icon={Sparkles} title="All Events" />
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

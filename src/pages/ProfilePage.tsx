import { useState, useMemo, useEffect } from 'react';
import { 
  getCurrentUser, 
  setCurrentUserFromOAuth,
  updateUser, 
  getEvents, 
  getTickets, 
  getUsers, 
  getJoinRequests, 
  leaveEvent, 
  upsertEvent, 
  type EventItem 
} from '@/lib/storage';
import { logout } from '@/lib/storage';
import { useNavigate } from 'react-router-dom';
import { LogOut, Edit2, Check, Star, Ticket, UserPlus, CreditCard, Heart, Trash2 } from 'lucide-react';
import { motion } from 'framer-motion';
import BottomNav from '@/components/BottomNav';
import AppToast from '@/components/AppToast';
import { getAuthToken, clearAuthToken } from '@/lib/auth';
import { getApiUrl } from '@/lib/api';
import { API_ENDPOINTS } from '@/lib/apiUrls';
import { mapApiEventToItem } from '@/lib/mapApiEvent';
import { UserAvatar } from '@/components/UserAvatar';
import { isEventUpcoming, eventStartMs } from '@/lib/eventTime';

function sameUserId(a: string, b: string): boolean {
  if (!a || !b) return false;
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

export default function ProfilePage() {
  const navigate = useNavigate();
  const user = getCurrentUser();
  
  // UI State
  const [profileLoading, setProfileLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(user?.name || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' as 'success' | 'error' });
  const [activeTab, setActiveTab] = useState<'events' | 'favorites' | 'tickets' | 'friends'>('events');
  
  // Data State
  const [remoteJoinedEvents, setRemoteJoinedEvents] = useState<EventItem[]>([]);
  const [remoteCreatedUpcoming, setRemoteCreatedUpcoming] = useState<EventItem[]>([]);
  const [remoteCreatedPast, setRemoteCreatedPast] = useState<EventItem[]>([]);
  const [favorites, setFavorites] = useState<EventItem[]>([]);
  const [loadingCreatedEvents, setLoadingCreatedEvents] = useState(false);
  const [localEventsEpoch, setLocalEventsEpoch] = useState(0);
  const [leavingEventId, setLeavingEventId] = useState<string | null>(null);

  // Memoized Data
  const events = useMemo(() => getEvents(), [localEventsEpoch]);
  const joinedEvents = useMemo(() => user ? events.filter(e => e.participants.includes(user.id)) : [], [events, user]);
  
  const allJoinedEvents = useMemo(() => {
    const byId = new Map<string, EventItem>();
    [...joinedEvents, ...remoteJoinedEvents].forEach((e) => byId.set(e.id, e));
    return Array.from(byId.values());
  }, [joinedEvents, remoteJoinedEvents]);

  const displayCreatedUpcoming = useMemo(() => {
    if (!user) return [];
    const m = new Map<string, EventItem>();
    remoteCreatedUpcoming.forEach((e) => m.set(e.id, e));
    events.filter((e) => !e.isDraft && sameUserId(e.organizerId, user.id) && isEventUpcoming(e)).forEach((e) => m.set(e.id, e));
    return Array.from(m.values()).sort((a, b) => eventStartMs(a) - eventStartMs(b));
  }, [remoteCreatedUpcoming, events, user]);

  const displayCreatedPast = useMemo(() => {
    if (!user) return [];
    const m = new Map<string, EventItem>();
    remoteCreatedPast.forEach((e) => m.set(e.id, e));
    events.filter((e) => !e.isDraft && sameUserId(e.organizerId, user.id) && !isEventUpcoming(e)).forEach((e) => m.set(e.id, e));
    return Array.from(m.values()).sort((a, b) => eventStartMs(b) - eventStartMs(a));
  }, [remoteCreatedPast, events, user]);

  const createdIds = useMemo(() => new Set([...displayCreatedUpcoming, ...displayCreatedPast].map(e => e.id)), [displayCreatedUpcoming, displayCreatedPast]);
  const joinedEventsOnly = useMemo(() => allJoinedEvents.filter(e => !createdIds.has(e.id)), [allJoinedEvents, createdIds]);

  const displayJoinedUpcoming = useMemo(() => joinedEventsOnly.filter(isEventUpcoming).sort((a, b) => eventStartMs(a) - eventStartMs(b)), [joinedEventsOnly]);
  const displayJoinedPast = useMemo(() => joinedEventsOnly.filter(e => !isEventUpcoming(e)).sort((a, b) => eventStartMs(b) - eventStartMs(a)), [joinedEventsOnly]);

  const approvedRequests = useMemo(() => {
    if (!user) return [];
    return getJoinRequests().filter(r => r.userId === user.id && r.status === 'approved').map(r => {
      const evt = events.find(e => e.id === r.eventId);
      return evt && !evt.participants.includes(user.id) ? { request: r, event: evt } : null;
    }).filter(Boolean);
  }, [user, events]);

  // Initial Load: Profile & Favorites
  useEffect(() => {
    const token = getAuthToken();
    if (!token) { setProfileLoading(false); return; }
    
    let cancelled = false;
    (async () => {
      try {
        const [resProf, resFavs] = await Promise.all([
          fetch(getApiUrl(API_ENDPOINTS.PROFILE_ME), { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } }),
          fetch(getApiUrl('/api/favorites/all'), { headers: { Authorization: `Bearer ${token}` } })
        ]);
        
        if (resProf.ok && !cancelled) {
          const raw = await resProf.json();
          const data = raw.data || raw.user || raw;
          if (data.id) {
            setCurrentUserFromOAuth({ id: String(data.id), email: String(data.email || ""), name: String(data.full_name || data.name || ""), bio: String(data.bio || ""), avatar: data.avatar_url });
            setName(data.full_name || data.name || "");
            setBio(data.bio || "");
          }
        }

        if (resFavs.ok && !cancelled) {
          const favData = await resFavs.json();
          setFavorites((favData || []).map(mapApiEventToItem));
        }
      } catch (err) { console.error(err); } finally { if (!cancelled) setProfileLoading(false); }
    })();
    return () => { cancelled = true; };
  }, []);

  // Event Data Load
  useEffect(() => {
    if (!user) return;
    const token = getAuthToken();
    if (!token) return;

    (async () => {
      setLoadingCreatedEvents(true);
      try {
        const [resJoined, resCreated] = await Promise.all([
          fetch(getApiUrl('/api/participants/my/events'), { headers: { Authorization: `Bearer ${token}` } }),
          fetch(getApiUrl(`${API_ENDPOINTS.EVENTS}/my-events`), { headers: { Authorization: `Bearer ${token}` } })
        ]);

        if (resJoined.ok) {
          const joinedBody = await resJoined.json();
          setRemoteJoinedEvents((joinedBody || []).map((row: any) => mapApiEventToItem(row.events)).filter(Boolean));
        }

        if (resCreated.ok) {
          const createdBody = await resCreated.json();
          const rows = createdBody.data || [];
          setRemoteCreatedUpcoming(rows.map(mapApiEventToItem).filter(isEventUpcoming));
          setRemoteCreatedPast(rows.map(mapApiEventToItem).filter((e: any) => !isEventUpcoming(e)));
          rows.forEach((evt: any) => upsertEvent(mapApiEventToItem(evt)));
        }
        setLocalEventsEpoch(n => n + 1);
      } catch (err) { console.error(err); } finally { setLoadingCreatedEvents(false); }
    })();
  }, [user?.id]);

  const handleLeaveFromProfile = async (eventId: string) => {
    const token = getAuthToken();
    setLeavingEventId(eventId);
    if (token) {
      try {
        await fetch(getApiUrl(`/api/participants/${eventId}/leave`), { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
      } catch (err) { console.error(err); }
    }
    leaveEvent(eventId, user!.id);
    setRemoteJoinedEvents(prev => prev.filter(e => e.id !== eventId));
    setLeavingEventId(null);
    setToast({ show: true, message: 'Left event', type: 'success' });
  };

  const handleRemoveFavorite = async (eventId: string) => {
    const token = getAuthToken();
    if (!token) return;
    try {
      const res = await fetch(getApiUrl(`/api/favorites/unsave-events/${eventId}`), { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        setFavorites(prev => prev.filter(e => e.id !== eventId));
        setToast({ show: true, message: 'Removed from favorites', type: 'success' });
      }
    } catch (err) { console.error(err); }
  };

  const handleSave = async () => {
    const token = getAuthToken();
    if (token) {
      try {
        await fetch(getApiUrl(API_ENDPOINTS.PROFILE_ME), { method: 'PUT', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify({ full_name: name, bio }) });
        updateUser({ name, bio });
        setEditing(false);
        setToast({ show: true, message: 'Profile updated!', type: 'success' });
      } catch (err) { console.error(err); }
    }
  };

  const handleLogout = () => { logout(); clearAuthToken(); navigate('/login'); };

  if (profileLoading) return <div className="min-h-screen bg-background flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-t-2 border-primary" /></div>;
  if (!user) { navigate('/login'); return null; }

  return (
    <div className="min-h-screen bg-background pb-20">
      <AppToast message={toast.message} type={toast.type} show={toast.show} onClose={() => setToast(t => ({ ...t, show: false }))} />

      <div className="relative h-36 bg-gradient-to-r from-primary/30 to-accent/30">
        <button onClick={handleLogout} className="absolute top-3 right-3 z-10 flex items-center gap-1 text-xs text-foreground/80 glass-card rounded-full px-3 py-1.5 transition-transform active:scale-95"><LogOut className="h-3 w-3" /> Logout</button>
      </div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mx-auto max-w-lg px-4 -mt-14 relative z-10 space-y-5">
        <div className="flex flex-col items-center gap-2">
          <UserAvatar src={user.avatar} seed={user.id} name={name} size="xl" className="ring-4 ring-background shadow-glow" />
          {editing ? <input value={name} onChange={e => setName(e.target.value)} className="rounded-xl bg-secondary px-4 py-2 text-center outline-none focus:ring-2 focus:ring-primary/50 font-bold" /> : <h2 className="text-xl font-bold">{name || 'User'}</h2>}
          <p className="text-sm text-muted-foreground">{user.email}</p>
        </div>

        <div className="rounded-2xl glass-card p-4 space-y-2">
          <div className="flex items-center justify-between"><h3 className="text-sm font-semibold">Bio</h3><button onClick={editing ? handleSave : () => setEditing(true)} className="text-primary p-1">{editing ? <Check className="h-4 w-4" /> : <Edit2 className="h-4 w-4" />}</button></div>
          {editing ? <textarea value={bio} onChange={e => setBio(e.target.value)} rows={3} className="w-full rounded-lg bg-secondary p-3 text-sm resize-none outline-none" /> : <p className="text-sm text-muted-foreground">{bio || 'No bio yet.'}</p>}
        </div>

        {approvedRequests.length > 0 && (
          <div className="rounded-2xl glass-card p-4 space-y-3 glow-border">
            <h3 className="text-sm font-semibold flex items-center gap-2"><CreditCard className="h-4 w-4 text-accent" /> Pending Payments</h3>
            {approvedRequests.map((item: any) => (
              <div key={item.request.id} className="flex items-center gap-3 rounded-xl bg-secondary/50 p-3">
                <img src={item.event.image} className="h-10 w-10 rounded-lg object-cover" />
                <div className="flex-1 min-w-0"><p className="text-xs font-medium truncate">{item.event.title}</p><p className="text-[10px] text-accent">Approved — Pay to join</p></div>
                <button onClick={() => navigate(`/payment/${item.event.id}`)} className="gradient-primary rounded-full px-3 py-1 text-xs font-semibold text-primary-foreground shadow-glow">Pay ${item.event.budget}</button>
              </div>
            ))}
          </div>
        )}

        <div className="flex rounded-xl glass-card p-1">
          {[{ id: 'events', label: 'Events', icon: Star }, { id: 'favorites', label: 'Favorites', icon: Heart }, { id: 'tickets', label: 'Tickets', icon: Ticket }, { id: 'friends', label: 'Friends', icon: UserPlus }].map((tab) => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} className={`flex-1 flex flex-col items-center gap-1 rounded-lg py-2 text-[10px] font-medium transition-all ${activeTab === tab.id ? 'gradient-primary text-primary-foreground shadow-glow' : 'text-muted-foreground'}`}><tab.icon className="h-3.5 w-3.5" />{tab.label}</button>
          ))}
        </div>

        <div className="space-y-4 min-h-[300px]">
          {activeTab === 'events' && (
            <div className="space-y-6">
              {/* Upcoming Section */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold px-1">Upcoming</h3>
                {[...displayCreatedUpcoming, ...displayJoinedUpcoming].length === 0 && <p className="text-center py-4 text-xs text-muted-foreground">No upcoming events.</p>}
                
                {displayCreatedUpcoming.map(e => (
                   <div key={e.id} className="flex items-center gap-3 rounded-xl glass-card p-3 border border-primary/20" onClick={() => navigate(`/event/${e.id}`)}>
                     <img src={e.image} className="h-10 w-10 rounded-lg object-cover" />
                     <div className="flex-1">
                       <p className="text-xs font-bold line-clamp-1">{e.title}</p>
                       <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-bold uppercase">Created</span>
                     </div>
                     <div className="text-right">
                       <p className="text-[10px] text-muted-foreground">{e.date}</p>
                     </div>
                   </div>
                ))}

                {displayJoinedUpcoming.map(e => (
                   <div key={e.id} className="flex items-center gap-3 rounded-xl glass-card p-3">
                     <img src={e.image} className="h-10 w-10 rounded-lg object-cover" />
                     <div className="flex-1 cursor-pointer" onClick={() => navigate(`/event/${e.id}`)}>
                       <p className="text-xs font-bold line-clamp-1">{e.title}</p>
                       <div className="flex items-center gap-2">
                         <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-accent/10 text-accent font-bold uppercase">Joined</span>
                         <p className="text-[10px] text-muted-foreground">{e.date}</p>
                       </div>
                     </div>
                     <button onClick={() => handleLeaveFromProfile(e.id)} disabled={leavingEventId === e.id} className="text-[10px] text-muted-foreground hover:text-destructive bg-secondary/50 px-3 py-1 rounded-full transition-colors">{leavingEventId === e.id ? '...' : 'Leave'}</button>
                   </div>
                ))}
              </div>

              {/* Past Section */}
              <div className="space-y-3 pt-2">
                <h3 className="text-sm font-semibold opacity-70 px-1">Past Events</h3>
                {[...displayCreatedPast, ...displayJoinedPast].length === 0 && <p className="text-center py-4 text-xs text-muted-foreground">No past events recorded.</p>}
                {[...displayCreatedPast, ...displayJoinedPast].map(e => {
                  const isCreated = createdIds.has(e.id);
                  return (
                    <div key={e.id} className="flex items-center gap-3 rounded-xl glass-card p-3 opacity-60 grayscale-[0.5]" onClick={() => navigate(`/event/${e.id}`)}>
                      <img src={e.image} className="h-10 w-10 rounded-lg object-cover" />
                      <div className="flex-1">
                        <p className="text-xs font-bold line-clamp-1">{e.title}</p>
                        <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase ${isCreated ? 'bg-primary/10 text-primary' : 'bg-accent/10 text-accent'}`}>
                          {isCreated ? 'Created' : 'Joined'}
                        </span>
                      </div>
                      <p className="text-[10px] text-muted-foreground">{e.date}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {activeTab === 'favorites' && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold px-1">Saved Events</h3>
              {favorites.length === 0 ? (
                <p className="text-center py-8 text-xs text-muted-foreground">You haven't saved any events yet.</p>
              ) : (
                favorites.map(e => (
                  <div key={e.id} className="flex items-center gap-3 rounded-xl glass-card p-3">
                    <img src={e.image} className="h-10 w-10 rounded-lg object-cover cursor-pointer" onClick={() => navigate(`/event/${e.id}`)} />
                    <div className="flex-1 cursor-pointer" onClick={() => navigate(`/event/${e.id}`)}>
                      <p className="text-xs font-bold line-clamp-1">{e.title}</p>
                      <p className="text-[10px] text-muted-foreground">{e.date} · {e.location}</p>
                    </div>
                    <button onClick={() => handleRemoveFavorite(e.id)} className="p-2 text-muted-foreground hover:text-destructive transition-colors"><Trash2 className="h-4 w-4" /></button>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'tickets' && <p className="text-center py-8 text-xs text-muted-foreground">No digital tickets available yet.</p>}
          {activeTab === 'friends' && <p className="text-center py-8 text-xs text-muted-foreground">No connections found.</p>}
        </div>
      </motion.div>
      <BottomNav />
    </div>
  );
}
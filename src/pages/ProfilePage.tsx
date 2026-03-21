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
import { LogOut, Edit2, Check, Star, Ticket, UserPlus, CreditCard } from 'lucide-react';
import { motion } from 'framer-motion';
import BottomNav from '@/components/BottomNav';
import AppToast from '@/components/AppToast';
import { getAuthToken, clearAuthToken } from '@/lib/auth';
import { getApiUrl } from '@/lib/api';
import { API_ENDPOINTS } from '@/lib/apiUrls';
import { mapApiEventToItem } from '@/lib/mapApiEvent';
import { UserAvatar } from '@/components/UserAvatar';

function calcAge(dob: string): number | null {
  if (!dob) return null;
  const diff = Date.now() - new Date(dob).getTime();
  return Math.floor(diff / (365.25 * 24 * 60 * 60 * 1000));
}

function sameUserId(a: string, b: string): boolean {
  if (!a || !b) return false;
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

export default function ProfilePage() {
  const navigate = useNavigate();
  const user = getCurrentUser();
  
  // State for profile data and UI
  const [profileLoading, setProfileLoading] = useState(true); // FIX: Added missing state
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(user?.name || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' as const });
  const [activeTab, setActiveTab] = useState<'events' | 'tickets' | 'reviews' | 'friends'>('events');
  
  // State for API data
  const [remoteJoinedEvents, setRemoteJoinedEvents] = useState<EventItem[]>([]);
  const [remoteCreatedEvents, setRemoteCreatedEvents] = useState<EventItem[]>([]);
  const [loadingCreatedEvents, setLoadingCreatedEvents] = useState(false);
  const [localEventsEpoch, setLocalEventsEpoch] = useState(0);
  const [leavingEventId, setLeavingEventId] = useState<string | null>(null);

  // Memoized data
  const events = useMemo(() => getEvents(), [localEventsEpoch]);
  const tickets = useMemo(() => user ? getTickets().filter(t => t.userId === user.id) : [], [user, localEventsEpoch]);
  const joinedEvents = useMemo(() => user ? events.filter(e => e.participants.includes(user.id)) : [], [events, user]);
  
  const allJoinedEvents = useMemo(() => {
    const byId = new Map<string, EventItem>();
    [...joinedEvents, ...remoteJoinedEvents].forEach((e) => byId.set(e.id, e));
    return Array.from(byId.values());
  }, [joinedEvents, remoteJoinedEvents]);

  const createdEvents = useMemo(() => {
    if (!user) return [];
    const byId = new Map<string, EventItem>();
    
    // Load local storage events
    events
      .filter((e) => !e.isDraft && sameUserId(e.organizerId, user.id))
      .forEach((e) => byId.set(e.id, e));

    // Merge with remote API events
    remoteCreatedEvents.forEach((e) => {
      const prev = byId.get(e.id);
      byId.set(e.id, prev ? { ...prev, ...e } : e);
    });

    return Array.from(byId.values()).sort((a, b) => 
      `${b.date}T${b.time}`.localeCompare(`${a.date}T${a.time}`)
    );
  }, [events, user, remoteCreatedEvents]);

  const joinedEventsOnly = useMemo(() => {
    const createdIds = new Set(createdEvents.map((e) => e.id));
    return allJoinedEvents.filter((e) => !createdIds.has(e.id));
  }, [allJoinedEvents, createdEvents]);

  const reviewsReceived = useMemo(() => {
    if (!user) return [];
    return createdEvents.flatMap(e => (e.reviews || []).map(r => ({ ...r, eventTitle: e.title })));
  }, [createdEvents, user]);

  const allUsers = getUsers();
  const friends = useMemo(() => user?.friends?.map(fId => allUsers.find(u => u.id === fId)).filter(Boolean) || [], [user, allUsers]);

  const approvedRequests = useMemo(() => {
    if (!user) return [];
    const reqs = getJoinRequests();
    return reqs.filter(r => r.userId === user.id && r.status === 'approved').map(r => {
      const evt = events.find(e => e.id === r.eventId);
      const alreadyJoined = evt?.participants.includes(user.id);
      return evt && !alreadyJoined ? { request: r, event: evt } : null;
    }).filter(Boolean);
  }, [user, events]);

  // EFFECT 1: Restore session from API (Crucial for page refreshes)
  useEffect(() => {
    if (getCurrentUser()) {
      setProfileLoading(false);
      return;
    }
    const token = getAuthToken();
    if (!token) {
      setProfileLoading(false);
      return;
    }
    
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(getApiUrl(API_ENDPOINTS.PROFILE_ME), {
          headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
        });
        if (!res.ok || cancelled) return;
        const raw = await res.json().catch(() => null);
        if (!raw || cancelled) return;

        const row = (raw.data || raw.user || raw) as Record<string, any>;
        const id = row.id || row.user_id;
        const email = row.email;

        if (id && email) {
          setCurrentUserFromOAuth({
            id: String(id),
            email: String(email),
            name: String(row.full_name || row.name || email.split('@')[0]),
            avatar: row.avatar_url,
          });
        }
      } catch (err) {
        console.error("Session restore failed", err);
      } finally {
        if (!cancelled) setProfileLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // EFFECT 2: Load API Data
  useEffect(() => {
    if (!user) return;
    const token = getAuthToken();
    if (!token) return;

    const fetchData = async () => {
      setLoadingCreatedEvents(true);
      try {
        // Load Joined Events
        const resJoined = await fetch(getApiUrl('/api/participants/my/events'), {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (resJoined.ok) {
          const joinedBody = await resJoined.json();
          const mappedJoined = (joinedBody || []).map((row: any) => mapApiEventToItem(row.events)).filter(Boolean);
          setRemoteJoinedEvents(mappedJoined);
        }

        // Load Created Events
        const resCreated = await fetch(getApiUrl(`${API_ENDPOINTS.EVENTS}/my-events`), {
          headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
        });
        if (resCreated.ok) {
          const createdBody = await resCreated.json();
          const rows = createdBody.data || [];
          const mappedCreated = rows.map((row: any) => {
            const item = mapApiEventToItem(row);
            item.organizerId = user.id;
            return item;
          });
          setRemoteCreatedEvents(mappedCreated);
          mappedCreated.forEach(evt => upsertEvent(evt));
        }
        
        setLocalEventsEpoch(n => n + 1);
      } catch (err) {
        console.error("Data fetch error", err);
      } finally {
        setLoadingCreatedEvents(false);
      }
    };

    fetchData();
  }, [user?.id]);

  const handleSave = async () => {
    updateUser({ name, bio });
    const token = getAuthToken();
    if (token) {
      try {
        await fetch(getApiUrl(API_ENDPOINTS.PROFILE_ME), {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({ full_name: name, bio }),
        });
      } catch (err) { console.error("Update error", err); }
    }
    setEditing(false);
    setToast({ show: true, message: 'Profile updated!', type: 'success' });
  };

  const handleLogout = () => {
    logout();
    clearAuthToken();
    navigate('/login');
  };

  const handleLeaveFromProfile = async (eventId: string) => {
    const token = getAuthToken();
    setLeavingEventId(eventId);
    if (token) {
      try {
        await fetch(getApiUrl(`/api/participants/${eventId}/leave`), {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        });
      } catch (err) { console.error(err); }
    }
    leaveEvent(eventId, user!.id);
    setRemoteJoinedEvents(prev => prev.filter(e => e.id !== eventId));
    setLeavingEventId(null);
    setToast({ show: true, message: 'Left event', type: 'success' });
  };

  // RENDER CHECKS
  if (profileLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    navigate('/login');
    return null;
  }

  const eventsTabCount = createdEvents.length + joinedEventsOnly.length;
  const age = calcAge(user.dob);

  return (
    <div className="min-h-screen bg-background pb-20">
      <AppToast message={toast.message} type={toast.type} show={toast.show} onClose={() => setToast(t => ({ ...t, show: false }))} />

      <div className="relative h-36 bg-gradient-to-r from-primary/30 to-accent/30">
        <div className="absolute top-3 right-3 z-10">
          <button onClick={handleLogout} className="flex items-center gap-1 text-xs text-foreground/80 glass-card rounded-full px-3 py-1.5">
            <LogOut className="h-3 w-3" /> Logout
          </button>
        </div>
      </div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mx-auto max-w-lg px-4 -mt-14 relative z-10 space-y-5">
        <div className="flex flex-col items-center gap-2">
          <UserAvatar
            src={user.profilePhoto}
            srcSecondary={user.avatar}
            seed={user.id}
            name={user.name}
            size="xl"
            className="ring-4 ring-background shadow-glow"
          />
          {editing ? (
            <input value={name} onChange={e => setName(e.target.value)} className="rounded-xl bg-secondary px-4 py-2 text-center outline-none focus:ring-2 focus:ring-primary/50" />
          ) : (
            <h2 className="text-xl font-bold">{user.name}</h2>
          )}
          <span className="rounded-full px-3 py-0.5 text-xs font-medium bg-primary/20 text-primary">
            {user.role === 'organizer' ? '🏢 Organizer' : 'Individual Account'}
          </span>
          <p className="text-sm text-muted-foreground">{user.email}</p>
        </div>

        <div className="rounded-2xl glass-card p-4 space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Bio</h3>
            <button onClick={editing ? handleSave : () => setEditing(true)} className="text-primary">
              {editing ? <Check className="h-4 w-4" /> : <Edit2 className="h-4 w-4" />}
            </button>
          </div>
          {editing ? (
            <textarea value={bio} onChange={e => setBio(e.target.value)} rows={3} className="w-full rounded-lg bg-secondary p-3 text-sm resize-none" />
          ) : (
            <p className="text-sm text-muted-foreground">{user.bio || 'No bio yet.'}</p>
          )}
        </div>

        {approvedRequests.length > 0 && (
          <div className="rounded-2xl glass-card p-4 space-y-3 glow-border">
            <h3 className="text-sm font-semibold flex items-center gap-2"><CreditCard className="h-4 w-4 text-accent" /> Pending Payments</h3>
            {approvedRequests.map((item: any) => (
              <div key={item.request.id} className="flex items-center gap-3 rounded-xl bg-secondary/50 p-3">
                <img src={item.event.image} alt="" className="h-10 w-10 rounded-lg object-cover" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{item.event.title}</p>
                  <p className="text-[10px] text-accent">Approved — Pay to join</p>
                </div>
                <button onClick={() => navigate(`/payment/${item.event.id}`)} className="gradient-primary rounded-full px-3 py-1 text-xs font-semibold text-primary-foreground shadow-glow">
                  Pay ${item.event.budget}
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex rounded-xl glass-card p-1">
          {['events', 'tickets', 'reviews', 'friends'].map((key) => (
            <button 
              key={key} 
              onClick={() => setActiveTab(key as any)}
              className={`flex-1 rounded-lg py-2 text-xs font-medium transition-all ${activeTab === key ? 'gradient-primary text-primary-foreground shadow-glow' : 'text-muted-foreground'}`}
            >
              {key.charAt(0).toUpperCase() + key.slice(1)}
            </button>
          ))}
        </div>

        <div className="space-y-2 min-h-[200px]">
          {activeTab === 'events' && (
            <div className="space-y-4">
              {loadingCreatedEvents && createdEvents.length === 0 && <p className="text-center text-xs py-8">Loading...</p>}
              
              {createdEvents.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[10px] font-semibold uppercase text-muted-foreground px-1">Created</p>
                  {createdEvents.map((e) => (
                    <button key={e.id} onClick={() => navigate(`/event/${e.id}`)} className="flex items-center gap-3 w-full text-left rounded-xl glass-card p-3 border border-primary/20">
                      <img src={e.image} alt="" className="h-10 w-10 rounded-lg object-cover" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">{e.title}</p>
                        <p className="text-[10px] text-accent">{e.date} · {e.participants.length} joined</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {joinedEventsOnly.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[10px] font-semibold uppercase text-muted-foreground px-1">Joined</p>
                  {joinedEventsOnly.map((e) => (
                    <div key={e.id} className="flex items-center gap-3 rounded-xl glass-card p-3">
                      <button onClick={() => navigate(`/event/${e.id}`)} className="flex-1 text-left min-w-0">
                        <p className="text-xs font-medium truncate">{e.title}</p>
                        <p className="text-[10px] text-muted-foreground">{e.date}</p>
                      </button>
                      <button onClick={() => handleLeaveFromProfile(e.id)} disabled={leavingEventId === e.id} className="rounded-full bg-secondary px-3 py-1 text-[10px]">
                        {leavingEventId === e.id ? '...' : 'Leave'}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          {activeTab === 'tickets' && <p className="text-center py-8 text-xs text-muted-foreground">No tickets yet.</p>}
          {activeTab === 'friends' && <p className="text-center py-8 text-xs text-muted-foreground">No friends yet.</p>}
        </div>
      </motion.div>
      <BottomNav />
    </div>
  );
}
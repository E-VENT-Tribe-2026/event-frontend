import { useState, useMemo, useEffect } from 'react';
import { getCurrentUser, updateUser, getEvents, getTickets, getUsers, getJoinRequests, leaveEvent, upsertEvent, type EventItem } from '@/lib/storage';
import { logout } from '@/lib/storage';
import { useNavigate } from 'react-router-dom';
import { LogOut, Edit2, Check, Calendar, Users, Star, Ticket, UserPlus, CreditCard } from 'lucide-react';
import { motion } from 'framer-motion';
import BottomNav from '@/components/BottomNav';
import AppToast from '@/components/AppToast';
import { getAuthToken, clearAuthToken } from '@/lib/auth';

function calcAge(dob: string): number | null {
  if (!dob) return null;
  const diff = Date.now() - new Date(dob).getTime();
  return Math.floor(diff / (365.25 * 24 * 60 * 60 * 1000));
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:8001';
const DEFAULT_IMAGE = 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=600&q=80';

function mapApiEventToItem(api: Record<string, unknown>): EventItem {
  const start = api.start_datetime ? new Date(api.start_datetime as string) : new Date();
  const dateStr = start.toISOString().slice(0, 10);
  const timeStr = start.toTimeString().slice(0, 5);
  const cost = Number(api.cost);
  const capacity = Number(api.max_capacity);
  return {
    id: (api.id as string) ?? '',
    title: (api.title as string) ?? '',
    description: (api.description as string) ?? '',
    category: (api.category as string) ?? 'Other',
    date: dateStr,
    time: timeStr,
    location: (api.location_name as string) ?? '',
    lat: typeof api.latitude === 'number' ? api.latitude : 0,
    lng: typeof api.longitude === 'number' ? api.longitude : 0,
    budget: Number.isFinite(cost) ? cost : 0,
    participantsLimit: Number.isFinite(capacity) ? capacity : 0,
    participants: [],
    image: DEFAULT_IMAGE,
    organizer: '',
    organizerId: (api.created_by as string) ?? '',
    organizerAvatar: '',
    isPrivate: false,
    isDraft: false,
    requiresApproval: false,
    reviews: [],
    reports: [],
    collaborators: [],
  };
}

export default function ProfilePage() {
  const navigate = useNavigate();
  const user = getCurrentUser();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(user?.name || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' as const });
  const [activeTab, setActiveTab] = useState<'events' | 'tickets' | 'reviews' | 'friends'>('events');
  const [remoteJoinedEvents, setRemoteJoinedEvents] = useState<EventItem[]>([]);
  const [leavingEventId, setLeavingEventId] = useState<string | null>(null);

  const events = useMemo(() => getEvents(), []);
  const tickets = useMemo(() => user ? getTickets().filter(t => t.userId === user.id) : [], [user]);
  const joinedEvents = useMemo(() => user ? events.filter(e => e.participants.includes(user.id)) : [], [events, user]);
  const allJoinedEvents = useMemo(() => {
    const byId = new Map<string, EventItem>();
    [...joinedEvents, ...remoteJoinedEvents].forEach((e) => byId.set(e.id, e));
    return Array.from(byId.values());
  }, [joinedEvents, remoteJoinedEvents]);
  const createdEvents = useMemo(() => user ? events.filter(e => e.organizerId === user.id) : [], [events, user]);
  const reviewsReceived = useMemo(() => {
    if (!user) return [];
    return createdEvents.flatMap(e => (e.reviews || []).map(r => ({ ...r, eventTitle: e.title })));
  }, [createdEvents, user]);
  const allUsers = getUsers();
  const friends = useMemo(() => user?.friends?.map(fId => allUsers.find(u => u.id === fId)).filter(Boolean) || [], [user, allUsers]);

  // Check for approved requests that need payment
  const approvedRequests = useMemo(() => {
    if (!user) return [];
    const reqs = getJoinRequests();
    return reqs.filter(r => r.userId === user.id && r.status === 'approved').map(r => {
      const evt = events.find(e => e.id === r.eventId);
      const alreadyJoined = evt?.participants.includes(user.id);
      return evt && !alreadyJoined ? { request: r, event: evt } : null;
    }).filter(Boolean);
  }, [user, events]);

  if (!user) { navigate('/login'); return null; }

  useEffect(() => {
    if (!user) return;
    const token = getAuthToken();
    if (!token) return;

    const loadMyJoinedEvents = async () => {
      try {
        const controller = new AbortController();
        const timeout = window.setTimeout(() => controller.abort(), 8000);
        const res = await fetch(`${API_BASE_URL}/api/participants/my/events`, {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        }).finally(() => window.clearTimeout(timeout));
        if (!res.ok) return;
        const data = await res.json().catch(() => []);
        if (!Array.isArray(data)) return;
        const mapped = data
          .map((row: any) => row?.events)
          .filter(Boolean)
          .map((evt: Record<string, unknown>) => mapApiEventToItem(evt));
        setRemoteJoinedEvents(mapped);
        mapped.forEach((evt) => {
          upsertEvent({ ...evt, participants: [...evt.participants, user.id] });
        });
      } catch {
        // Keep profile usable even if backend fetch fails.
      }
    };

    loadMyJoinedEvents();
  }, [user]);

  const age = calcAge(user.dob);
  const avatarSrc = user.profilePhoto || user.avatar;

  const handleSave = async () => {
    updateUser({ name, bio });

    // Also update profile in backend so Supabase data matches UI
    const token = getAuthToken();
    if (token) {
      try {
        await fetch(`${API_BASE_URL}/api/profile/me`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({
            full_name: name,
            bio,
          }),
        });
      } catch {
        // Ignore backend failure; local update already applied
      }
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
        await fetch(`${API_BASE_URL}/api/participants/${eventId}/leave`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        });
      } catch {
        // Keep local leave behavior as fallback.
      }
    }
    leaveEvent(eventId, user.id);
    setRemoteJoinedEvents((prev) => prev.filter((e) => e.id !== eventId));
    setLeavingEventId(null);
    setToast({ show: true, message: 'You left the event.', type: 'success' });
  };

  const tabs = [
    { key: 'events' as const, label: 'Events', count: allJoinedEvents.length },
    { key: 'tickets' as const, label: 'Tickets', count: tickets.length },
    { key: 'reviews' as const, label: 'Reviews', count: reviewsReceived.length },
    { key: 'friends' as const, label: 'Friends', count: friends.length },
  ];

  return (
    <div className="min-h-screen bg-background pb-20">
      <AppToast message={toast.message} type={toast.type} show={toast.show} onClose={() => setToast(t => ({ ...t, show: false }))} />

      {/* Cover photo area */}
      <div className="relative h-36 bg-gradient-to-r from-primary/30 to-accent/30 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-background" />
        <div className="absolute top-3 right-3 flex items-center gap-3 z-10">
          <button onClick={handleLogout} className="flex items-center gap-1 text-xs text-foreground/80 glass-card rounded-full px-3 py-1.5">
            <LogOut className="h-3 w-3" /> Logout
          </button>
        </div>
      </div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mx-auto max-w-lg px-4 -mt-14 relative z-10 space-y-5">
        {/* Avatar + Info */}
        <div className="flex flex-col items-center gap-2">
          <div className="relative">
            <img src={avatarSrc} alt="" className="h-24 w-24 rounded-full bg-secondary ring-4 ring-background object-cover shadow-glow" />
          </div>
          {editing ? (
            <input value={name} onChange={e => setName(e.target.value)} className="rounded-xl bg-secondary px-4 py-2 text-center text-foreground outline-none focus:ring-2 focus:ring-primary/50" />
          ) : (
            <h2 className="text-xl font-bold text-foreground">{user.name}</h2>
          )}
          <div className="flex items-center gap-2">
            <span className={`rounded-full px-3 py-0.5 text-xs font-medium ${user.role === 'organizer' ? 'bg-accent/20 text-accent' : 'bg-primary/20 text-primary'}`}>
              {user.role === 'organizer' ? '🏢 Organizer' : '🎉 Participant'}
            </span>
          </div>
          <p className="text-sm text-muted-foreground">{user.email}</p>
          <div className="flex gap-3 text-xs text-muted-foreground">
            {age !== null && <span>{age} years old</span>}
            {user.gender && <span>· {user.gender}</span>}
            {user.orgCategory && <span>· {user.orgCategory}</span>}
          </div>
        </div>

        {/* Bio */}
        <div className="rounded-2xl glass-card p-4 space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground">Bio</h3>
            <button onClick={editing ? handleSave : () => setEditing(true)} className="text-primary">
              {editing ? <Check className="h-4 w-4" /> : <Edit2 className="h-4 w-4" />}
            </button>
          </div>
          {editing ? (
            <textarea value={bio} onChange={e => setBio(e.target.value)} rows={3} className="w-full rounded-lg bg-secondary p-3 text-sm text-foreground outline-none resize-none focus:ring-2 focus:ring-primary/50" />
          ) : (
            <p className="text-sm text-muted-foreground">{user.bio}</p>
          )}
        </div>

        {/* Interests */}
        {user.interests && user.interests.length > 0 && (
          <div className="rounded-2xl glass-card p-4 space-y-2">
            <h3 className="text-sm font-semibold text-foreground">Interests</h3>
            <div className="flex flex-wrap gap-2">
              {user.interests.map(i => (
                <span key={i} className="rounded-full bg-primary/20 px-3 py-1 text-xs font-medium text-primary">{i}</span>
              ))}
            </div>
          </div>
        )}

        {/* Approved requests needing payment */}
        {approvedRequests.length > 0 && (
          <div className="rounded-2xl glass-card p-4 space-y-3 glow-border">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-accent" /> Proceed to Payment
            </h3>
            {approvedRequests.map((item: any) => (
              <div key={item.request.id} className="flex items-center gap-3 rounded-xl bg-secondary/50 p-3">
                <img src={item.event.image} alt="" className="h-10 w-10 rounded-lg object-cover" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-foreground truncate">{item.event.title}</p>
                  <p className="text-[10px] text-accent">✓ Approved — Pay to get your ticket</p>
                </div>
                <button onClick={() => navigate(`/payment/${item.event.id}`)}
                  className="gradient-primary rounded-full px-3 py-1 text-xs font-semibold text-primary-foreground shadow-glow">
                  Pay ${item.event.budget}
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Tabs */}
        <div className="flex rounded-xl glass-card p-1">
          {tabs.map(t => (
            <button key={t.key} onClick={() => setActiveTab(t.key)}
              className={`flex-1 rounded-lg py-2 text-xs font-medium transition-all ${activeTab === t.key ? 'gradient-primary text-primary-foreground shadow-glow' : 'text-muted-foreground'}`}>
              {t.label} ({t.count})
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="space-y-2 min-h-[200px]">
          {activeTab === 'events' && (
            <>
              {allJoinedEvents.length === 0 && createdEvents.length === 0 ? (
                <p className="text-center text-xs text-muted-foreground py-8">No events yet</p>
              ) : (
                <div className="space-y-2">
                  {user.role === 'organizer' && createdEvents.map(e => (
                    <button key={e.id} onClick={() => navigate(`/event/${e.id}`)} className="flex items-center gap-3 w-full text-left rounded-xl glass-card p-3 hover:shadow-glow transition-shadow">
                      <img src={e.image} alt="" className="h-10 w-10 rounded-lg object-cover" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-foreground truncate">{e.title}</p>
                        <p className="text-[10px] text-accent">Created · {e.participants.length} joined</p>
                      </div>
                    </button>
                  ))}
                  {allJoinedEvents.map(e => (
                    <div key={e.id} className="flex items-center gap-3 rounded-xl glass-card p-3 hover:shadow-glow transition-shadow">
                      <button onClick={() => navigate(`/event/${e.id}`)} className="flex items-center gap-3 min-w-0 flex-1 text-left">
                        <img src={e.image} alt="" className="h-10 w-10 rounded-lg object-cover" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-foreground truncate">{e.title}</p>
                          <p className="text-[10px] text-muted-foreground">{e.date}</p>
                        </div>
                      </button>
                      <button
                        onClick={() => handleLeaveFromProfile(e.id)}
                        disabled={leavingEventId === e.id}
                        className="rounded-full bg-secondary px-3 py-1 text-[10px] font-semibold text-foreground disabled:opacity-50"
                      >
                        {leavingEventId === e.id ? 'Leaving...' : 'Leave'}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {activeTab === 'tickets' && (
            tickets.length === 0 ? (
              <p className="text-center text-xs text-muted-foreground py-8">No tickets yet</p>
            ) : (
              <div className="space-y-2">
                {tickets.map(t => (
                  <button key={t.id} onClick={() => navigate(`/ticket/${t.id}`)}
                    className="flex items-center gap-3 w-full text-left rounded-xl glass-card p-3 hover:shadow-glow transition-shadow">
                    <div className="rounded-lg gradient-primary p-2">
                      <Ticket className="h-4 w-4 text-primary-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-foreground truncate">{t.eventTitle}</p>
                      <p className="text-[10px] text-muted-foreground">{t.eventDate} · {t.eventTime}</p>
                    </div>
                    <span className="text-[10px] text-primary font-mono">{t.id.slice(0, 8)}</span>
                  </button>
                ))}
              </div>
            )
          )}

          {activeTab === 'reviews' && (
            reviewsReceived.length === 0 ? (
              <p className="text-center text-xs text-muted-foreground py-8">No reviews yet</p>
            ) : (
              <div className="space-y-2">
                {reviewsReceived.map((r, i) => (
                  <div key={i} className="rounded-xl glass-card p-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-foreground">{r.user}</span>
                      <div className="flex">{Array.from({ length: r.rating }, (_, j) => <Star key={j} className="h-3 w-3 fill-accent text-accent" />)}</div>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-0.5">on {r.eventTitle}: {r.text}</p>
                  </div>
                ))}
              </div>
            )
          )}

          {activeTab === 'friends' && (
            friends.length === 0 ? (
              <div className="text-center py-8 space-y-2">
                <UserPlus className="h-8 w-8 text-muted-foreground mx-auto" />
                <p className="text-xs text-muted-foreground">No friends yet</p>
              </div>
            ) : (
              <div className="space-y-2">
                {friends.map((f: any) => (
                  <div key={f.id} className="flex items-center gap-3 rounded-xl glass-card p-3">
                    <img src={f.profilePhoto || f.avatar} alt="" className="h-10 w-10 rounded-full bg-secondary" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-foreground truncate">{f.name}</p>
                      <p className="text-[10px] text-muted-foreground">{f.interests?.slice(0, 2).join(', ')}</p>
                    </div>
                  </div>
                ))}
              </div>
            )
          )}
        </div>

      </motion.div>

      <BottomNav />
    </div>
  );
}

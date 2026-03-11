import { useState, useMemo } from 'react';
import { getCurrentUser, updateUser, getEvents, getTickets, getUsers, getJoinRequests } from '@/lib/storage';
import { logout } from '@/lib/storage';
import { useNavigate } from 'react-router-dom';
import { LogOut, Edit2, Check, Calendar, Users, Star, Ticket, Crown, UserPlus, CreditCard } from 'lucide-react';
import { motion } from 'framer-motion';
import BottomNav from '@/components/BottomNav';
import AppToast from '@/components/AppToast';

function calcAge(dob: string): number | null {
  if (!dob) return null;
  const diff = Date.now() - new Date(dob).getTime();
  return Math.floor(diff / (365.25 * 24 * 60 * 60 * 1000));
}

export default function ProfilePage() {
  const navigate = useNavigate();
  const user = getCurrentUser();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(user?.name || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' as const });
  const [activeTab, setActiveTab] = useState<'events' | 'tickets' | 'reviews' | 'friends'>('events');

  const events = useMemo(() => getEvents(), []);
  const tickets = useMemo(() => user ? getTickets().filter(t => t.userId === user.id) : [], [user]);
  const joinedEvents = useMemo(() => user ? events.filter(e => e.participants.includes(user.id)) : [], [events, user]);
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

  const age = calcAge(user.dob);
  const avatarSrc = user.profilePhoto || user.avatar;

  const handleSave = () => {
    updateUser({ name, bio });
    setEditing(false);
    setToast({ show: true, message: 'Profile updated!', type: 'success' });
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const tabs = [
    { key: 'events' as const, label: 'Events', count: joinedEvents.length },
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
          {user.isPremium && <span className="rounded-full gradient-primary px-2.5 py-1 text-[10px] font-bold text-primary-foreground flex items-center gap-1"><Crown className="h-3 w-3" /> Premium</span>}
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
            {user.isPremium && (
              <div className="absolute -bottom-1 -right-1 rounded-full gradient-primary p-1.5 shadow-glow">
                <Crown className="h-3.5 w-3.5 text-primary-foreground" />
              </div>
            )}
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
              {joinedEvents.length === 0 && createdEvents.length === 0 ? (
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
                  {joinedEvents.map(e => (
                    <button key={e.id} onClick={() => navigate(`/event/${e.id}`)} className="flex items-center gap-3 w-full text-left rounded-xl glass-card p-3 hover:shadow-glow transition-shadow">
                      <img src={e.image} alt="" className="h-10 w-10 rounded-lg object-cover" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-foreground truncate">{e.title}</p>
                        <p className="text-[10px] text-muted-foreground">{e.date}</p>
                      </div>
                    </button>
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

        {/* Premium CTA */}
        {!user.isPremium && (
          <button onClick={() => navigate('/premium')}
            className="w-full rounded-xl py-3 text-sm font-semibold text-primary-foreground shadow-glow ripple-container gradient-primary">
            ⭐ Upgrade to Premium
          </button>
        )}
      </motion.div>

      <BottomNav />
    </div>
  );
}

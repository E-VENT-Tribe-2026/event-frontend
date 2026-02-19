import { useState, useMemo } from 'react';
import { getCurrentUser, updateUser, getEvents } from '@/lib/storage';
import { logout } from '@/lib/storage';
import { useNavigate } from 'react-router-dom';
import { LogOut, Edit2, Check, Calendar, Users, Star } from 'lucide-react';
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

  const events = useMemo(() => getEvents(), []);
  const joinedEvents = useMemo(() => user ? events.filter(e => e.participants.includes(user.id)) : [], [events, user]);
  const createdEvents = useMemo(() => user ? events.filter(e => e.organizerId === user.id) : [], [events, user]);
  const reviewsReceived = useMemo(() => {
    if (!user) return [];
    return createdEvents.flatMap(e => (e.reviews || []).map(r => ({ ...r, eventTitle: e.title })));
  }, [createdEvents, user]);

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

  return (
    <div className="min-h-screen bg-background pb-20">
      <AppToast message={toast.message} type={toast.type} show={toast.show} onClose={() => setToast(t => ({ ...t, show: false }))} />

      <header className="sticky top-0 z-40 flex items-center justify-between border-b border-border bg-background/95 backdrop-blur-lg px-4 py-3">
        <h1 className="text-lg font-bold text-foreground">Profile</h1>
        <button onClick={handleLogout} className="flex items-center gap-1 text-sm text-destructive">
          <LogOut className="h-4 w-4" /> Logout
        </button>
      </header>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mx-auto max-w-lg px-4 pt-6 space-y-6">
        {/* Avatar + Info */}
        <div className="flex flex-col items-center gap-3">
          <img src={avatarSrc} alt="" className="h-24 w-24 rounded-full bg-secondary ring-4 ring-primary/30 object-cover" />
          {editing ? (
            <input value={name} onChange={e => setName(e.target.value)} className="rounded-xl bg-secondary px-4 py-2 text-center text-foreground outline-none focus:ring-2 focus:ring-primary/50" />
          ) : (
            <h2 className="text-xl font-bold text-foreground">{user.name}</h2>
          )}
          <p className="text-sm text-muted-foreground">{user.email}</p>
          <div className="flex gap-3 text-xs text-muted-foreground">
            {age !== null && <span>{age} years old</span>}
            {user.gender && <span>· {user.gender}</span>}
          </div>
        </div>

        {/* Bio */}
        <div className="rounded-xl gradient-card p-4 shadow-card space-y-2">
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
        <div className="rounded-xl gradient-card p-4 shadow-card space-y-2">
          <h3 className="text-sm font-semibold text-foreground">Interests</h3>
          <div className="flex flex-wrap gap-2">
            {user.interests.map(i => (
              <span key={i} className="rounded-full bg-primary/20 px-3 py-1 text-xs font-medium text-primary">{i}</span>
            ))}
          </div>
        </div>

        {/* Joined Events */}
        <div className="rounded-xl gradient-card p-4 shadow-card space-y-2">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2"><Users className="h-4 w-4 text-primary" /> Joined Events ({joinedEvents.length})</h3>
          {joinedEvents.length === 0 ? (
            <p className="text-xs text-muted-foreground">No events joined yet.</p>
          ) : (
            <div className="space-y-2 max-h-40 overflow-y-auto custom-scrollbar">
              {joinedEvents.map(e => (
                <button key={e.id} onClick={() => navigate(`/event/${e.id}`)} className="flex items-center gap-3 w-full text-left rounded-lg bg-secondary/50 p-2 hover:bg-secondary transition-colors">
                  <img src={e.image} alt="" className="h-10 w-10 rounded-lg object-cover" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-foreground truncate">{e.title}</p>
                    <p className="text-[10px] text-muted-foreground">{e.date}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Created Events */}
        <div className="rounded-xl gradient-card p-4 shadow-card space-y-2">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2"><Calendar className="h-4 w-4 text-accent" /> Created Events ({createdEvents.length})</h3>
          {createdEvents.length === 0 ? (
            <p className="text-xs text-muted-foreground">No events created yet.</p>
          ) : (
            <div className="space-y-2 max-h-40 overflow-y-auto custom-scrollbar">
              {createdEvents.map(e => (
                <button key={e.id} onClick={() => navigate(`/event/${e.id}`)} className="flex items-center gap-3 w-full text-left rounded-lg bg-secondary/50 p-2 hover:bg-secondary transition-colors">
                  <img src={e.image} alt="" className="h-10 w-10 rounded-lg object-cover" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-foreground truncate">{e.title}</p>
                    <p className="text-[10px] text-muted-foreground">{e.date}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Reviews Received */}
        <div className="rounded-xl gradient-card p-4 shadow-card space-y-2">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2"><Star className="h-4 w-4 text-accent" /> Reviews Received ({reviewsReceived.length})</h3>
          {reviewsReceived.length === 0 ? (
            <p className="text-xs text-muted-foreground">No reviews yet.</p>
          ) : (
            <div className="space-y-2">
              {reviewsReceived.map((r, i) => (
                <div key={i} className="rounded-lg bg-secondary/50 p-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-foreground">{r.user}</span>
                    <div className="flex">{Array.from({ length: r.rating }, (_, j) => <Star key={j} className="h-3 w-3 fill-accent text-accent" />)}</div>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-0.5">on {r.eventTitle}: {r.text}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </motion.div>

      <BottomNav />
    </div>
  );
}

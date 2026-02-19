import { useState } from 'react';
import { getCurrentUser, updateUser } from '@/lib/storage';
import { logout } from '@/lib/storage';
import { useNavigate } from 'react-router-dom';
import { LogOut, Edit2, Check } from 'lucide-react';
import { motion } from 'framer-motion';
import BottomNav from '@/components/BottomNav';
import AppToast from '@/components/AppToast';

export default function ProfilePage() {
  const navigate = useNavigate();
  const user = getCurrentUser();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(user?.name || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' as const });

  if (!user) { navigate('/login'); return null; }

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
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <img src={user.avatar} alt="" className="h-24 w-24 rounded-full bg-secondary ring-4 ring-primary/30" />
          </div>
          {editing ? (
            <input value={name} onChange={e => setName(e.target.value)} className="rounded-xl bg-secondary px-4 py-2 text-center text-foreground outline-none focus:ring-2 focus:ring-primary/50" />
          ) : (
            <h2 className="text-xl font-bold text-foreground">{user.name}</h2>
          )}
          <p className="text-sm text-muted-foreground">{user.email}</p>
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

        {/* Past events placeholder */}
        <div className="rounded-xl gradient-card p-4 shadow-card space-y-2">
          <h3 className="text-sm font-semibold text-foreground">Past Events</h3>
          <p className="text-xs text-muted-foreground">No past events yet. Join some events!</p>
        </div>
      </motion.div>

      <BottomNav />
    </div>
  );
}

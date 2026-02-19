import { useParams, useNavigate } from 'react-router-dom';
import { getEvents, joinEvent, getCurrentUser } from '@/lib/storage';
import { ArrowLeft, MapPin, Clock, Users, Star, Flag } from 'lucide-react';
import { motion } from 'framer-motion';
import { useState } from 'react';
import AppToast from '@/components/AppToast';
import BottomNav from '@/components/BottomNav';

export default function EventDetailsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const events = getEvents();
  const event = events.find(e => e.id === id);
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' as 'success' | 'error' });

  if (!event) return <div className="flex min-h-screen items-center justify-center bg-background text-foreground">Event not found</div>;

  const handleJoin = () => {
    const user = getCurrentUser();
    if (!user) { navigate('/login'); return; }
    if (event.participants.includes(user.id)) {
      setToast({ show: true, message: 'Already joined!', type: 'error' });
      return;
    }
    joinEvent(event.id, user.id);
    setToast({ show: true, message: 'Successfully joined!', type: 'success' });
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <AppToast message={toast.message} type={toast.type} show={toast.show} onClose={() => setToast(t => ({ ...t, show: false }))} />

      {/* Banner */}
      <div className="relative h-56">
        <img src={event.image} alt={event.title} className="h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-background to-transparent" />
        <button onClick={() => navigate(-1)} className="absolute top-4 left-4 rounded-full bg-background/50 backdrop-blur-md p-2">
          <ArrowLeft className="h-5 w-5 text-foreground" />
        </button>
      </div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mx-auto max-w-lg px-4 -mt-8 relative z-10 space-y-6">
        <div className="rounded-xl gradient-card p-5 shadow-card space-y-4">
          <div className="flex items-start justify-between gap-2">
            <h1 className="text-xl font-bold text-foreground">{event.title}</h1>
            <span className="shrink-0 rounded-full bg-primary/20 px-3 py-1 text-xs font-medium text-primary">{event.category}</span>
          </div>

          {/* Organizer */}
          <div className="flex items-center gap-3">
            <img src={event.organizerAvatar} alt="" className="h-10 w-10 rounded-full bg-secondary" />
            <div>
              <p className="text-sm font-medium text-foreground">{event.organizer}</p>
              <p className="text-xs text-muted-foreground">Organizer</p>
            </div>
          </div>

          <p className="text-sm text-muted-foreground leading-relaxed">{event.description}</p>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="flex items-center gap-2 text-muted-foreground"><Clock className="h-4 w-4 text-primary" />{event.date} · {event.time}</div>
            <div className="flex items-center gap-2 text-muted-foreground"><MapPin className="h-4 w-4 text-accent" />{event.location}</div>
            <div className="flex items-center gap-2 text-muted-foreground"><Users className="h-4 w-4 text-primary" />{event.participants.length}/{event.participantsLimit}</div>
            <div className="flex items-center gap-2 text-muted-foreground">${event.budget === 0 ? 'Free' : event.budget}</div>
          </div>

          {/* Participant avatars */}
          <div className="flex -space-x-2">
            {event.participants.slice(0, 5).map((_, i) => (
              <div key={i} className="h-8 w-8 rounded-full border-2 border-card bg-secondary shimmer" />
            ))}
            {event.participants.length > 5 && <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-card bg-secondary text-xs text-muted-foreground">+{event.participants.length - 5}</div>}
          </div>
        </div>

        {/* Reviews */}
        {event.reviews.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-base font-semibold text-foreground">Reviews</h2>
            {event.reviews.map((r, i) => (
              <div key={i} className="rounded-xl bg-secondary p-4 space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-foreground">{r.user}</span>
                  <div className="flex">{Array.from({ length: r.rating }, (_, j) => <Star key={j} className="h-3 w-3 fill-accent text-accent" />)}</div>
                </div>
                <p className="text-xs text-muted-foreground">{r.text}</p>
              </div>
            ))}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <button onClick={handleJoin} className="flex-1 gradient-primary rounded-xl py-3 text-sm font-semibold text-primary-foreground shadow-glow ripple-container transition-transform active:scale-[0.98]">
            Join Event
          </button>
          <button className="rounded-xl bg-secondary px-4 py-3 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <Flag className="h-4 w-4" />
          </button>
        </div>
      </motion.div>

      <BottomNav />
    </div>
  );
}

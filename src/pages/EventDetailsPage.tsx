import { useParams, useNavigate } from 'react-router-dom';
import { getEvents, joinEvent, getCurrentUser, addReview, reportEvent } from '@/lib/storage';
import { ArrowLeft, MapPin, Clock, Users, Star, Flag, Send } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useState } from 'react';
import AppToast from '@/components/AppToast';
import BottomNav from '@/components/BottomNav';

export default function EventDetailsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [events, setEventsState] = useState(getEvents());
  const event = events.find(e => e.id === id);
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' as 'success' | 'error' });
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [reviewText, setReviewText] = useState('');
  const [reviewRating, setReviewRating] = useState(5);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState('');

  if (!event) return <div className="flex min-h-screen items-center justify-center bg-background text-foreground">Event not found</div>;

  const user = getCurrentUser();
  const hasJoined = user ? event.participants.includes(user.id) : false;
  const alreadyReviewed = user ? (event.reviews || []).some(r => r.userId === user?.id) : false;
  const alreadyReported = user ? (event.reports || []).some(r => r.userId === user?.id) : false;

  const handleJoin = () => {
    if (!user) { navigate('/login'); return; }
    if (hasJoined) {
      setToast({ show: true, message: 'Already joined!', type: 'error' });
      return;
    }
    joinEvent(event.id, user.id);
    setEventsState(getEvents());
    setToast({ show: true, message: 'Successfully joined!', type: 'success' });
  };

  const handleReview = () => {
    if (!user || !reviewText.trim()) return;
    addReview(event.id, { userId: user.id, user: user.name, text: reviewText, rating: reviewRating });
    setEventsState(getEvents());
    setReviewText('');
    setShowReviewForm(false);
    setToast({ show: true, message: 'Review submitted!', type: 'success' });
  };

  const handleReport = () => {
    if (!user || !reportReason.trim()) return;
    reportEvent(event.id, { userId: user.id, reason: reportReason, time: new Date().toISOString() });
    setEventsState(getEvents());
    setReportReason('');
    setShowReportModal(false);
    setToast({ show: true, message: 'Report submitted.', type: 'success' });
  };

  const reviews = event.reviews || [];

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
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-foreground">Reviews ({reviews.length})</h2>
            {hasJoined && !alreadyReviewed && (
              <button onClick={() => setShowReviewForm(!showReviewForm)} className="text-xs text-primary font-medium">
                Write Review
              </button>
            )}
          </div>

          <AnimatePresence>
            {showReviewForm && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="rounded-xl bg-secondary p-4 space-y-3">
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map(s => (
                    <button key={s} onClick={() => setReviewRating(s)}>
                      <Star className={`h-5 w-5 ${s <= reviewRating ? 'fill-accent text-accent' : 'text-muted-foreground'}`} />
                    </button>
                  ))}
                </div>
                <textarea value={reviewText} onChange={e => setReviewText(e.target.value)} placeholder="Share your experience..." rows={2}
                  className="w-full rounded-lg bg-muted p-3 text-sm text-foreground outline-none resize-none focus:ring-2 focus:ring-primary/50" />
                <button onClick={handleReview} className="flex items-center gap-2 gradient-primary rounded-lg px-4 py-2 text-xs font-semibold text-primary-foreground">
                  <Send className="h-3 w-3" /> Submit
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {reviews.length > 0 ? reviews.map((r, i) => (
            <div key={i} className="rounded-xl bg-secondary p-4 space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-foreground">{r.user}</span>
                <div className="flex">{Array.from({ length: r.rating }, (_, j) => <Star key={j} className="h-3 w-3 fill-accent text-accent" />)}</div>
              </div>
              <p className="text-xs text-muted-foreground">{r.text}</p>
            </div>
          )) : (
            <p className="text-xs text-muted-foreground">No reviews yet.</p>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button onClick={handleJoin} className="flex-1 gradient-primary rounded-xl py-3 text-sm font-semibold text-primary-foreground shadow-glow ripple-container transition-transform active:scale-[0.98]">
            {hasJoined ? 'Joined ✓' : 'Join Event'}
          </button>
          <button onClick={() => alreadyReported ? setToast({ show: true, message: 'Already reported', type: 'error' }) : setShowReportModal(true)}
            className="rounded-xl bg-secondary px-4 py-3 text-sm text-muted-foreground hover:text-destructive transition-colors">
            <Flag className="h-4 w-4" />
          </button>
        </div>
      </motion.div>

      {/* Report Modal */}
      <AnimatePresence>
        {showReportModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm px-6">
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }} className="w-full max-w-sm rounded-2xl gradient-card p-6 shadow-card space-y-4">
              <h3 className="text-lg font-bold text-foreground">Report Event</h3>
              <textarea value={reportReason} onChange={e => setReportReason(e.target.value)} placeholder="Describe the issue..."
                rows={3} className="w-full rounded-lg bg-secondary p-3 text-sm text-foreground outline-none resize-none focus:ring-2 focus:ring-primary/50" />
              <div className="flex gap-3">
                <button onClick={handleReport} className="flex-1 gradient-primary rounded-xl py-2.5 text-sm font-semibold text-primary-foreground">Submit</button>
                <button onClick={() => setShowReportModal(false)} className="flex-1 rounded-xl bg-secondary py-2.5 text-sm text-muted-foreground">Cancel</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <BottomNav />
    </div>
  );
}

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { addEvent, getCurrentUser, type EventItem } from '@/lib/storage';
import { CATEGORIES } from '@/lib/seedData';
import { motion } from 'framer-motion';
import AppToast from '@/components/AppToast';
import BottomNav from '@/components/BottomNav';

const EVENT_IMAGES = [
  'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=600&q=80',
  'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=600&q=80',
  'https://images.unsplash.com/photo-1501281668745-f7f57925c3b4?w=600&q=80',
  'https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?w=600&q=80',
];

export default function CreateEventPage() {
  const navigate = useNavigate();
  const user = getCurrentUser();
  const [form, setForm] = useState({ title: '', description: '', category: 'Music', date: '', time: '', location: '', budget: '0', limit: '50', isPrivate: false });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' as 'success' | 'error' });

  const update = (key: string, value: string | boolean) => setForm(f => ({ ...f, [key]: value }));

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.title.trim()) e.title = 'Required';
    if (!form.description.trim()) e.description = 'Required';
    if (!form.date) e.date = 'Required';
    if (!form.time) e.time = 'Required';
    if (!form.location.trim()) e.location = 'Required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) { navigate('/login'); return; }
    if (!validate()) return;

    const newEvent: EventItem = {
      id: crypto.randomUUID(),
      title: form.title,
      description: form.description,
      category: form.category,
      date: form.date,
      time: form.time,
      location: form.location,
      lat: 40.7128 + (Math.random() - 0.5) * 0.1,
      lng: -74.006 + (Math.random() - 0.5) * 0.1,
      budget: Number(form.budget),
      participantsLimit: Number(form.limit),
      participants: [user.id],
      image: EVENT_IMAGES[Math.floor(Math.random() * EVENT_IMAGES.length)],
      organizer: user.name,
      organizerAvatar: user.avatar,
      isPrivate: form.isPrivate,
      reviews: [],
    };
    addEvent(newEvent);
    setToast({ show: true, message: 'Event published!', type: 'success' });
    setTimeout(() => navigate('/home'), 1500);
  };

  const inputCls = "w-full rounded-xl bg-secondary px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-primary/50";

  return (
    <div className="min-h-screen bg-background pb-20">
      <AppToast message={toast.message} type={toast.type} show={toast.show} onClose={() => setToast(t => ({ ...t, show: false }))} />

      <header className="sticky top-0 z-40 flex items-center gap-3 border-b border-border bg-background/95 backdrop-blur-lg px-4 py-3">
        <button onClick={() => navigate(-1)}><ArrowLeft className="h-5 w-5 text-foreground" /></button>
        <h1 className="text-lg font-bold text-foreground">Create Event</h1>
      </header>

      <motion.form
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        onSubmit={handleSubmit}
        className="mx-auto max-w-lg space-y-4 px-4 pt-4"
      >
        <div>
          <input placeholder="Event Title" value={form.title} onChange={e => update('title', e.target.value)} className={inputCls} />
          {errors.title && <p className="mt-1 text-xs text-destructive">{errors.title}</p>}
        </div>
        <div>
          <textarea placeholder="Description" rows={3} value={form.description} onChange={e => update('description', e.target.value)} className={inputCls + ' resize-none'} />
          {errors.description && <p className="mt-1 text-xs text-destructive">{errors.description}</p>}
        </div>
        <select value={form.category} onChange={e => update('category', e.target.value)} className={inputCls}>
          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <input type="date" value={form.date} onChange={e => update('date', e.target.value)} className={inputCls} />
            {errors.date && <p className="mt-1 text-xs text-destructive">{errors.date}</p>}
          </div>
          <div>
            <input type="time" value={form.time} onChange={e => update('time', e.target.value)} className={inputCls} />
            {errors.time && <p className="mt-1 text-xs text-destructive">{errors.time}</p>}
          </div>
        </div>
        <div>
          <input placeholder="Location" value={form.location} onChange={e => update('location', e.target.value)} className={inputCls} />
          {errors.location && <p className="mt-1 text-xs text-destructive">{errors.location}</p>}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <input type="number" placeholder="Budget ($)" value={form.budget} onChange={e => update('budget', e.target.value)} className={inputCls} />
          <input type="number" placeholder="Max Participants" value={form.limit} onChange={e => update('limit', e.target.value)} className={inputCls} />
        </div>

        <div className="flex items-center justify-between rounded-xl bg-secondary px-4 py-3">
          <span className="text-sm text-foreground">Private Event</span>
          <button type="button" onClick={() => update('isPrivate', !form.isPrivate)}
            className={`h-6 w-11 rounded-full transition-colors ${form.isPrivate ? 'bg-primary' : 'bg-muted'}`}>
            <div className={`h-5 w-5 rounded-full bg-foreground transition-transform ${form.isPrivate ? 'translate-x-5' : 'translate-x-0.5'}`} />
          </button>
        </div>

        <button type="submit" className="w-full gradient-primary rounded-xl py-3 text-sm font-semibold text-primary-foreground shadow-glow ripple-container transition-transform active:scale-[0.98]">
          Publish Event
        </button>
      </motion.form>

      <BottomNav />
    </div>
  );
}

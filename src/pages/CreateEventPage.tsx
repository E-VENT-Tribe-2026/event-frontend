import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, ShieldCheck } from 'lucide-react';
import { addEvent, getCurrentUser, saveDraft, type EventItem } from '@/lib/storage';
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
  const [form, setForm] = useState({
    title: '', description: '', category: 'Music', date: '', time: '', location: '',
    budget: '0', limit: '50', isPrivate: false, requiresApproval: false,
  });
  const [surveyQuestions, setSurveyQuestions] = useState<{ question: string; options: string[] }[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' as 'success' | 'error' });

  // Participants can't create events
  if (user?.role === 'participant') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background pb-20">
        <div className="text-center space-y-3 px-6">
          <p className="text-lg font-semibold text-foreground">Only Organizers can create events</p>
          <p className="text-sm text-muted-foreground">Switch to an organizer account to create events</p>
          <button onClick={() => navigate('/home')} className="gradient-primary rounded-xl px-6 py-2 text-sm text-primary-foreground">Go Home</button>
        </div>
        <BottomNav />
      </div>
    );
  }

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

  const buildEvent = (isDraft: boolean): EventItem => ({
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
    participants: [],
    image: EVENT_IMAGES[Math.floor(Math.random() * EVENT_IMAGES.length)],
    organizer: user?.name || 'Anonymous',
    organizerId: user?.id || '',
    organizerAvatar: user?.profilePhoto || user?.avatar || '',
    isPrivate: form.isPrivate,
    isDraft,
    requiresApproval: form.requiresApproval,
    reviews: [],
    reports: [],
    collaborators: [],
    survey: surveyQuestions.length > 0 ? surveyQuestions : undefined,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) { navigate('/login'); return; }
    if (!validate()) return;
    addEvent(buildEvent(false));
    setToast({ show: true, message: 'Event published!', type: 'success' });
    setTimeout(() => navigate('/home'), 1500);
  };

  const handleSaveDraft = () => {
    if (!user) { navigate('/login'); return; }
    if (!form.title.trim()) { setErrors({ title: 'Title required for draft' }); return; }
    saveDraft(buildEvent(true));
    setToast({ show: true, message: 'Draft saved!', type: 'success' });
  };

  const addSurveyQuestion = () => {
    setSurveyQuestions([...surveyQuestions, { question: '', options: ['', ''] }]);
  };

  const updateSurveyQuestion = (idx: number, question: string) => {
    setSurveyQuestions(qs => qs.map((q, i) => i === idx ? { ...q, question } : q));
  };

  const updateSurveyOption = (qIdx: number, oIdx: number, value: string) => {
    setSurveyQuestions(qs => qs.map((q, i) => i === qIdx ? { ...q, options: q.options.map((o, j) => j === oIdx ? value : o) } : q));
  };

  const inputCls = "w-full rounded-xl bg-secondary px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-primary/50";

  return (
    <div className="min-h-screen bg-background pb-20">
      <AppToast message={toast.message} type={toast.type} show={toast.show} onClose={() => setToast(t => ({ ...t, show: false }))} />

      <header className="sticky top-0 z-40 flex items-center gap-3 border-b border-border bg-background/95 backdrop-blur-lg px-4 py-3">
        <button onClick={() => navigate(-1)}><ArrowLeft className="h-5 w-5 text-foreground" /></button>
        <h1 className="text-lg font-bold text-foreground">Create Event</h1>
      </header>

      <motion.form initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} onSubmit={handleSubmit} className="mx-auto max-w-lg space-y-4 px-4 pt-4">
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
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Max Participants: {form.limit}</label>
            <input type="range" min="10" max="1000" value={form.limit} onChange={e => update('limit', e.target.value)} className="w-full accent-primary" />
          </div>
        </div>

        {/* Toggles */}
        <div className="space-y-3">
          <div className="flex items-center justify-between rounded-xl bg-secondary px-4 py-3">
            <span className="text-sm text-foreground">Private Event</span>
            <button type="button" onClick={() => update('isPrivate', !form.isPrivate)}
              className={`h-6 w-11 rounded-full transition-colors ${form.isPrivate ? 'bg-primary' : 'bg-muted'}`}>
              <div className={`h-5 w-5 rounded-full bg-foreground transition-transform ${form.isPrivate ? 'translate-x-5' : 'translate-x-0.5'}`} />
            </button>
          </div>
          <div className="flex items-center justify-between rounded-xl bg-secondary px-4 py-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-primary" />
              <span className="text-sm text-foreground">Require Approval</span>
            </div>
            <button type="button" onClick={() => update('requiresApproval', !form.requiresApproval)}
              className={`h-6 w-11 rounded-full transition-colors ${form.requiresApproval ? 'bg-primary' : 'bg-muted'}`}>
              <div className={`h-5 w-5 rounded-full bg-foreground transition-transform ${form.requiresApproval ? 'translate-x-5' : 'translate-x-0.5'}`} />
            </button>
          </div>
        </div>

        {/* Survey Builder */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-foreground">Survey Questions</span>
            <button type="button" onClick={addSurveyQuestion} className="text-xs text-primary font-medium">+ Add Question</button>
          </div>
          {surveyQuestions.map((q, qi) => (
            <div key={qi} className="rounded-xl bg-secondary p-3 space-y-2">
              <input placeholder={`Question ${qi + 1}`} value={q.question} onChange={e => updateSurveyQuestion(qi, e.target.value)}
                className="w-full rounded-lg bg-muted px-3 py-2 text-sm text-foreground outline-none" />
              {q.options.map((o, oi) => (
                <input key={oi} placeholder={`Option ${oi + 1}`} value={o} onChange={e => updateSurveyOption(qi, oi, e.target.value)}
                  className="w-full rounded-lg bg-muted px-3 py-2 text-xs text-foreground outline-none" />
              ))}
            </div>
          ))}
        </div>

        <div className="flex gap-3">
          <button type="button" onClick={handleSaveDraft}
            className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-secondary py-3 text-sm font-semibold text-foreground transition-transform active:scale-[0.98]">
            <Save className="h-4 w-4" /> Save Draft
          </button>
          <button type="submit" className="flex-1 gradient-primary rounded-xl py-3 text-sm font-semibold text-primary-foreground shadow-glow ripple-container transition-transform active:scale-[0.98]">
            Publish Event
          </button>
        </div>
      </motion.form>

      <BottomNav />
    </div>
  );
}

import { useState, useEffect, type ReactNode } from 'react';
import { Navigate, useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Type, Calendar, MapPin, Users, Euro, Clock } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { addEvent, getCurrentUser, type EventItem } from '@/lib/storage';
import { supabase } from '@/lib/supabase';
import { motion } from 'framer-motion';
import AppToast from '@/components/AppToast';
import BottomNav from '@/components/BottomNav';
import TopBar from '@/components/TopBar';
import CategoryPills from '@/components/CategoryPills';
import EventBannerField from '@/components/EventBannerField';
import { getCategoryBanner } from '@/lib/categoryBanners';
import { publicBannerUrl, uploadEventBanner } from '@/lib/eventBanner';
import { clampRepeatCount, recurringStartDates, type RepeatFreq } from '@/lib/eventRecurrence';
import { getApiUrl } from '@/lib/api';
import { API_ENDPOINTS } from '@/lib/apiUrls';
import { getAuthToken, setAuthToken } from '@/lib/auth';
import { hasSignedInSession } from '@/lib/signedIn';
import { pickImageUrl, getGeneratedAvatarUrl } from '@/lib/avatars';
import LocationPickerMap, { hasValidEventCoordinates } from '@/components/LocationPickerMap';
import LocationSearchInput, { type LocationResult } from '@/components/LocationSearchInput';
import { invalidateEvents, prependCreatedEvent } from '@/lib/queries';
import { localDateTimeParts } from '@/lib/eventTime';
import { mapApiEventToItem } from '@/lib/mapApiEvent';
import { sanitizeText } from '@/lib/sanitize';

function FormSection({
  icon: Icon,
  title,
  children,
}: {
  icon: LucideIcon;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-2.5">
      <div className="flex items-center gap-2.5 px-0.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/15 shadow-sm shrink-0">
          <Icon className="h-4 w-4 text-primary" />
        </div>
        <h2 className="text-base font-bold text-foreground tracking-tight">{title}</h2>
      </div>
      <div className="rounded-2xl glass-card p-4 space-y-4">{children}</div>
    </section>
  );
}

function previewWhen(date: string, time: string): string {
  if (!date && !time) return 'Pick a date & time';
  if (!date) return time;
  try {
    const d = new Date(`${date}T${time || '00:00'}:00`);
    if (Number.isNaN(d.getTime())) return date;
    const day = d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
    return time ? `${day} · ${time}` : day;
  } catch {
    return date;
  }
}

function unwrapCreatedEvent(res: unknown): Record<string, unknown> | null {
  if (!res || typeof res !== 'object') return null;
  const r = res as Record<string, unknown>;
  if (typeof r.id === 'string') return r;
  if (r.data && typeof r.data === 'object' && !Array.isArray(r.data)) {
    const data = r.data as Record<string, unknown>;
    if (typeof data.id === 'string') return data;
    if (data.event && typeof data.event === 'object') return data.event as Record<string, unknown>;
  }
  if (r.event && typeof r.event === 'object') return r.event as Record<string, unknown>;
  return r;
}

function extractCreatedEventPayload(res: unknown): { id?: string; created_by?: string } {
  const o = unwrapCreatedEvent(res);
  if (!o) return {};
  const id = o.id;
  const created =
    (typeof o.created_by === 'string' && o.created_by) ||
    (typeof o.createdBy === 'string' && o.createdBy) ||
    undefined;
  return { id: typeof id === 'string' ? id : undefined, created_by: created };
}

const GERMANY_DEFAULT = { lat: 51.1657, lng: 10.4515 };

export default function CreateEventPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const user = getCurrentUser();

  const [form, setForm] = useState({
    title: '',
    description: '',
    category: 'Music',
    date: '',
    time: '',
    location: '',
    budget: '',
    limit: '50',
    isPrivate: false,
    requiresApproval: false,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' as 'success' | 'error' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [dateInputType, setDateInputType] = useState<'text' | 'date'>('text');
  const [timeInputType, setTimeInputType] = useState<'text' | 'time'>('text');

  const [pickedLat, setPickedLat] = useState<number | null>(null);
  const [pickedLng, setPickedLng] = useState<number | null>(null);
  const [mapCenter, setMapCenter] = useState<{ lat: number; lng: number }>(GERMANY_DEFAULT);
  const [customBanner, setCustomBanner] = useState<string | null>(null);
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [repeat, setRepeat] = useState<RepeatFreq>('none');
  const [repeatCount, setRepeatCount] = useState('4');

  // Pre-fill form if an AI Assistant draft payload is provided via state or sessionStorage
  useEffect(() => {
    let draftData = (location.state as { draft?: Record<string, unknown> } | undefined)?.draft;
    if (!draftData) {
      try {
        const stored = window.sessionStorage.getItem('event_assistant_draft_prefill');
        if (stored) {
          draftData = JSON.parse(stored);
          window.sessionStorage.removeItem('event_assistant_draft_prefill');
        }
      } catch {
        // ignore
      }
    }

    if (draftData) {
      let dateVal = '';
      let timeVal = '';
      if (typeof draftData.start_datetime === 'string') {
        try {
          const d = new Date(draftData.start_datetime);
          if (!isNaN(d.getTime())) {
            dateVal = d.toISOString().slice(0, 10);
            timeVal = d.toTimeString().slice(0, 5);
          }
        } catch {
          // ignore
        }
      }

      setForm((prev) => ({
        ...prev,
        title: typeof draftData.title === 'string' ? draftData.title : prev.title,
        description: typeof draftData.description === 'string' ? draftData.description : prev.description,
        category: typeof draftData.category === 'string' ? draftData.category : prev.category,
        date: dateVal || prev.date,
        time: timeVal || prev.time,
        location: typeof draftData.location_name === 'string' ? draftData.location_name : prev.location,
        budget: draftData.cost !== undefined ? String(draftData.cost) : prev.budget,
        limit: draftData.max_capacity !== undefined ? String(draftData.max_capacity) : prev.limit,
      }));

      if (typeof draftData.latitude === 'number' && typeof draftData.longitude === 'number') {
        setPickedLat(draftData.latitude);
        setPickedLng(draftData.longitude);
        setMapCenter({ lat: draftData.latitude, lng: draftData.longitude });
      }
    }
  }, [location.state]);

  const update = (key: string, value: string | boolean) => {
    setForm(f => ({ ...f, [key]: value }));
    if (errors[key]) setErrors(prev => { const n = { ...prev }; delete n[key]; return n; });
  };

  const handleLocationSelect = (result: LocationResult) => {
    setPickedLat(result.lat);
    setPickedLng(result.lng);
    setMapCenter({ lat: result.lat, lng: result.lng });
    update('location', result.displayName);
    setErrors(prev => { const n = { ...prev }; delete n.mapLocation; return n; });
  };

  const handleUserLocation = (coords: { lat: number; lng: number }) => {
    setMapCenter(coords);
    setPickedLat(prev => prev ?? null);
    setPickedLng(prev => prev ?? null);
  };

  // Reverse geocode coordinates when clicked on map to fill address edit box
  const onMapLocationChange = async (lat: number, lng: number) => {
    setPickedLat(lat);
    setPickedLng(lng);
    setErrors(prev => { const n = { ...prev }; delete n.mapLocation; return n; });

    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`, {
        headers: { 'Accept-Language': 'en' }
      });
      if (res.ok) {
        const data = await res.json();
        if (data && data.display_name) {
          update('location', data.display_name);
        } else {
          update('location', `${lat.toFixed(4)}, ${lng.toFixed(4)}`);
        }
      }
    } catch {
      update('location', `${lat.toFixed(4)}, ${lng.toFixed(4)}`);
    }
  };

  const todayIso = new Date().toISOString().split('T')[0];

  const minTime = form.date === todayIso
    ? (() => {
        const now = new Date(Date.now() + 5 * 60 * 1000);
        return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      })()
    : undefined;

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.title.trim()) e.title = 'Title is required';
    if (!form.description.trim()) e.description = 'Description is required';
    if (!form.date) e.date = 'Date is required';
    if (!form.time) e.time = 'Time is required';
    else if (form.date === todayIso && minTime && form.time < minTime) {
      e.time = 'Start time cannot be in the past';
    }
    if (!form.location.trim()) e.location = 'Location name is required';
    if (!hasValidEventCoordinates(pickedLat, pickedLng)) {
      e.mapLocation = 'Search for a location or click the map to set the event pin';
    }
    const cap = Math.floor(Number(form.limit));
    if (!form.limit.trim() || Number.isNaN(cap)) e.limit = 'Enter participant capacity';
    else if (cap < 4 || cap > 500) e.limit = 'Capacity must be between 4 and 500';
    if (form.budget.trim() !== '' && Number(form.budget) < 0) e.budget = 'Budget cannot be negative';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const resolveApiToken = async (): Promise<string | null> => {
    const existing = getAuthToken();
    if (existing) return existing;
    if (supabase) {
      const { data } = await supabase.auth.getSession();
      const token = data?.session?.access_token ?? null;
      if (token) { setAuthToken(token); return token; }
    }
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    if (!validate()) return;

    setIsSubmitting(true);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);

    try {
      const token = await resolveApiToken();
      if (!token) throw new Error('You must be logged in to publish an event.');

      const startObj = new Date(`${form.date}T${form.time}:00`);
      const safeISO = (d: Date) => d.toISOString().split('.')[0] + 'Z';

      const locationName = form.location.trim() || `${pickedLat!.toFixed(4)}, ${pickedLng!.toFixed(4)}`;

      const starts = recurringStartDates(startObj, repeat, clampRepeatCount(repeatCount));
      const uploadedBanner = bannerFile ? await uploadEventBanner(bannerFile) : null;
      if (uploadedBanner) {
        setCustomBanner(uploadedBanner);
        setBannerFile(null);
      }
      const banner = uploadedBanner || publicBannerUrl(customBanner) || getCategoryBanner(form.category);
      const storedBanner = publicBannerUrl(banner);
      const durationMs = 7200000;

      const authUser = supabase == null ? undefined : (await supabase.auth.getUser()).data?.user ?? undefined;
      const organizerName =
        user?.name ||
        (typeof authUser?.user_metadata?.full_name === 'string' ? authUser.user_metadata.full_name : undefined) ||
        (typeof authUser?.user_metadata?.name === 'string' ? authUser.user_metadata.name : undefined) ||
        (authUser?.email ? authUser.email.split('@')[0] : undefined) ||
        'Organizer';

      let created = 0;
      let lastError: string | null = null;
      let organizerId = user?.id || authUser?.id || 'current_user';
      const createdItems: EventItem[] = [];

      for (const start of starts) {
        const end = new Date(start.getTime() + durationMs);
        const { date: dateStr, time: timeStr } = localDateTimeParts(start);
        const payload = {
          title: sanitizeText(form.title),
          description: sanitizeText(form.description),
          category: form.category,
          cost: Math.round(Number(form.budget)) || 0,
          max_capacity: Math.floor(Number(form.limit)),
          start_datetime: safeISO(start),
          end_datetime: safeISO(end),
          location_name: locationName,
          latitude: pickedLat!,
          longitude: pickedLng!,
          ...(storedBanner ? { banner_url: storedBanner } : {}),
        };

        const res = await fetch(getApiUrl(`${API_ENDPOINTS.EVENTS}/`), {
          method: 'POST',
          signal: controller.signal,
          mode: 'cors',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token.trim()}`,
          },
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          lastError = err.detail || `Server failed (HTTP ${res.status})`;
          break;
        }

        const responseData = await res.json();
        const createdRow = unwrapCreatedEvent(responseData);
        const { id: apiEventId, created_by: apiCreatedBy } = extractCreatedEventPayload(responseData);
        if (apiCreatedBy) organizerId = apiCreatedBy;
        const organizerAvatar =
          pickImageUrl(
            user?.profilePhoto,
            user?.avatar,
            typeof authUser?.user_metadata?.avatar_url === 'string' ? authUser.user_metadata.avatar_url : null,
          ) ?? getGeneratedAvatarUrl(organizerId);

        const localEvent: EventItem = {
          id: apiEventId || crypto.randomUUID(),
          title: payload.title,
          description: payload.description,
          category: payload.category,
          date: dateStr,
          time: timeStr,
          location: locationName,
          lat: payload.latitude,
          lng: payload.longitude,
          budget: payload.cost,
          participantsLimit: payload.max_capacity,
          participants: [],
          image: banner,
          organizer: organizerName,
          organizerId,
          organizerAvatar,
          isPrivate: form.isPrivate,
          requiresApproval: form.requiresApproval,
          isDraft: false,
          reviews: [],
          reports: [],
          collaborators: [],
        };
        const stored =
          createdRow && typeof createdRow.id === 'string'
            ? { ...mapApiEventToItem(createdRow), ...localEvent, id: createdRow.id as string }
            : localEvent;
        addEvent(stored);
        createdItems.push(stored);
        created += 1;
      }

      clearTimeout(timeoutId);

      if (created === 0) throw new Error(lastError || 'Could not publish the event.');

      const message =
        created > 1
          ? `Published ${created} events in the series${lastError ? ` (${starts.length - created} failed)` : ''}`
          : 'Event Published Successfully!';
      setToast({ show: true, message, type: 'success' });
      invalidateEvents();
      for (const item of createdItems) prependCreatedEvent(item);
      setTimeout(() => navigate('/home'), 1500);
    } catch (err: any) {
      clearTimeout(timeoutId);
      let msg = err.message;
      if (err.name === 'AbortError') msg = 'The server took too long to wake up. Please try again in 10 seconds.';
      else if (msg === 'Failed to fetch') msg = 'Network Error: The server is likely asleep or rejecting the connection.';
      setToast({ show: true, message: msg, type: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const inputCls = (field: string) =>
    `w-full rounded-xl bg-secondary px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground outline-none border border-border/50 focus:border-primary/40 focus:ring-2 ${
      errors[field] ? 'ring-1 ring-destructive border-destructive/50' : 'focus:ring-primary/50'
    } transition-all`;

  const isFree = !form.budget.trim() || Number(form.budget) === 0;

  if (!hasSignedInSession()) return <Navigate to="/login" replace />;

  return (
    <div className="min-h-screen bg-background pb-24 relative overflow-x-hidden">
      <AppToast message={toast.message} type={toast.type} show={toast.show} onClose={() => setToast(t => ({ ...t, show: false }))} />

      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-32 left-1/4 w-[500px] h-[500px] rounded-full bg-primary/15 blur-[140px]" />
        <div className="absolute top-1/2 -right-32 w-[400px] h-[400px] rounded-full bg-accent/10 blur-[140px]" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[350px] rounded-full bg-primary/10 blur-[140px]" />
      </div>

      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-lg">
        <TopBar showSearch={false} />
        <header className="border-b border-border px-4 py-3">
          <div className="mx-auto flex max-w-lg items-center gap-3">
            <button
              type="button"
              onClick={() => navigate(-1)}
              aria-label="Back"
              className="glass-card rounded-full p-2 text-foreground hover:text-primary transition-colors shrink-0"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div className="min-w-0 flex-1">
              <h1 className="text-xl font-bold text-gradient leading-tight">Create Event</h1>
              <p className="text-xs text-muted-foreground mt-0.5">Share something worth showing up for</p>
            </div>
          </div>
        </header>
      </div>

      <motion.form
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        onSubmit={handleSubmit}
        className="relative z-10 mx-auto max-w-lg space-y-5 px-4 pt-5"
      >
        <EventBannerField
          category={form.category}
          customUrl={customBanner}
          onCustomUrl={setCustomBanner}
          onCustomFile={setBannerFile}
          onError={(message) => setToast({ show: true, message, type: 'error' })}
          overlay={
            <div className="absolute bottom-3 left-3 right-3 space-y-1.5">
              <span className="inline-flex items-center rounded-full bg-background/80 backdrop-blur-sm border border-border/50 px-2.5 py-0.5 text-[10px] font-semibold text-foreground">
                {form.category}
              </span>
              <p className="text-sm font-bold text-foreground truncate">
                {form.title.trim() || 'Untitled event'}
              </p>
              <p className="text-[11px] text-muted-foreground truncate">
                {previewWhen(form.date, form.time)} · {form.location.trim() || 'Add a location'}
              </p>
            </div>
          }
        />

        <FormSection icon={Type} title="Event details">
          <div className="space-y-1">
            <label htmlFor="create-title" className="block text-xs font-semibold text-foreground">Title</label>
            <input id="create-title" placeholder="Event Title" value={form.title} onChange={e => update('title', e.target.value)} className={inputCls('title')} />
            {errors.title && <span className="text-[10px] text-destructive px-1">{errors.title}</span>}
          </div>
          <div className="space-y-1">
            <label htmlFor="create-description" className="block text-xs font-semibold text-foreground">Description</label>
            <textarea id="create-description" placeholder="Description" rows={3} value={form.description} onChange={e => update('description', e.target.value)} className={`${inputCls('description')} resize-none`} />
            {errors.description && <span className="text-[10px] text-destructive px-1">{errors.description}</span>}
          </div>
          <div className="space-y-2">
            <p id="create-category-label" className="text-xs font-semibold text-foreground">Category</p>
            <CategoryPills
              value={form.category}
              onChange={(id) => update('category', id)}
              aria-label="Category"
            />
          </div>
        </FormSection>

        <FormSection icon={Calendar} title="Date & time">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label htmlFor="create-event-date" className="block text-xs font-semibold text-foreground">Event date</label>
              <div className="relative">
                <Calendar className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  id="create-event-date"
                  type={dateInputType}
                  min={dateInputType === 'date' ? todayIso : undefined}
                  placeholder="YYYY-MM-DD"
                  value={form.date}
                  onFocus={() => setDateInputType('date')}
                  onBlur={() => { if (!form.date) setDateInputType('text'); }}
                  onChange={e => update('date', e.target.value)}
                  className={`${inputCls('date')} pl-10`}
                  aria-describedby="create-event-date-hint"
                />
              </div>
              <p id="create-event-date-hint" className="text-[10px] text-muted-foreground px-0.5">Tap to pick from calendar.</p>
              {errors.date && <span className="text-[10px] text-destructive px-1">{errors.date}</span>}
            </div>
            <div className="space-y-1">
              <label htmlFor="create-event-time" className="block text-xs font-semibold text-foreground">Event time</label>
              <div className="relative">
                <Clock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  id="create-event-time"
                  type={timeInputType}
                  placeholder="HH:MM (24h)"
                  min={timeInputType === 'time' ? minTime : undefined}
                  value={form.time}
                  onFocus={() => setTimeInputType('time')}
                  onBlur={() => { if (!form.time) setTimeInputType('text'); }}
                  onChange={e => update('time', e.target.value)}
                  className={`${inputCls('time')} pl-10`}
                  aria-describedby="create-event-time-hint"
                />
              </div>
              <p id="create-event-time-hint" className="text-[10px] text-muted-foreground px-0.5">Tap to pick start time.</p>
              {errors.time && <span className="text-[10px] text-destructive px-1">{errors.time}</span>}
            </div>
          </div>
          <div className="space-y-2 pt-1">
            <p className="text-xs font-semibold text-foreground">Repeat</p>
            <div className="flex gap-1 rounded-xl bg-secondary/60 p-1" role="radiogroup" aria-label="Repeat">
              {([
                ['none', 'Doesn’t repeat'],
                ['weekly', 'Weekly'],
                ['monthly', 'Monthly'],
              ] as Array<[RepeatFreq, string]>).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  role="radio"
                  aria-checked={repeat === id}
                  onClick={() => setRepeat(id)}
                  className={`flex-1 rounded-lg py-2 text-[11px] font-semibold transition-all ${
                    repeat === id ? 'gradient-primary text-primary-foreground shadow-glow' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            {repeat !== 'none' && (
              <div className="space-y-1">
                <label htmlFor="create-repeat-count" className="block text-xs font-semibold text-foreground">How many times</label>
                <input
                  id="create-repeat-count"
                  type="number"
                  min={2}
                  max={12}
                  value={repeatCount}
                  onChange={(e) => setRepeatCount(e.target.value)}
                  className={inputCls('repeatCount')}
                />
                <p className="text-[10px] text-muted-foreground px-0.5">Creates {clampRepeatCount(repeatCount)} events, 2–12.</p>
              </div>
            )}
          </div>
        </FormSection>

        <FormSection icon={MapPin} title="Location">
          <div className="space-y-1">
            <label className="block text-xs font-semibold text-foreground">Search address</label>
            <LocationSearchInput
              value={form.location}
              onChange={(v) => update('location', v)}
              onSelect={handleLocationSelect}
              onUserLocation={handleUserLocation}
              placeholder="Search venue, address or city…"
              error={errors.location}
            />
          </div>
          <div className="relative z-10 space-y-1">
            <label className="block text-xs font-semibold text-foreground">
              Pin on map
              <span className="ml-1 text-[10px] font-normal text-muted-foreground">(search above or tap to set)</span>
            </label>
            <LocationPickerMap latitude={pickedLat} longitude={pickedLng} onLocationChange={onMapLocationChange} />
            {errors.mapLocation && <span className="block text-[10px] text-destructive px-1">{errors.mapLocation}</span>}
          </div>
        </FormSection>

        <FormSection icon={Users} title="Capacity & cost">
          <div className="flex gap-1 rounded-xl bg-secondary/60 p-1" role="radiogroup" aria-label="Ticket price">
            <button
              type="button"
              role="radio"
              aria-checked={isFree}
              onClick={() => update('budget', '')}
              className={`flex-1 rounded-lg py-2 text-xs font-semibold transition-all ${
                isFree ? 'gradient-primary text-primary-foreground shadow-glow' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Free
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={!isFree}
              onClick={() => { if (isFree) update('budget', '10'); }}
              className={`flex-1 rounded-lg py-2 text-xs font-semibold transition-all ${
                !isFree ? 'gradient-primary text-primary-foreground shadow-glow' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Paid
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label htmlFor="create-event-budget" className="block text-xs font-semibold text-foreground">Budget (€)</label>
              <div className="relative">
                <Euro className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input id="create-event-budget" type="number" min={0} step="1" placeholder="0 = free event" value={form.budget} onChange={e => update('budget', e.target.value)} className={`${inputCls('budget')} pl-10`} aria-describedby="create-event-budget-hint" />
              </div>
              <p id="create-event-budget-hint" className="text-[10px] text-muted-foreground px-0.5">Leave empty or enter 0 for free.</p>
              {errors.budget && <span className="text-[10px] text-destructive px-1">{errors.budget}</span>}
            </div>
            <div className="space-y-1">
              <label htmlFor="create-event-capacity" className="block text-xs font-semibold text-foreground">Max participants</label>
              <input id="create-event-capacity" type="number" min={4} max={500} step={1} placeholder="4–500 people" value={form.limit} onChange={e => update('limit', e.target.value)} className={inputCls('limit')} aria-describedby="create-event-capacity-hint" />
              <p id="create-event-capacity-hint" className="text-[10px] text-muted-foreground px-0.5">Type a whole number.</p>
              {errors.limit && <span className="text-[10px] text-destructive px-1">{errors.limit}</span>}
            </div>
          </div>
        </FormSection>

        <div className="rounded-2xl glass-card p-4">
          <div className="flex gap-3">
            <button type="button" onClick={() => navigate(-1)} className="flex-1 rounded-xl border border-border bg-secondary py-3 text-sm font-semibold text-foreground transition-colors hover:bg-secondary/80 active:scale-[0.98]">
              Cancel
            </button>
            <button type="submit" disabled={isSubmitting} className="flex-1 gradient-primary rounded-xl py-3 text-sm font-semibold text-primary-foreground shadow-glow ripple-container active:scale-[0.98] transition-transform disabled:opacity-50">
              {isSubmitting ? 'Publishing...' : 'Publish Event'}
            </button>
          </div>
        </div>
      </motion.form>

      <BottomNav />
    </div>
  );
}
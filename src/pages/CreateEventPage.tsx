import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ShieldCheck } from 'lucide-react';
import { addEvent, getCurrentUser, type EventItem } from '@/lib/storage';
import { supabase } from '@/lib/supabase';
import { CATEGORIES } from '@/lib/seedData';
import { motion } from 'framer-motion';
import AppToast from '@/components/AppToast';
import BottomNav from '@/components/BottomNav';
import { getApiUrl } from '@/lib/api';
import { API_ENDPOINTS } from '@/lib/apiUrls';
import { getAuthToken, setAuthToken } from '@/lib/auth';
import { pickImageUrl, getGeneratedAvatarUrl } from '@/lib/avatars';
import LocationPickerMap, { hasValidEventCoordinates } from '@/components/LocationPickerMap';
import LocationSearchInput, { type LocationResult } from '@/components/LocationSearchInput';

function extractCreatedEventPayload(res: unknown): { id?: string; created_by?: string } {
  if (!res || typeof res !== 'object') return {};
  const r = res as Record<string, unknown>;
  const fromObj = (o: Record<string, unknown>) => {
    const id = o.id;
    const created =
      (typeof o.created_by === 'string' && o.created_by) ||
      (typeof o.createdBy === 'string' && o.createdBy) ||
      undefined;
    return { id: typeof id === 'string' ? id : undefined, created_by: created };
  };
  const top = fromObj(r);
  if (top.created_by || top.id) return top;
  const data = r.data;
  if (data && typeof data === 'object') return fromObj(data as Record<string, unknown>);
  return {};
}

const EVENT_IMAGES = [
  'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=600&q=80',
  'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=600&q=80',
  'https://images.unsplash.com/photo-1501281668745-f7f57925c3b4?w=600&q=80',
  'https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?w=600&q=80',
];

// Germany centre fallback
const GERMANY_DEFAULT = { lat: 51.1657, lng: 10.4515 };

export default function CreateEventPage() {
  const navigate = useNavigate();
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

  // Coordinates — start at Germany until user grants geolocation or picks a location
  const [pickedLat, setPickedLat] = useState<number | null>(null);
  const [pickedLng, setPickedLng] = useState<number | null>(null);
  const [mapCenter, setMapCenter] = useState<{ lat: number; lng: number }>(GERMANY_DEFAULT);

  const update = (key: string, value: string | boolean) => {
    setForm(f => ({ ...f, [key]: value }));
    if (errors[key]) setErrors(prev => { const n = { ...prev }; delete n[key]; return n; });
  };

  // Called by LocationSearchInput when the user selects a search result
  const handleLocationSelect = (result: LocationResult) => {
    setPickedLat(result.lat);
    setPickedLng(result.lng);
    setMapCenter({ lat: result.lat, lng: result.lng });
    update('location', result.displayName);
    setErrors(prev => { const n = { ...prev }; delete n.mapLocation; return n; });
  };

  // Called by LocationSearchInput once geolocation resolves
  const handleUserLocation = (coords: { lat: number; lng: number }) => {
    setMapCenter(coords);
    // Only set the marker if the user hasn't already picked one
    setPickedLat(prev => prev ?? null);
    setPickedLng(prev => prev ?? null);
  };

  // Manual map click still works
  const onMapLocationChange = (lat: number, lng: number) => {
    setPickedLat(lat);
    setPickedLng(lng);
    setErrors(prev => { const n = { ...prev }; delete n.mapLocation; return n; });
  };

  const todayIso = new Date().toISOString().split('T')[0];

  /** Returns HH:MM of current time + 5 min buffer, only when date === today */
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
      const endObj = new Date(startObj.getTime() + 7200000);
      const safeISO = (d: Date) => d.toISOString().split('.')[0] + 'Z';

      const locationName = form.location.trim() || `${pickedLat!.toFixed(4)}, ${pickedLng!.toFixed(4)}`;

      const payload = {
        title: form.title.trim(),
        description: form.description.trim(),
        category: form.category,
        cost: Math.round(Number(form.budget)) || 0,
        max_capacity: Math.floor(Number(form.limit)),
        start_datetime: safeISO(startObj),
        end_datetime: safeISO(endObj),
        location_name: locationName,
        latitude: pickedLat!,
        longitude: pickedLng!,
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

      clearTimeout(timeoutId);

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || `Server failed (HTTP ${res.status})`);
      }

      const responseData = await res.json();
      const { id: apiEventId, created_by: apiCreatedBy } = extractCreatedEventPayload(responseData);
      const authUser = supabase == null ? undefined : (await supabase.auth.getUser()).data?.user ?? undefined;

      const organizerId = apiCreatedBy || user?.id || authUser?.id || 'current_user';
      const organizerName =
        user?.name ||
        (typeof authUser?.user_metadata?.full_name === 'string' ? authUser.user_metadata.full_name : undefined) ||
        (typeof authUser?.user_metadata?.name === 'string' ? authUser.user_metadata.name : undefined) ||
        (authUser?.email ? authUser.email.split('@')[0] : undefined) ||
        'Organizer';
      const organizerAvatar =
        pickImageUrl(
          user?.profilePhoto,
          user?.avatar,
          typeof authUser?.user_metadata?.avatar_url === 'string' ? authUser.user_metadata.avatar_url : null,
        ) ?? getGeneratedAvatarUrl(organizerId);

      const localEvent: EventItem = {
        id: apiEventId || crypto.randomUUID(),
        ...payload,
        date: form.date,
        time: form.time,
        location: locationName,
        lat: payload.latitude,
        lng: payload.longitude,
        budget: payload.cost,
        participantsLimit: payload.max_capacity,
        participants: [],
        image: EVENT_IMAGES[0],
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

      addEvent(localEvent);
      setToast({ show: true, message: 'Event Published Successfully!', type: 'success' });
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
    `w-full rounded-xl bg-secondary px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 ${
      errors[field] ? 'ring-1 ring-destructive' : 'focus:ring-primary/50'
    } transition-all`;

  return (
    <div className="min-h-screen bg-background pb-20">
      <AppToast message={toast.message} type={toast.type} show={toast.show} onClose={() => setToast(t => ({ ...t, show: false }))} />

      <header className="sticky top-0 z-40 flex items-center gap-3 border-b border-border bg-background/95 backdrop-blur-lg px-4 py-3">
        <button onClick={() => navigate(-1)}><ArrowLeft className="h-5 w-5 text-foreground" /></button>
        <h1 className="text-lg font-bold text-foreground">Create Event</h1>
      </header>

      <motion.form
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        onSubmit={handleSubmit}
        className="mx-auto max-w-lg space-y-4 px-4 pt-4"
      >
        {/* Title */}
        <div>
          <input placeholder="Event Title" value={form.title} onChange={e => update('title', e.target.value)} className={inputCls('title')} />
          {errors.title && <span className="text-[10px] text-destructive px-2">{errors.title}</span>}
        </div>

        {/* Description */}
        <div>
          <textarea placeholder="Description" rows={3} value={form.description} onChange={e => update('description', e.target.value)} className={`${inputCls('description')} resize-none`} />
          {errors.description && <span className="text-[10px] text-destructive px-2">{errors.description}</span>}
        </div>

        {/* Category */}
        <select value={form.category} onChange={e => update('category', e.target.value)} className={inputCls('category')}>
          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>

        {/* Date + Time */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label htmlFor="create-event-date" className="block text-xs font-medium text-foreground">
              Event date
            </label>
            <input
              id="create-event-date"
              type={dateInputType}
              min={dateInputType === 'date' ? todayIso : undefined}
              placeholder="YYYY-MM-DD"
              value={form.date}
              onFocus={() => setDateInputType('date')}
              onBlur={() => {
                if (!form.date) setDateInputType('text');
              }}
              onChange={e => update('date', e.target.value)}
              className={inputCls('date')}
              aria-describedby="create-event-date-hint"
            />
            <p id="create-event-date-hint" className="text-[10px] text-muted-foreground px-0.5">
              Tap to pick from calendar.
            </p>
            {errors.date && <span className="text-[10px] text-destructive px-2">{errors.date}</span>}
          </div>
          <div className="space-y-1">
            <label htmlFor="create-event-time" className="block text-xs font-medium text-foreground">
              Event time
            </label>
            <input
              id="create-event-time"
              type={timeInputType}
              placeholder="HH:MM (24h)"
              min={timeInputType === 'time' ? minTime : undefined}
              value={form.time}
              onFocus={() => setTimeInputType('time')}
              onBlur={() => {
                if (!form.time) setTimeInputType('text');
              }}
              onChange={e => update('time', e.target.value)}
              className={inputCls('time')}
              aria-describedby="create-event-time-hint"
            />
            <p id="create-event-time-hint" className="text-[10px] text-muted-foreground px-0.5">
              Tap to pick start time.
            </p>
            {errors.time && <span className="text-[10px] text-destructive px-2">{errors.time}</span>}
          </div>
        </div>

        {/* Location search */}
        <div className="space-y-1">
          <label className="block text-xs font-medium text-foreground">Location</label>
          <LocationSearchInput
            value={form.location}
            onChange={(v) => update('location', v)}
            onSelect={handleLocationSelect}
            onUserLocation={handleUserLocation}
            placeholder="Search venue, address or city…"
            error={errors.location}
          />
        </div>

        {/* Map — centres on mapCenter, marker on pickedLat/Lng */}
        <div className="relative z-10 space-y-1">
          <label className="block text-xs font-medium text-foreground">
            Pin on map
            <span className="ml-1 text-[10px] text-muted-foreground">(search above or click to set manually)</span>
          </label>
          <LocationPickerMap
            latitude={pickedLat}
            longitude={pickedLng}
            onLocationChange={onMapLocationChange}
          />
          {errors.mapLocation && <span className="block text-[10px] text-destructive px-2">{errors.mapLocation}</span>}
        </div>

        {/* Budget + Capacity */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label htmlFor="create-event-budget" className="block text-xs font-medium text-foreground">
              Budget (USD)
            </label>
            <input
              id="create-event-budget"
              type="number"
              min={0}
              step="1"
              placeholder="0 = free event"
              value={form.budget}
              onChange={e => update('budget', e.target.value)}
              className={inputCls('budget')}
              aria-describedby="create-event-budget-hint"
            />
            <p id="create-event-budget-hint" className="text-[10px] text-muted-foreground px-0.5">
              Leave empty or enter 0 for free.
            </p>
            {errors.budget && <span className="text-[10px] text-destructive px-2">{errors.budget}</span>}
          </div>
          <div className="space-y-1">
            <label htmlFor="create-event-capacity" className="block text-xs font-medium text-foreground">
              Max participants
            </label>
            <input
              id="create-event-capacity"
              type="number"
              min={4}
              max={500}
              step={1}
              placeholder="4–500 people"
              value={form.limit}
              onChange={e => update('limit', e.target.value)}
              className={inputCls('limit')}
              aria-describedby="create-event-capacity-hint"
            />
            <p id="create-event-capacity-hint" className="text-[10px] text-muted-foreground px-0.5">
              Type a whole number.
            </p>
            {errors.limit && <span className="text-[10px] text-destructive px-2">{errors.limit}</span>}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-4">
          <button type="button" onClick={() => navigate(-1)} className="flex-1 rounded-xl bg-secondary py-3 text-sm font-semibold text-foreground">Cancel</button>
          <button type="submit" disabled={isSubmitting} className="flex-1 gradient-primary rounded-xl py-3 text-sm font-semibold text-primary-foreground shadow-glow disabled:opacity-50">
            {isSubmitting ? 'Publishing...' : 'Publish Event'}
          </button>
        </div>
      </motion.form>
      <BottomNav />
    </div>
  );
}
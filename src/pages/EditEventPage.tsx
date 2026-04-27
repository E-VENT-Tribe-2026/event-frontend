import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ShieldCheck } from 'lucide-react';
import { getCurrentUser, upsertEvent, type EventItem } from '@/lib/storage';
import { supabase } from '@/lib/supabase';
import { CATEGORIES } from '@/lib/seedData';
import { motion } from 'framer-motion';
import AppToast from '@/components/AppToast';
import BottomNav from '@/components/BottomNav';
import { getApiUrl } from '@/lib/api';
import { API_ENDPOINTS } from '@/lib/apiUrls';
import { getAuthToken, setAuthToken } from '@/lib/auth';
import { pickImageUrl, getGeneratedAvatarUrl } from '@/lib/avatars';
import { mapApiEventToItem } from '@/lib/mapApiEvent';
import LocationPickerMap, { hasValidEventCoordinates } from '@/components/LocationPickerMap';
import LocationSearchInput, { type LocationResult } from '@/components/LocationSearchInput';
import { formatPageTitle } from '@/lib/documentTitle';
import { fetchAuthUserFromToken, sameAuthUserId } from '@/lib/authProfile';

type ApiEventRow = Record<string, unknown>;

function safeISO(d: Date) {
  return d.toISOString().split('.')[0] + 'Z';
}

// Germany centre fallback
const GERMANY_DEFAULT = { lat: 51.1657, lng: 10.4515 };

export default function EditEventPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const user = getCurrentUser();

  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [loadMessage, setLoadMessage] = useState('');

  const [form, setForm] = useState({
    title: '',
    description: '',
    category: 'Music',
    date: '',
    time: '',
    location: '',
    budget: '0',
    limit: '50',
    requiresApproval: false,
  });

  const [pickedLat, setPickedLat] = useState<number | null>(null);
  const [pickedLng, setPickedLng] = useState<number | null>(null);
  const [mapCenter, setMapCenter] = useState<{ lat: number; lng: number }>(GERMANY_DEFAULT);
  const [durationMs, setDurationMs] = useState(7200000);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' as 'success' | 'error' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [cachedItem, setCachedItem] = useState<EventItem | null>(null);
  const [currentParticipantCount, setCurrentParticipantCount] = useState(0);

  const update = (key: string, value: string | boolean) => {
    setForm((f) => ({ ...f, [key]: value }));
    if (errors[key]) {
      setErrors((prev) => { const n = { ...prev }; delete n[key]; return n; });
    }
  };

  // Manual map click
  const onMapLocationChange = useCallback((lat: number, lng: number) => {
    setPickedLat(lat);
    setPickedLng(lng);
    setErrors((prev) => {
      if (!prev.mapLocation) return prev;
      const n = { ...prev };
      delete n.mapLocation;
      return n;
    });
  }, []);

  // Search result selected
  const handleLocationSelect = (result: LocationResult) => {
    setPickedLat(result.lat);
    setPickedLng(result.lng);
    setMapCenter({ lat: result.lat, lng: result.lng });
    update('location', result.displayName);
    setErrors((prev) => { const n = { ...prev }; delete n.mapLocation; return n; });
  };

  // Geolocation resolved — only update map center, don't override existing marker
  const handleUserLocation = (coords: { lat: number; lng: number }) => {
    // If no marker has been set yet and no saved coords, center the map on user
    setMapCenter((prev) => {
      const hasExisting = pickedLat !== null && pickedLng !== null;
      return hasExisting ? prev : coords;
    });
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

  // Load event data
  useEffect(() => {
    if (!id) { setLoadState('error'); setLoadMessage('Missing event id'); return; }

    let cancelled = false;
    (async () => {
      setLoadState('loading');
      try {
        const res = await fetch(getApiUrl(`${API_ENDPOINTS.EVENTS}/${id}`));
        if (!res.ok) {
          if (!cancelled) {
            setLoadState('error');
            setLoadMessage(res.status === 404 ? 'Event not found' : 'Could not load event');
          }
          return;
        }
        const raw = (await res.json()) as ApiEventRow;
        const rawCreator = raw.created_by ?? raw.createdBy;
        const createdBy = rawCreator != null && String(rawCreator).trim() !== '' ? String(rawCreator).trim() : '';
        const token = await resolveApiToken();
        const me = token ? await fetchAuthUserFromToken(token) : null;
        const uid = me?.id || user?.id || '';
        if (!uid || !sameAuthUserId(createdBy, uid)) {
          if (!cancelled) { setLoadState('error'); setLoadMessage('You can only edit events you created.'); }
          return;
        }

        const item = mapApiEventToItem(raw);
        const start = raw.start_datetime ? new Date(raw.start_datetime as string) : new Date();
        const end = raw.end_datetime ? new Date(raw.end_datetime as string) : new Date(start.getTime() + 7200000);
        const dMs = Math.max(0, end.getTime() - start.getTime()) || 7200000;

        if (cancelled) return;

        setCachedItem(item);
        setDurationMs(dMs);
        setCurrentParticipantCount(item.participants?.length ?? 0);

        // Also fetch live participant count from API
        try {
          const pRes = await fetch(getApiUrl(`/api/participants/${id}/participants`));
          if (pRes.ok) {
            const list = await pRes.json().catch(() => []);
            if (Array.isArray(list)) setCurrentParticipantCount(list.length);
          }
        } catch { /* use local count */ }
        setForm({
          title: item.title,
          description: item.description,
          category: item.category || 'Music',
          date: start.toISOString().slice(0, 10),
          time: start.toTimeString().slice(0, 5),
          location: item.location,
          budget: String(item.budget ?? 0),
          limit: String(item.participantsLimit ?? 50),
          requiresApproval: item.requiresApproval,
        });

        if (hasValidEventCoordinates(item.lat, item.lng)) {
          setPickedLat(item.lat);
          setPickedLng(item.lng);
          // Centre map on the saved location
          setMapCenter({ lat: item.lat, lng: item.lng });
        }

        setLoadState('ready');
      } catch {
        if (!cancelled) { setLoadState('error'); setLoadMessage('Could not load event'); }
      }
    })();
    return () => { cancelled = true; };
  }, [id, user?.id]);

  useEffect(() => {
    if (loadState === 'error') { document.title = formatPageTitle('Edit event'); return; }
    if (loadState !== 'ready') return;
    const t = form.title.trim();
    document.title = formatPageTitle(t ? `Edit: ${t}` : 'Edit event');
  }, [loadState, form.title]);

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
    else if (cap < currentParticipantCount) e.limit = `Cannot set capacity below current participant count (${currentParticipantCount} joined)`;
    if (form.budget.trim() !== '' && Number(form.budget) < 0) e.budget = 'Budget cannot be negative';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (isSubmitting || !id || loadState !== 'ready') return;
    if (!validate()) return;
    if (!hasValidEventCoordinates(pickedLat, pickedLng)) return;

    setIsSubmitting(true);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);

    try {
      const token = await resolveApiToken();
      if (!token) throw new Error('You must be logged in to update an event.');

      const startObj = new Date(`${form.date}T${form.time}:00`);
      const endObj = new Date(startObj.getTime() + durationMs);
      const locationName = form.location.trim() || `${pickedLat!.toFixed(4)}, ${pickedLng!.toFixed(4)}`;

      const payload = {
        title: form.title.trim(),
        description: form.description.trim(),
        category: form.category,
        cost: Math.round(Number(form.budget)) || 0,
        max_capacity: Math.floor(Number(form.limit)) || 50,
        start_datetime: safeISO(startObj),
        end_datetime: safeISO(endObj),
        location_name: locationName,
        latitude: pickedLat!,
        longitude: pickedLng!,
      };

      const res = await fetch(getApiUrl(`${API_ENDPOINTS.EVENTS}/${id}`), {
        method: 'PUT',
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
        throw new Error((err as { detail?: string }).detail || `Server failed (HTTP ${res.status})`);
      }

      const updatedRow = (await res.json()) as ApiEventRow;
      const item = mapApiEventToItem(updatedRow);
      const base = cachedItem;
      const organizerId = base?.organizerId ?? user?.id ?? '';
      const organizerName = base?.organizer ?? user?.name ?? 'Organizer';
      const organizerAvatar =
        base?.organizerAvatar ??
        pickImageUrl(user?.profilePhoto, user?.avatar) ??
        getGeneratedAvatarUrl(organizerId);

      const merged: EventItem = {
        ...(base ?? item),
        ...item,
        id,
        date: form.date,
        time: form.time,
        location: locationName,
        lat: pickedLat!,
        lng: pickedLng!,
        budget: payload.cost,
        participantsLimit: payload.max_capacity,
        requiresApproval: form.requiresApproval,
        organizer: organizerName,
        organizerId,
        organizerAvatar,
        image: base?.image ?? item.image,
        participants: base?.participants ?? item.participants,
        reviews: base?.reviews ?? [],
        reports: base?.reports ?? [],
        collaborators: base?.collaborators ?? [],
      };

      upsertEvent(merged);
      setToast({ show: true, message: 'Event updated!', type: 'success' });
      setTimeout(() => navigate(`/event/${id}`), 1200);
    } catch (err: unknown) {
      clearTimeout(timeoutId);
      const message = err instanceof Error ? err.message : 'Update failed';
      setToast({ show: true, message, type: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const inputCls = (field: string) =>
    `w-full rounded-xl bg-secondary px-4 py-3 text-sm text-foreground outline-none focus:ring-2 ${
      errors[field] ? 'ring-1 ring-destructive' : 'focus:ring-primary/50'
    } transition-all`;

  if (loadState === 'loading') {
    return <div className="flex min-h-screen items-center justify-center bg-background text-foreground">Loading…</div>;
  }

  if (loadState === 'error') {
    return (
      <div className="min-h-screen bg-background pb-20">
        <header className="sticky top-0 z-40 flex items-center gap-3 border-b border-border bg-background/95 px-4 py-3 backdrop-blur-lg">
          <button type="button" onClick={() => navigate(-1)} aria-label="Back">
            <ArrowLeft className="h-5 w-5 text-foreground" />
          </button>
          <h1 className="text-lg font-bold text-foreground">Edit Event</h1>
        </header>
        <p className="px-4 pt-6 text-sm text-muted-foreground">{loadMessage}</p>
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <AppToast
        message={toast.message}
        type={toast.type}
        show={toast.show}
        onClose={() => setToast((t) => ({ ...t, show: false }))}
      />

      <header className="sticky top-0 z-40 flex items-center gap-3 border-b border-border bg-background/95 px-4 py-3 backdrop-blur-lg">
        <button type="button" onClick={() => navigate(-1)} aria-label="Back">
          <ArrowLeft className="h-5 w-5 text-foreground" />
        </button>
        <h1 className="text-lg font-bold text-foreground">Edit Event</h1>
      </header>

      <motion.form
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        onSubmit={handleSubmit}
        className="mx-auto max-w-lg space-y-4 px-4 pt-4"
      >
        {/* Title */}
        <div>
          <input placeholder="Event Title" value={form.title} onChange={(e) => update('title', e.target.value)} className={inputCls('title')} />
          {errors.title && <span className="text-[10px] text-destructive px-2">{errors.title}</span>}
        </div>

        {/* Description */}
        <div>
          <textarea placeholder="Description" rows={3} value={form.description} onChange={(e) => update('description', e.target.value)} className={`${inputCls('description')} resize-none`} />
          {errors.description && <span className="text-[10px] text-destructive px-2">{errors.description}</span>}
        </div>

        {/* Category */}
        <select value={form.category} onChange={(e) => update('category', e.target.value)} className={inputCls('category')}>
          {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>

        {/* Date + Time */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label htmlFor="edit-event-date" className="block text-xs font-medium text-foreground">Event date</label>
            <input
              id="edit-event-date"
              type="date"
              min={todayIso}
              value={form.date}
              onChange={(e) => update('date', e.target.value)}
              className={inputCls('date')}
            />
            {errors.date && <span className="text-[10px] text-destructive px-2">{errors.date}</span>}
          </div>
          <div className="space-y-1">
            <label htmlFor="edit-event-time" className="block text-xs font-medium text-foreground">Event time</label>
            <input
              id="edit-event-time"
              type="time"
              min={minTime}
              value={form.time}
              onChange={(e) => update('time', e.target.value)}
              className={inputCls('time')}
            />
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

        {/* Map */}
        <div className="relative z-10 space-y-1">
          <label className="block text-xs font-medium text-foreground">
            Pin on map
            <span className="ml-1 text-[10px] text-muted-foreground">(search above or click to adjust manually)</span>
          </label>
          <LocationPickerMap
            latitude={pickedLat}
            longitude={pickedLng}
            onLocationChange={onMapLocationChange}
          />
          {errors.mapLocation && (
            <span className="mt-1 block px-2 text-[10px] text-destructive">{errors.mapLocation}</span>
          )}
        </div>

        {/* Budget + Capacity */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label htmlFor="edit-event-budget" className="block text-xs font-medium text-foreground">Budget (USD)</label>
            <input
              id="edit-event-budget"
              type="number"
              min={0}
              step="1"
              placeholder="0 = free event"
              value={form.budget}
              onChange={(e) => update('budget', e.target.value)}
              className={inputCls('budget')}
            />
            <p className="text-[10px] text-muted-foreground px-0.5">Leave empty or enter 0 for free.</p>
            {errors.budget && <span className="text-[10px] text-destructive px-2">{errors.budget}</span>}
          </div>
          <div className="space-y-1">
            <label htmlFor="edit-event-capacity" className="block text-xs font-medium text-foreground">Max participants</label>
            <input
              id="edit-event-capacity"
              type="number"
              min={4}
              max={500}
              step={1}
              placeholder="4–500 people"
              value={form.limit}
              onChange={(e) => update('limit', e.target.value)}
              className={inputCls('limit')}
            />
            <p className="text-[10px] text-muted-foreground px-0.5">
              Type a whole number. {currentParticipantCount > 0 && `${currentParticipantCount} already joined.`}
            </p>
            {errors.limit && <span className="text-[10px] text-destructive px-2">{errors.limit}</span>}
          </div>
        </div>

        {/* Requires approval */}
        <div className="flex items-center justify-between rounded-xl bg-secondary px-4 py-3">
          <div className="flex items-center gap-2 text-sm text-foreground">
            <ShieldCheck className="h-4 w-4" /> Require Approval
          </div>
          <button
            type="button"
            onClick={() => update('requiresApproval', !form.requiresApproval)}
            className={`h-6 w-11 rounded-full transition-colors ${form.requiresApproval ? 'bg-primary' : 'bg-muted'}`}
          >
            <div className={`h-5 w-5 rounded-full bg-white transition-transform ${form.requiresApproval ? 'translate-x-5' : 'translate-x-0.5'}`} />
          </button>
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-4">
          <button type="button" onClick={() => navigate(-1)} className="flex-1 rounded-xl bg-secondary py-3 text-sm font-semibold text-foreground">Cancel</button>
          <button type="submit" disabled={isSubmitting} className="flex-1 gradient-primary rounded-xl py-3 text-sm font-semibold text-primary-foreground shadow-glow disabled:opacity-50">
            {isSubmitting ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </motion.form>
      <BottomNav />
    </div>
  );
}
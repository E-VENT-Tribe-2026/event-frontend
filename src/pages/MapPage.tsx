import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getEvents as getLocalEvents, type EventItem } from '@/lib/storage';
import BottomNav from '@/components/BottomNav';
import { ArrowLeft, LocateFixed, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import 'leaflet/dist/leaflet.css';
import { ALL_INTERESTS } from '@/lib/interests';
import { getApiUrl } from '@/lib/api';
import { mapApiEventToItem, parseEventsApiList } from '@/lib/mapApiEvent';
import AppToast from '@/components/AppToast';
import { extractCityFromLocation, getEventCities } from '@/lib/eventLocation';

function escapeHtml(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Spread markers that share the same rounded coordinates so popups stay tappable. */
function spreadOverlapping(events: EventItem[]): Array<{ item: EventItem; lat: number; lng: number }> {
  const valid = events.filter(
    (e) => Number.isFinite(e.lat) && Number.isFinite(e.lng) && !(e.lat === 0 && e.lng === 0),
  );
  const buckets = new Map<string, EventItem[]>();
  for (const e of valid) {
    const k = `${e.lat.toFixed(4)},${e.lng.toFixed(4)}`;
    if (!buckets.has(k)) buckets.set(k, []);
    buckets.get(k)!.push(e);
  }
  const result: Array<{ item: EventItem; lat: number; lng: number }> = [];
  for (const group of buckets.values()) {
    const n = group.length;
    group.forEach((item, i) => {
      const angle = (2 * Math.PI * i) / n;
      const ring = Math.floor(i / 8) + 1;
      const radius = 0.00012 * ring;
      result.push({
        item,
        lat: item.lat + Math.cos(angle) * radius,
        lng: item.lng + Math.sin(angle) * radius,
      });
    });
  }
  return result;
}

export default function MapPage() {
  const navigate = useNavigate();
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<any>(null);
  const markersLayerRef = useRef<any>(null);
  const leafletRef = useRef<any>(null);
  const userMarkerRef = useRef<any>(null);

  const [category, setCategory] = useState('All');
  const [filterDate, setFilterDate] = useState('');
  const [selectedCity, setSelectedCity] = useState('');
  const [titleSearch, setTitleSearch] = useState('');
  const [debouncedTitle, setDebouncedTitle] = useState('');
  const [debouncedFilterDate, setDebouncedFilterDate] = useState('');
  const [rawEvents, setRawEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [geoStatus, setGeoStatus] = useState<'idle' | 'pending' | 'granted' | 'denied' | 'unavailable'>('idle');
  const [toast, setToast] = useState({ show: false, message: '', type: 'error' as const });
  const [mapReady, setMapReady] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedTitle(titleSearch.trim()), 350);
    return () => window.clearTimeout(t);
  }, [titleSearch]);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedFilterDate(filterDate.trim()), 350);
    return () => window.clearTimeout(t);
  }, [filterDate]);

  const loadEvents = useCallback(async () => {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 12000);
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: '1', limit: '50' });
      if (category !== 'All') params.set('category', category);
      if (debouncedTitle) params.set('search', debouncedTitle);
      if (debouncedFilterDate) params.set('date', debouncedFilterDate);
      const res = await fetch(getApiUrl(`/api/events?${params}`), { signal: controller.signal });
      if (!res.ok) throw new Error('fetch failed');
      const body = await res.json();
      const rows = parseEventsApiList(body);
      const list = rows.map(mapApiEventToItem);
      const local = getLocalEvents().filter((e) => !e.isDraft);
      const byId = new Map<string, EventItem>();
      [...list, ...local].forEach((e) => byId.set(e.id, e));
      setRawEvents(Array.from(byId.values()));
    } catch {
      const local = getLocalEvents().filter((e) => !e.isDraft);
      setRawEvents(local);
      setToast({
        show: true,
        message: 'Could not load events from server. Showing saved events only.',
        type: 'error',
      });
    } finally {
      window.clearTimeout(timeout);
      setLoading(false);
    }
  }, [category, debouncedTitle, debouncedFilterDate, refreshKey]);

  const availableCities = useMemo(() => getEventCities(rawEvents), [rawEvents]);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  useEffect(() => {
    const interval = window.setInterval(() => setRefreshKey((k) => k + 1), 25000);
    const onFocus = () => setRefreshKey((k) => k + 1);
    window.addEventListener('focus', onFocus);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', onFocus);
    };
  }, []);

  const filteredEvents = useMemo(() => {
    return rawEvents.filter((e) => {
      if (category !== 'All' && e.category !== category) return false;
      if (debouncedFilterDate && e.date !== debouncedFilterDate) return false;
      const city = extractCityFromLocation(e.location || '');
      if (selectedCity && city !== selectedCity) return false;
      const titleQ = debouncedTitle.toLowerCase();
      if (titleQ && !e.title.toLowerCase().includes(titleQ)) return false;
      return true;
    });
  }, [rawEvents, category, debouncedFilterDate, selectedCity, debouncedTitle]);

  useEffect(() => {
    let cancelled = false;

    const initMap = async () => {
      const L = await import('leaflet');
      if (cancelled || !mapRef.current || mapInstance.current) return;
      leafletRef.current = L;

      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
        iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
      });

      const map = L.map(mapRef.current, { zoomControl: true, minZoom: 2 }).setView([40.7128, -74.006], 11);
      mapInstance.current = map;

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap',
      }).addTo(map);

      const layer = L.layerGroup().addTo(map);
      markersLayerRef.current = layer;

      setMapReady(true);
      requestAnimationFrame(() => map.invalidateSize());
    };

    initMap();

    return () => {
      cancelled = true;
      if (mapInstance.current) {
        mapInstance.current.remove();
        mapInstance.current = null;
        markersLayerRef.current = null;
        userMarkerRef.current = null;
      }
      setMapReady(false);
    };
  }, []);

  useEffect(() => {
    const map = mapInstance.current;
    const L = leafletRef.current;
    const layer = markersLayerRef.current;
    if (!map || !L || !layer) return;

    layer.clearLayers();
    const spread = spreadOverlapping(filteredEvents);

    spread.forEach(({ item: event, lat, lng }) => {
      const marker = L.marker([lat, lng]).addTo(layer);

      // Organizer display — name with avatar
      const organizerName = event.organizer || '';
      const organizerInitial = escapeHtml((organizerName || event.organizerId || 'O').charAt(0).toUpperCase());
      const organizerLabel = escapeHtml(organizerName || 'Event Organizer');

      const avatarHtml = event.organizerAvatar
        ? `<img src="${escapeHtml(event.organizerAvatar)}" alt="" style="width:28px;height:28px;border-radius:50%;object-fit:cover;border:2px solid #6d28d9;flex-shrink:0" onerror="this.style.display='none';this.nextSibling.style.display='flex'" /><span style="display:none;width:28px;height:28px;border-radius:50%;background:#6d28d9;color:#fff;font-size:11px;font-weight:700;align-items:center;justify-content:center;flex-shrink:0">${organizerInitial}</span>`
        : `<span style="display:flex;width:28px;height:28px;border-radius:50%;background:#6d28d9;color:#fff;font-size:11px;font-weight:700;align-items:center;justify-content:center;flex-shrink:0">${organizerInitial}</span>`;

      const costBadge = event.budget === 0
        ? `<span style="display:inline-block;padding:2px 8px;border-radius:99px;background:#22c55e20;color:#16a34a;font-size:10px;font-weight:700">Free</span>`
        : `<span style="display:inline-block;padding:2px 8px;border-radius:99px;background:#6d28d920;color:#6d28d9;font-size:10px;font-weight:700">$${escapeHtml(String(event.budget))}</span>`;

      const preview = `
        <div style="font-family:system-ui,sans-serif;min-width:200px;max-width:260px">
          <h3 style="margin:0 0 6px;font-size:14px;font-weight:700;line-height:1.3;color:#0f172a">${escapeHtml(event.title)}</h3>
          <p style="margin:0 0 2px;font-size:11px;color:#64748b">${escapeHtml(event.date)} · ${escapeHtml(event.time)}</p>
          <p style="margin:0 0 10px;font-size:11px;color:#64748b">${escapeHtml(event.location || '—')}</p>
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;padding:8px;background:#f8fafc;border-radius:8px">
            ${avatarHtml}
            <div style="min-width:0">
              <p style="margin:0;font-size:11px;font-weight:600;color:#0f172a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${organizerLabel}</p>
              <p style="margin:0;font-size:10px;color:#94a3b8">Organizer</p>
            </div>
            <div style="margin-left:auto">${costBadge}</div>
          </div>
          <button type="button" data-map-event-id="${escapeHtml(event.id)}" style="width:100%;padding:8px 10px;border:none;border-radius:8px;background:#6d28d9;color:#fff;font-size:12px;font-weight:600;cursor:pointer">
            View event details
          </button>
        </div>
      `;
      marker.bindPopup(preview, { maxWidth: 280 });
    });

    if (spread.length > 0) {
      const bounds = L.latLngBounds(spread.map((s) => [s.lat, s.lng] as [number, number]));
      map.fitBounds(bounds, { padding: [36, 36], maxZoom: 14 });
    }
  }, [filteredEvents, mapReady]);

  useEffect(() => {
    const map = mapInstance.current;
    if (!map || !mapReady) return;

    const onPopupOpen = (e: { popup: { getElement: () => HTMLElement | null } }) => {
      const el = e.popup.getElement();
      const btn = el?.querySelector('button[data-map-event-id]') as HTMLButtonElement | null;
      if (!btn) return;
      const id = btn.getAttribute('data-map-event-id');
      if (!id) return;
      btn.addEventListener(
        'click',
        (ev) => {
          ev.preventDefault();
          const selectedEvent = filteredEvents.find((entry) => entry.id === id) ?? null;
          navigate(`/event/${id}`, { state: selectedEvent ? { event: selectedEvent } : undefined });
        },
        { once: true },
      );
    };

    map.on('popupopen', onPopupOpen);
    return () => {
      map.off('popupopen', onPopupOpen);
    };
  }, [navigate, mapReady, filteredEvents]);

  const locateUser = () => {
    const map = mapInstance.current;
    const L = leafletRef.current;
    if (!map || !L) return;
    if (!('geolocation' in navigator)) {
      setGeoStatus('unavailable');
      setToast({ show: true, message: 'Geolocation is not available in this browser.', type: 'error' });
      return;
    }
    setGeoStatus('pending');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        const latLng: [number, number] = [latitude, longitude];
        map.setView(latLng, Math.max(map.getZoom(), 13));
        if (userMarkerRef.current) {
          userMarkerRef.current.setLatLng(latLng);
        } else {
          userMarkerRef.current = L.circleMarker(latLng, {
            radius: 9,
            color: '#2563eb',
            fillColor: '#3b82f6',
            fillOpacity: 0.9,
            weight: 2,
          })
            .addTo(map)
            .bindPopup('You are here');
        }
        setGeoStatus('granted');
      },
      () => {
        setGeoStatus('denied');
        setToast({
          show: true,
          message: 'Location permission denied. You can still browse the map.',
          type: 'error',
        });
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  };

  const manualRefresh = () => setRefreshKey((k) => k + 1);

  return (
    <div className="min-h-screen bg-background pb-20">
      <AppToast message={toast.message} type={toast.type} show={toast.show} onClose={() => setToast((t) => ({ ...t, show: false }))} />

      {/* Header */}
      <header className="sticky top-0 z-[1000] flex items-center justify-between border-b border-border bg-background/95 backdrop-blur-lg px-4 py-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            aria-label="Back"
            className="rounded-full glass-card p-2 hover:bg-secondary/80 transition-colors active:scale-90"
          >
            <ArrowLeft className="h-4 w-4 text-foreground" />
          </button>
          <div>
            <h1 className="text-base font-bold text-foreground leading-none">Explore Map</h1>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              {loading ? 'Loading…' : `${filteredEvents.length} event${filteredEvents.length !== 1 ? 's' : ''} nearby`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={manualRefresh}
            disabled={loading}
            aria-label="Refresh events"
            className="rounded-full glass-card p-2 hover:bg-secondary/80 transition-colors active:scale-90 disabled:opacity-50"
            title="Refresh events"
          >
            <RefreshCw className={`h-4 w-4 text-foreground ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            type="button"
            onClick={locateUser}
            aria-label="Center map on my location"
            title="Use my location"
            className={`rounded-full p-2 shadow-glow transition-all active:scale-90 ${
              geoStatus === 'granted' ? 'gradient-primary' : 'bg-primary/80 hover:bg-primary'
            }`}
          >
            <LocateFixed className="h-4 w-4 text-primary-foreground" />
          </button>
        </div>
      </header>

      {/* Filters */}
      <div className="border-b border-border/60 bg-background/80 backdrop-blur-sm px-4 py-3 space-y-3">
        {/* Category + Date row */}
        <div className="grid grid-cols-2 gap-2">
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-semibold uppercase text-muted-foreground">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full rounded-xl border border-border/50 bg-secondary px-3 py-2 text-xs text-foreground outline-none focus:ring-2 focus:ring-primary/40"
              aria-label="Filter by category"
            >
              {['All', ...ALL_INTERESTS].map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-semibold uppercase text-muted-foreground">Date</label>
            <input
              type="date"
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              className="w-full rounded-xl border border-border/50 bg-secondary px-3 py-2 text-xs text-foreground outline-none focus:ring-2 focus:ring-primary/40"
              aria-label="Filter by event date"
            />
          </div>
        </div>

        {/* Location + Search row */}
        <div className="grid grid-cols-2 gap-2">
          <div className="flex flex-col gap-1">
            <label htmlFor="map-city-filter" className="text-[10px] font-semibold uppercase text-muted-foreground">Location</label>
            <select
              id="map-city-filter"
              value={selectedCity}
              onChange={(e) => setSelectedCity(e.target.value)}
              className="w-full rounded-xl border border-border/50 bg-secondary px-3 py-2 text-xs text-foreground outline-none focus:ring-2 focus:ring-primary/40"
              aria-label="Filter events by location"
            >
              <option value="">All locations</option>
              {availableCities.map((city) => (
                <option key={city} value={city}>{city}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-semibold uppercase text-muted-foreground">Search</label>
            <input
              type="search"
              value={titleSearch}
              onChange={(e) => setTitleSearch(e.target.value)}
              placeholder="Event title…"
              className="w-full rounded-xl border border-border/50 bg-secondary px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-primary/40"
              aria-label="Search events by title"
            />
          </div>
        </div>

        {/* Status bar */}
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
          {loading ? (
            <><RefreshCw className="h-3 w-3 animate-spin" /> Loading events…</>
          ) : (
            <>
              <span className="h-1.5 w-1.5 rounded-full bg-green-500 shrink-0" />
              {filteredEvents.length} event{filteredEvents.length !== 1 ? 's' : ''} on map
            </>
          )}
          {geoStatus === 'granted' && <span className="ml-auto text-primary">📍 Your location shown</span>}
          {geoStatus === 'denied' && <span className="ml-auto text-destructive/70">Location off</span>}
        </div>
      </div>

      {/* Map */}
      <div className="relative">
        <div ref={mapRef} className="h-[min(72vh,580px)] w-full z-0" />
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/40 backdrop-blur-sm z-10 pointer-events-none">
            <div className="flex flex-col items-center gap-2 rounded-2xl glass-card px-6 py-4">
              <RefreshCw className="h-5 w-5 animate-spin text-primary" />
              <p className="text-xs text-muted-foreground">Loading events…</p>
            </div>
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  );
}

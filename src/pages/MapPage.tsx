import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getEvents as getLocalEvents, type EventItem } from '@/lib/storage';
import BottomNav from '@/components/BottomNav';
import { ArrowLeft, LocateFixed, RefreshCw, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import 'leaflet/dist/leaflet.css';
import { ALL_INTERESTS } from '@/lib/interests';
import { getApiUrl } from '@/lib/api';
import { getAuthToken } from '@/lib/auth';
import { mapApiEventToItem, parseEventsApiList } from '@/lib/mapApiEvent';
import AppToast from '@/components/AppToast';
import { extractCityFromLocation, getEventCities } from '@/lib/eventLocation';
import { isEventUpcoming, isEventCancelled } from '@/lib/eventTime';
import { buildMapEventPopup } from '@/lib/mapEventPopup';

const WORLD_BOUNDS: [[number, number], [number, number]] = [
  [-85, -180],
  [85, 180],
];

function clampToWorld(lat: number, lng: number): [number, number] {
  const [[south, west], [north, east]] = WORLD_BOUNDS;
  return [
    Math.max(south, Math.min(north, lat)),
    Math.max(west, Math.min(east, lng)),
  ];
}

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
  const [organizerProfiles, setOrganizerProfiles] = useState<Record<string, { full_name?: string; username?: string; avatar_url?: string }>>({});
  const [loading, setLoading] = useState(true);
  const [geoStatus, setGeoStatus] = useState<'idle' | 'pending' | 'granted' | 'denied' | 'unavailable'>('idle');
  const [toast, setToast] = useState({ show: false, message: '', type: 'error' as const });
  const [mapReady, setMapReady] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  // Use `loading` flag to block and disable interactions across the map page when fetching data
  const isAnyDataLoading = loading;

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedTitle(titleSearch.trim()), 350);
    return () => window.clearTimeout(t);
  }, [titleSearch]);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedFilterDate(filterDate.trim()), 350);
    return () => window.clearTimeout(t);
  }, [filterDate]);

  const loadEvents = useCallback(async (currentCategory: string, currentTitle: string, currentDate: string) => {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 12000);
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: '1', limit: '50' });
      if (currentCategory !== 'All') params.set('category', currentCategory);
      if (currentTitle) params.set('search', currentTitle);
      if (currentDate) params.set('date', currentDate);
      
      const token = getAuthToken();
      const headers: Record<string, string> = { Accept: 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(getApiUrl(`/api/events?${params}`), { headers, signal: controller.signal });
      if (!res.ok) throw new Error('fetch failed');
      const body = await res.json();
      const rows = parseEventsApiList(body);
      const list = rows.map(mapApiEventToItem);
      const local = getLocalEvents().filter((e) => !e.isDraft);
      const byId = new Map<string, EventItem>();
      [...list, ...local].forEach((e) => byId.set(e.id, e));
      const combinedEvents = Array.from(byId.values());
      setRawEvents(combinedEvents);

      const profileMap: Record<string, { full_name?: string; username?: string; avatar_url?: string }> = {};
      await Promise.all(
        rows.map(async (row: any) => {
          const creatorId = row.created_by || row.organizer_id;
          if (creatorId && !profileMap[creatorId]) {
            try {
              const profRes = await fetch(getApiUrl(`/api/profile/${creatorId}`), { headers });
              if (profRes.ok) {
                const profData = await profRes.json().catch(() => null);
                const prof = profData?.data || profData?.profile || profData;
                if (prof) {
                  profileMap[creatorId] = {
                    full_name: prof.full_name || prof.name,
                    username: prof.username,
                    avatar_url: prof.avatar_url,
                  };
                }
              }
            } catch {
              // ignore
            }
          }
        })
      );
      setOrganizerProfiles((prev) => ({ ...prev, ...profileMap }));
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
  }, []);

  const availableCities = useMemo(() => getEventCities(rawEvents), [rawEvents]);

  useEffect(() => {
    loadEvents(category, debouncedTitle, debouncedFilterDate);
  }, [category, debouncedTitle, debouncedFilterDate, refreshKey, loadEvents]);

  const filteredEvents = useMemo(() => {
    return rawEvents.filter((e) => {
      if (isEventCancelled(e) || !isEventUpcoming(e)) return false;
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

      const map = L.map(mapRef.current, {
        zoomControl: true,
        bounceAtZoomLimits: false,
        worldCopyJump: false,
        maxBounds: WORLD_BOUNDS,
        maxBoundsViscosity: 1,
        minZoom: 3,
      }).setView([40.7128, -74.006], 3);
      mapInstance.current = map;
      map.setMaxBounds(WORLD_BOUNDS);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap',
        noWrap: true,
        bounds: WORLD_BOUNDS,
      }).addTo(map);

      const layer = L.layerGroup().addTo(map);
      markersLayerRef.current = layer;

      const keepInsideWorld = () => map.panInsideBounds(WORLD_BOUNDS, { animate: false });
      map.on('dragend zoomend moveend', keepInsideWorld);

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
      const marker = L.marker(clampToWorld(lat, lng)).addTo(layer);

      const creatorId = event.organizerId || (event as any).created_by;
      const prof = creatorId ? organizerProfiles[creatorId] : null;

      const organizerFullName = prof?.full_name || event.organizerFullName || (event.organizer !== 'Organizer' ? event.organizer : '') || 'Organizer';
      const rawUsername = prof?.username || event.organizerUsername;
      const organizerUsername = rawUsername ? `@${rawUsername.replace(/^@/, '')}` : null;
      const organizerAvatar = prof?.avatar_url || event.organizerAvatar;

            // Built with DOM nodes + textContent so user text is never parsed as HTML (#245).
      const popup = buildMapEventPopup({
        id: event.id,
        title: event.title,
        date: event.date,
        time: event.time,
        location: event.location,
        budget: event.budget,
        organizerFullName,
        organizerUsername,
        organizerAvatar,
      });
      marker.bindPopup(popup, { maxWidth: 280 });
    });

    if (spread.length > 0) {
      const bounds = L.latLngBounds(spread.map((s) => clampToWorld(s.lat, s.lng)));
      map.fitBounds(bounds.pad(0.15), { padding: [36, 36], maxZoom: 14 });
      map.panInsideBounds(WORLD_BOUNDS, { animate: false });
    }
  }, [filteredEvents, mapReady, organizerProfiles]);

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
    if (isAnyDataLoading) return;
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
    <div className={`min-h-screen bg-background pb-20 relative ${isAnyDataLoading ? 'pointer-events-none select-none' : ''}`}>
      {/* Loading Overlay State */}
      {isAnyDataLoading && (
        <div className="absolute inset-0 z-50 bg-background/60 backdrop-blur-xs flex items-center justify-center">
          <div className="flex flex-col items-center gap-2 p-6 rounded-2xl glass-card shadow-lg">
            <Loader2 className="h-6 w-6 text-primary animate-spin" />
            <p className="text-xs font-semibold text-foreground">Loading</p>
          </div>
        </div>
      )}

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
              {loading && rawEvents.length === 0 ? 'Loading…' : `${filteredEvents.length} event${filteredEvents.length !== 1 ? 's' : ''} nearby`}
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

        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
          {loading && rawEvents.length === 0 ? (
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
        {loading && rawEvents.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/40 backdrop-blur-sm z-10 pointer-events-none">
            <div className="flex flex-col items-center gap-2 rounded-2xl glass-card px-6 py-4">
              <RefreshCw className="h-5 w-5 animate-spin text-primary" />
              <p className="text-xs text-muted-foreground">Loading events</p>
            </div>
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  );
}
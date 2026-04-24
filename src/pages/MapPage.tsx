import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getEvents as getLocalEvents, type EventItem } from '@/lib/storage';
import BottomNav from '@/components/BottomNav';
import { ArrowLeft, LocateFixed, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import 'leaflet/dist/leaflet.css';
import { CATEGORIES } from '@/lib/seedData';
import { getApiUrl } from '@/lib/api';
import { mapApiEventToItem, parseEventsApiList } from '@/lib/mapApiEvent';
import AppToast from '@/components/AppToast';

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
  const [locationQuery, setLocationQuery] = useState('');
  const [titleSearch, setTitleSearch] = useState('');
  const [debouncedTitle, setDebouncedTitle] = useState('');
  const [debouncedFilterDate, setDebouncedFilterDate] = useState('');
  const [debouncedLocation, setDebouncedLocation] = useState('');
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

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedLocation(locationQuery.trim()), 350);
    return () => window.clearTimeout(t);
  }, [locationQuery]);

  const loadEvents = useCallback(async () => {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 12000);
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: '1', limit: '50' });
      if (category !== 'All') params.set('category', category);
      if (debouncedTitle) params.set('search', debouncedTitle);
      if (debouncedFilterDate) params.set('event_date', debouncedFilterDate);
      if (debouncedLocation) params.set('location', debouncedLocation);
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
  }, [category, debouncedTitle, debouncedFilterDate, debouncedLocation, refreshKey]);

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
      if (filterDate && e.date !== filterDate) return false;
      const q = locationQuery.trim().toLowerCase();
      if (q && !e.location.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [rawEvents, category, filterDate, locationQuery]);

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

      const map = L.map(mapRef.current, { zoomControl: true }).setView([40.7128, -74.006], 11);
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
      const preview = `
        <div style="font-family:system-ui,sans-serif;min-width:180px;max-width:240px">
          <h3 style="margin:0 0 6px;font-size:14px;font-weight:600">${escapeHtml(event.title)}</h3>
          <p style="margin:0 0 4px;font-size:12px;color:#666">${escapeHtml(event.date)} · ${escapeHtml(event.time)}</p>
          <p style="margin:0 0 10px;font-size:12px;color:#666">${escapeHtml(event.location || '—')}</p>
          <button type="button" data-map-event-id="${escapeHtml(event.id)}" style="width:100%;padding:8px 10px;border:none;border-radius:8px;background:#6d28d9;color:#fff;font-size:12px;font-weight:600;cursor:pointer">
            View event details
          </button>
        </div>
      `;
      marker.bindPopup(preview);
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
          navigate(`/event/${id}`);
        },
        { once: true },
      );
    };

    map.on('popupopen', onPopupOpen);
    return () => {
      map.off('popupopen', onPopupOpen);
    };
  }, [navigate, mapReady]);

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
      <header className="sticky top-0 z-[1000] flex items-center justify-between border-b border-border bg-background/95 backdrop-blur-lg px-4 py-3">
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => navigate(-1)} aria-label="Back">
            <ArrowLeft className="h-5 w-5 text-foreground" />
          </button>
          <h1 className="text-lg font-bold text-foreground">Map</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={manualRefresh}
            className="rounded-full bg-secondary p-2"
            title="Refresh events"
            disabled={loading}
            aria-label="Refresh events"
          >
            <RefreshCw className={`h-4 w-4 text-foreground ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            type="button"
            onClick={locateUser}
            className="rounded-full bg-primary p-2 shadow-glow"
            title="Use my location"
            aria-label="Center map on my location"
          >
            <LocateFixed className="h-4 w-4 text-primary-foreground" />
          </button>
        </div>
      </header>

      <div className="space-y-2 border-b border-border/70 px-4 py-2">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full rounded-xl bg-secondary px-3 py-2 text-xs text-foreground outline-none"
            aria-label="Filter by category"
          >
            {['All', ...CATEGORIES].map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <input
            type="date"
            value={filterDate}
            onChange={(e) => setFilterDate(e.target.value)}
            className="w-full rounded-xl bg-secondary px-3 py-2 text-xs text-foreground outline-none"
            aria-label="Filter by event date"
          />
        </div>
        <input
          type="text"
          value={locationQuery}
          onChange={(e) => setLocationQuery(e.target.value)}
          placeholder="Filter by location text…"
          className="w-full rounded-xl bg-secondary px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground outline-none"
          aria-label="Filter by location"
        />
        <input
          type="search"
          value={titleSearch}
          onChange={(e) => setTitleSearch(e.target.value)}
          placeholder="Search title (server)…"
          className="w-full rounded-xl bg-secondary px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground outline-none"
          aria-label="Search events by title"
        />
        <p className="text-[10px] text-muted-foreground">
          {loading ? 'Loading events…' : `${filteredEvents.length} event(s) on map`}
          {geoStatus === 'granted' && ' · Your location is shown.'}
          {geoStatus === 'denied' && ' · Location off.'}
        </p>
      </div>

      <div ref={mapRef} className="h-[min(72vh,560px)] w-full z-0" />

      <BottomNav />
    </div>
  );
}

import { useEffect, useMemo, useRef, useState } from 'react';
import { LocateFixed, Loader2 } from 'lucide-react';
import 'leaflet/dist/leaflet.css';
import type { EventItem } from '@/lib/storage';
import { ALL_INTERESTS } from '@/lib/interests';
import { extractCityFromLocation, getEventCities } from '@/lib/eventLocation';
import { isEventUpcoming, isEventCancelled } from '@/lib/eventTime';

interface AdminMapViewProps {
  /** Events already mapped with mapApiEventToItem (so they have lat / lng). */
  events: EventItem[];
  loading: boolean;
  categoryFilter: string; // '' means All
  searchQuery: string;
  onCategoryChange: (category: string) => void;
  onSearchChange: (query: string) => void;
  /** Called when the popup's "View event details" button is clicked. */
  onOpenEvent: (eventId: string) => void;
}

const WORLD_BOUNDS: [[number, number], [number, number]] = [
  [-85, -180],
  [85, 180],
];

function clampToWorld(lat: number, lng: number): [number, number] {
  const [[south, west], [north, east]] = WORLD_BOUNDS;
  return [Math.max(south, Math.min(north, lat)), Math.max(west, Math.min(east, lng))];
}

function escapeHtml(s: string) {
  return String(s ?? '')
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

const fieldStyle: React.CSSProperties = {
  background: 'var(--adm-card)',
  borderColor: 'var(--adm-border)',
  color: 'var(--adm-fg)',
};

export default function AdminMapView({
  events,
  loading,
  categoryFilter,
  searchQuery,
  onCategoryChange,
  onSearchChange,
  onOpenEvent,
}: AdminMapViewProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<any>(null);
  const markersLayerRef = useRef<any>(null);
  const leafletRef = useRef<any>(null);
  const userMarkerRef = useRef<any>(null);

  const [mapReady, setMapReady] = useState(false);
  const [filterDate, setFilterDate] = useState('');
  const [selectedCity, setSelectedCity] = useState('');
  const [geoStatus, setGeoStatus] = useState<'idle' | 'pending' | 'granted' | 'denied' | 'unavailable'>('idle');

  // Always call the latest handler without re-binding Leaflet listeners.
  const onOpenEventRef = useRef(onOpenEvent);
  useEffect(() => { onOpenEventRef.current = onOpenEvent; }, [onOpenEvent]);

  const availableCities = useMemo(() => getEventCities(events), [events]);

  /* Same rules as the user map page: upcoming, not cancelled, then filters. */
  const filteredEvents = useMemo(() => {
    const cat = categoryFilter.trim().toLowerCase();
    const q = searchQuery.trim().toLowerCase();
    return events.filter((e) => {
      if (isEventCancelled(e) || !isEventUpcoming(e)) return false;
      if (cat && (e.category || '').trim().toLowerCase() !== cat) return false;
      if (filterDate && e.date !== filterDate) return false;
      if (selectedCity && extractCityFromLocation(e.location || '') !== selectedCity) return false;
      if (q && !e.title.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [events, categoryFilter, searchQuery, filterDate, selectedCity]);

  /* ---- Create the map once ---- */
  useEffect(() => {
    let cancelled = false;

    (async () => {
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

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap',
        noWrap: true,
        bounds: WORLD_BOUNDS,
      }).addTo(map);

      markersLayerRef.current = L.layerGroup().addTo(map);
      map.on('dragend zoomend moveend', () => map.panInsideBounds(WORLD_BOUNDS, { animate: false }));

      // Popup button -> open the admin event view.
      map.on('popupopen', (e: any) => {
        const btn = e.popup.getElement()?.querySelector('button[data-map-event-id]') as HTMLButtonElement | null;
        const id = btn?.getAttribute('data-map-event-id');
        if (!btn || !id) return;
        btn.addEventListener(
          'click',
          (ev) => {
            ev.preventDefault();
            map.closePopup();
            onOpenEventRef.current(id);
          },
          { once: true },
        );
      });

      setMapReady(true);
      requestAnimationFrame(() => map.invalidateSize());
    })();

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

  /* ---- Draw markers whenever the filtered events change ---- */
  useEffect(() => {
    const map = mapInstance.current;
    const L = leafletRef.current;
    const layer = markersLayerRef.current;
    if (!map || !L || !layer) return;

    layer.clearLayers();
    const spread = spreadOverlapping(filteredEvents);

    spread.forEach(({ item: event, lat, lng }) => {
      const marker = L.marker(clampToWorld(lat, lng)).addTo(layer);

      const organizerFullName =
        event.organizerFullName || (event.organizer !== 'Organizer' ? event.organizer : '') || 'Organizer';
      const organizerUsername = event.organizerUsername ? `@${event.organizerUsername.replace(/^@/, '')}` : null;
      const organizerAvatar = event.organizerAvatar;
      const organizerInitial = escapeHtml((organizerFullName || 'O').charAt(0).toUpperCase());

      const avatarHtml = organizerAvatar
        ? `<img src="${escapeHtml(organizerAvatar)}" alt="" style="width:28px;height:28px;border-radius:50%;object-fit:cover;border:2px solid #6d28d9;flex-shrink:0" onerror="this.style.display='none';this.nextSibling.style.display='flex'" /><span style="display:none;width:28px;height:28px;border-radius:50%;background:#6d28d9;color:#fff;font-size:11px;font-weight:700;align-items:center;justify-content:center;flex-shrink:0">${organizerInitial}</span>`
        : `<span style="display:flex;width:28px;height:28px;border-radius:50%;background:#6d28d9;color:#fff;font-size:11px;font-weight:700;align-items:center;justify-content:center;flex-shrink:0">${organizerInitial}</span>`;

      const costBadge =
        event.budget === 0
          ? `<span style="display:inline-block;padding:2px 8px;border-radius:99px;background:#22c55e20;color:#16a34a;font-size:10px;font-weight:700">Free</span>`
          : `<span style="display:inline-block;padding:2px 8px;border-radius:99px;background:#6d28d920;color:#6d28d9;font-size:10px;font-weight:700">€${escapeHtml(String(event.budget))}</span>`;

      marker.bindPopup(
        `
        <div style="font-family:system-ui,sans-serif;min-width:200px;max-width:260px">
          <h3 style="margin:0 0 6px;font-size:14px;font-weight:700;line-height:1.3;color:#0f172a">${escapeHtml(event.title)}</h3>
          <p style="margin:0 0 2px;font-size:11px;color:#64748b">${escapeHtml(event.date)} · ${escapeHtml(event.time)}</p>
          <p style="margin:0 0 10px;font-size:11px;color:#64748b">${escapeHtml(event.location || '—')}</p>
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;padding:8px;background:#f8fafc;border-radius:8px">
            ${avatarHtml}
            <div style="min-width:0;line-height:1.2">
              <p style="margin:0;font-size:11px;font-weight:600;color:#0f172a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escapeHtml(organizerFullName)}</p>
              ${organizerUsername ? `<p style="margin:0;font-size:10px;color:#64748b">${escapeHtml(organizerUsername)}</p>` : ''}
            </div>
            <div style="margin-left:auto">${costBadge}</div>
          </div>
          <button type="button" data-map-event-id="${escapeHtml(event.id)}" style="width:100%;padding:8px 10px;border:none;border-radius:8px;background:#6d28d9;color:#fff;font-size:12px;font-weight:600;cursor:pointer">
            View event details
          </button>
        </div>`,
        { maxWidth: 280 },
      );
    });

    if (spread.length > 0) {
      const bounds = L.latLngBounds(spread.map((s) => clampToWorld(s.lat, s.lng)));
      map.fitBounds(bounds.pad(0.15), { padding: [36, 36], maxZoom: 14 });
      map.panInsideBounds(WORLD_BOUNDS, { animate: false });
    }
  }, [filteredEvents, mapReady]);

  /* ---- "Use my location" ---- */
  const locateUser = () => {
    const map = mapInstance.current;
    const L = leafletRef.current;
    if (!map || !L) return;
    if (!('geolocation' in navigator)) {
      setGeoStatus('unavailable');
      return;
    }
    setGeoStatus('pending');
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const latLng: [number, number] = [coords.latitude, coords.longitude];
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
      () => setGeoStatus('denied'),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  };

  const labelClass = 'text-[10px] font-semibold uppercase';
  const inputClass = 'w-full rounded-xl border px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-primary/40';

  return (
    <div className="space-y-4">
      {/* Filters (same four as the user map page) */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div className="flex flex-col gap-1">
          <label htmlFor="admin-map-category" className={labelClass} style={{ color: 'var(--adm-muted-fg)' }}>Category</label>
          <select
            id="admin-map-category"
            value={categoryFilter || 'All'}
            onChange={(e) => onCategoryChange(e.target.value === 'All' ? '' : e.target.value)}
            className={inputClass}
            style={fieldStyle}
          >
            {['All', ...ALL_INTERESTS].map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="admin-map-date" className={labelClass} style={{ color: 'var(--adm-muted-fg)' }}>Date</label>
          <input
            id="admin-map-date"
            type="date"
            value={filterDate}
            onChange={(e) => setFilterDate(e.target.value)}
            className={inputClass}
            style={fieldStyle}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="admin-map-city" className={labelClass} style={{ color: 'var(--adm-muted-fg)' }}>Location</label>
          <select
            id="admin-map-city"
            value={selectedCity}
            onChange={(e) => setSelectedCity(e.target.value)}
            className={inputClass}
            style={fieldStyle}
          >
            <option value="">All locations</option>
            {availableCities.map((city) => (
              <option key={city} value={city}>{city}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="admin-map-search" className={labelClass} style={{ color: 'var(--adm-muted-fg)' }}>Search</label>
          <input
            id="admin-map-search"
            type="search"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Event title…"
            className={inputClass}
            style={fieldStyle}
          />
        </div>
      </div>

      {/* Status line + locate button */}
      <div className="flex items-center gap-2 text-[11px]" style={{ color: 'var(--adm-muted-fg)' }}>
        <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ background: '#22c55e' }} />
        {filteredEvents.length} event{filteredEvents.length !== 1 ? 's' : ''} on map
        {geoStatus === 'granted' && <span className="ml-2">· Your location shown</span>}
        {geoStatus === 'denied' && <span className="ml-2">· Location permission denied</span>}
        {geoStatus === 'unavailable' && <span className="ml-2">· Geolocation unavailable</span>}
        <button
          type="button"
          onClick={locateUser}
          disabled={geoStatus === 'pending'}
          aria-label="Center map on my location"
          title="Use my location"
          className="ml-auto rounded-full p-2 transition-all active:scale-90 disabled:opacity-50"
          style={{ background: 'var(--adm-grad)', color: 'white' }}
        >
          <LocateFixed className="h-4 w-4" />
        </button>
      </div>

      {/* Map */}
      <div
        className="relative overflow-hidden rounded-[20px] border"
        style={{ borderColor: 'var(--adm-border)', isolation: 'isolate' }}
      >
        <div ref={mapRef} className="h-[min(72vh,580px)] w-full" style={{ zIndex: 0 }} />
        {loading && (
          <div className="absolute inset-0 z-[500] flex items-center justify-center pointer-events-none"
            style={{ background: 'hsl(213 50% 10% / .45)' }}>
            <div className="flex flex-col items-center gap-2 rounded-2xl border px-6 py-4"
              style={{ background: 'var(--adm-card)', borderColor: 'var(--adm-border)' }}>
              <Loader2 className="h-5 w-5 animate-spin" style={{ color: 'var(--adm-primary)' }} />
              <p className="text-xs" style={{ color: 'var(--adm-muted-fg)' }}>Loading events</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
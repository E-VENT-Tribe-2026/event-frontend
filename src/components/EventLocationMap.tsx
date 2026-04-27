import { useEffect, useRef } from 'react';
import 'leaflet/dist/leaflet.css';
import { hasValidEventCoordinates } from '@/components/LocationPickerMap';

type EventLocationMapProps = {
  latitude: number;
  longitude: number;
  /** Extra height for readability */
  className?: string;
};

/**
 * Read-only OSM map centered on the event with a fixed marker (pan/zoom allowed).
 */
export default function EventLocationMap({
  latitude,
  longitude,
  className = 'h-52',
}: EventLocationMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);

  useEffect(() => {
    if (!hasValidEventCoordinates(latitude, longitude) || !containerRef.current) return;

    let cancelled = false;

    const run = async () => {
      const L = await import('leaflet');
      if (cancelled || !containerRef.current) return;

      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        markerRef.current = null;
      }

      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
        iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
      });

      const map = L.map(containerRef.current, {
        scrollWheelZoom: true,
        dragging: true,
        doubleClickZoom: true,
        boxZoom: true,
        keyboard: true,
        minZoom: 2,
      }).setView([latitude, longitude], 14);

      mapRef.current = map;

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap',
      }).addTo(map);

      markerRef.current = L.marker([latitude, longitude]).addTo(map);

      requestAnimationFrame(() => map.invalidateSize());
    };

    run();

    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        markerRef.current = null;
      }
    };
  }, [latitude, longitude]);

  if (!hasValidEventCoordinates(latitude, longitude)) {
    return (
      <div
        className={`flex items-center justify-center rounded-xl border border-border/50 bg-secondary/80 text-center text-xs text-muted-foreground ${className}`}
      >
        No map pin for this event
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`z-0 w-full overflow-hidden rounded-xl border border-border/50 ${className}`}
      role="img"
      aria-label={`Map showing event location at ${latitude}, ${longitude}`}
    />
  );
}

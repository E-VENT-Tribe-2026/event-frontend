import { useEffect, useRef, useCallback } from 'react';
import 'leaflet/dist/leaflet.css';

export type LocationPickerMapProps = {
  latitude: number | null;
  longitude: number | null;
  onLocationChange: (lat: number, lng: number) => void;
  /** Map center when no pin is set yet */
  defaultCenter?: [number, number];
  className?: string;
};

/**
 * Validates that coordinates are present, 
 * not NaN, and not the 0,0 placeholder.
 */
export const hasValidEventCoordinates = (lat: any, lng: any): boolean => {
  // Check for null, undefined, or NaN
  if (lat === null || lng === null || isNaN(lat) || isNaN(lng)) {
    return false;
  }

  // Check for the 0,0 placeholder specifically (Null Island)
  if (lat === 0 && lng === 0) {
    return false;
  }

  // Ensure they are finite numbers (prevents Infinity issues)
  return Number.isFinite(lat) && Number.isFinite(lng);
}; // <--- Make sure this brace is here!

/**
 * Click the map to place or move the pin; drag the pin to fine-tune.
 */
export default function LocationPickerMap({
  latitude,
  longitude,
  onLocationChange,
  defaultCenter = [40.7128, -74.006],
  className = 'h-56',
}: LocationPickerMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const leafletRef = useRef<any>(null);
  const mapReadyRef = useRef(false);
  const defaultCenterRef = useRef(defaultCenter);
  const onLocationChangeRef = useRef(onLocationChange);
  onLocationChangeRef.current = onLocationChange;

  const placeOrMoveMarker = useCallback((map: any, L: any, lat: number, lng: number) => {
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    if (!markerRef.current) {
      const m = L.marker([lat, lng], { draggable: true }).addTo(map);
      m.on('dragend', () => {
        const ll = m.getLatLng();
        onLocationChangeRef.current(ll.lat, ll.lng);
      });
      markerRef.current = m;
    } else {
      markerRef.current.setLatLng([lat, lng]);
    }
    map.setView([lat, lng], Math.max(map.getZoom(), 14));
  }, []);

  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      const L = await import('leaflet');
      if (cancelled || !mapRef.current || mapInstanceRef.current) return;

      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
        iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
      });

      const center = defaultCenterRef.current;
      const map = L.map(mapRef.current, { minZoom: 2 }).setView(center, 11);
      mapInstanceRef.current = map;
      leafletRef.current = L;

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap',
      }).addTo(map);

      map.on('click', (e: { latlng: { lat: number; lng: number } }) => {
        const { lat, lng } = e.latlng;
        placeOrMoveMarker(map, L, lat, lng);
        onLocationChangeRef.current(lat, lng);
      });

      mapReadyRef.current = true;
      requestAnimationFrame(() => map.invalidateSize());
    };

    init();

    return () => {
      cancelled = true;
      mapReadyRef.current = false;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        markerRef.current = null;
        leafletRef.current = null;
      }
    };
  }, [placeOrMoveMarker]);

  useEffect(() => {
    const map = mapInstanceRef.current;
    const L = leafletRef.current;
    if (!map || !L || !mapReadyRef.current) return;

    if (hasValidEventCoordinates(latitude, longitude)) {
      placeOrMoveMarker(map, L, latitude!, longitude!);
    } else if (markerRef.current) {
      map.removeLayer(markerRef.current);
      markerRef.current = null;
    }
  }, [latitude, longitude, placeOrMoveMarker]);

  return (
    <div className="space-y-2">
      <div
        ref={mapRef}
        className={`w-full overflow-hidden rounded-xl border border-border/50 ${className}`}
        role="application"
        aria-label="Map: click to set event location"
      />
      <p className="text-[10px] text-muted-foreground">
        Click the map to place the pin. Drag the pin to adjust. Zoom and pan with mouse or touch.
      </p>
    </div>
  );
}

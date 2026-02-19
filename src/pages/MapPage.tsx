import { useEffect, useRef, useState } from 'react';
import { getEvents } from '@/lib/storage';
import BottomNav from '@/components/BottomNav';
import { ArrowLeft, LocateFixed } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import 'leaflet/dist/leaflet.css';

export default function MapPage() {
  const navigate = useNavigate();
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<any>(null);
  const [radius, setRadius] = useState(50);

  useEffect(() => {
    let cancelled = false;

    const initMap = async () => {
      const L = await import('leaflet');

      // Fix default icon
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
        iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
      });

      if (cancelled || !mapRef.current || mapInstance.current) return;

      const map = L.map(mapRef.current).setView([40.7128, -74.006], 11);
      mapInstance.current = map;

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap',
      }).addTo(map);

      const events = getEvents();
      events.forEach(event => {
        const marker = L.marker([event.lat, event.lng]).addTo(map);
        marker.bindPopup(`
          <div style="font-family:Poppins,sans-serif;min-width:150px">
            <img src="${event.image}" style="width:100%;height:80px;object-fit:cover;border-radius:8px" />
            <h3 style="margin:8px 0 4px;font-size:14px;font-weight:600">${event.title}</h3>
            <p style="margin:0;font-size:12px;color:#888">${event.location}</p>
            <p style="margin:4px 0 0;font-size:12px;color:#888">${event.date} · ${event.time}</p>
          </div>
        `);
      });
    };

    initMap();

    return () => {
      cancelled = true;
      if (mapInstance.current) {
        mapInstance.current.remove();
        mapInstance.current = null;
      }
    };
  }, []);

  const locateUser = () => {
    if (!mapInstance.current) return;
    mapInstance.current.locate({ setView: true, maxZoom: 14 });
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-[1000] flex items-center justify-between border-b border-border bg-background/95 backdrop-blur-lg px-4 py-3">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)}><ArrowLeft className="h-5 w-5 text-foreground" /></button>
          <h1 className="text-lg font-bold text-foreground">Map</h1>
        </div>
        <button onClick={locateUser} className="rounded-full bg-primary p-2 shadow-glow">
          <LocateFixed className="h-4 w-4 text-primary-foreground" />
        </button>
      </header>

      <div className="px-4 py-2 flex items-center gap-3">
        <span className="text-xs text-muted-foreground shrink-0">Radius: {radius}km</span>
        <input type="range" min={5} max={200} value={radius} onChange={e => setRadius(Number(e.target.value))} className="flex-1 accent-primary h-1" />
      </div>

      <div ref={mapRef} className="h-[calc(100vh-160px)] w-full" />

      <BottomNav />
    </div>
  );
}

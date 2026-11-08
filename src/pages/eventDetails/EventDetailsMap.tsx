import { ExternalLink, MapPin } from 'lucide-react';
import EventLocationMap from '@/components/EventLocationMap';
import { openInGoogleMapsUrl } from '@/lib/mapsLinks';

type EventDetailsMapProps = {
  location: string;
  lat?: number;
  lng?: number;
};

export default function EventDetailsMap({ location, lat, lng }: EventDetailsMapProps) {
  return (
    <div className="rounded-2xl glass-card p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <MapPin className="h-4 w-4 text-primary" /> Location
        </h2>
        <a
          href={openInGoogleMapsUrl({ lat, lng, placeName: location })}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-lg bg-secondary px-3 py-1.5 text-xs font-semibold text-primary transition-colors hover:bg-secondary/80"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          Open in Google Maps
        </a>
      </div>
      <EventLocationMap latitude={lat} longitude={lng} className="h-52" />
      <p className="text-xs text-muted-foreground">{location}</p>
    </div>
  );
}

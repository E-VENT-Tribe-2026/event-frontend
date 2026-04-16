/**
 * LocationSearchInput
 *
 * Drop-in component that provides:
 * - Text search via Nominatim (OpenStreetMap) — no API key required
 * - Geolocation prompt when the component mounts (with Germany fallback)
 * - Emits { lat, lng, displayName } on selection so the parent can update
 *   both the form field and the map marker
 *
 * Props:
 *   value          — current location name string (controlled)
 *   onChange       — called when the text input changes
 *   onSelect       — called when user picks a result: { lat, lng, displayName }
 *   onUserLocation — called once geolocation resolves: { lat, lng }
 *   placeholder    — optional input placeholder
 *   error          — optional error message shown below input
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { Search, MapPin, Loader2, LocateFixed, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export interface LocationResult {
  lat: number;
  lng: number;
  displayName: string;
}

interface Props {
  value: string;
  onChange: (value: string) => void;
  onSelect: (result: LocationResult) => void;
  onUserLocation?: (coords: { lat: number; lng: number }) => void;
  placeholder?: string;
  error?: string;
}

// Germany centre as fallback
const GERMANY_DEFAULT = { lat: 51.1657, lng: 10.4515 };

async function searchNominatim(query: string): Promise<LocationResult[]> {
  const params = new URLSearchParams({
    q: query,
    format: 'json',
    limit: '6',
    countrycodes: '', // worldwide — remove if you want Germany-only: 'de'
    addressdetails: '1',
  });
  const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
    headers: { 'Accept-Language': 'en', 'User-Agent': 'EventApp/1.0' },
  });
  if (!res.ok) throw new Error('Search failed');
  const data = await res.json();
  return (data as any[]).map((item) => ({
    lat: parseFloat(item.lat),
    lng: parseFloat(item.lon),
    displayName: item.display_name as string,
  }));
}

export default function LocationSearchInput({
  value,
  onChange,
  onSelect,
  onUserLocation,
  placeholder = 'Search for a venue, address or city…',
  error,
}: Props) {
  const [query, setQuery] = useState(value);
  const [results, setResults] = useState<LocationResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [locating, setLocating] = useState(false);
  const [selected, setSelected] = useState<LocationResult | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Sync external value changes (e.g. edit flow pre-fill)
  useEffect(() => {
    if (value && value !== query) {
      setQuery(value);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  // Request geolocation on mount
  useEffect(() => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        onUserLocation?.(coords);
        setLocating(false);
      },
      () => {
        // Denied or unavailable — parent keeps Germany default
        onUserLocation?.(GERMANY_DEFAULT);
        setLocating(false);
      },
      { timeout: 8000 },
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSearch = useCallback(async () => {
    const q = query.trim();
    if (!q) return;
    setSearching(true);
    setSearchError('');
    setResults([]);
    setIsOpen(true);
    try {
      const found = await searchNominatim(q);
      setResults(found);
      if (found.length === 0) setSearchError('No locations found. Try a different search.');
    } catch {
      setSearchError('Search failed. Please check your connection.');
    } finally {
      setSearching(false);
    }
  }, [query]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSearch();
    }
  };

  const handleSelect = (result: LocationResult) => {
    setSelected(result);
    setQuery(result.displayName);
    onChange(result.displayName);
    onSelect(result);
    setIsOpen(false);
    setResults([]);
  };

  const handleClear = () => {
    setQuery('');
    onChange('');
    setSelected(null);
    setResults([]);
    setIsOpen(false);
    inputRef.current?.focus();
  };

  const handleLocateMe = () => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        onUserLocation?.(coords);
        // Reverse geocode
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${coords.lat}&lon=${coords.lng}&format=json`,
            { headers: { 'Accept-Language': 'en', 'User-Agent': 'EventApp/1.0' } },
          );
          const data = await res.json();
          const displayName = data.display_name || `${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}`;
          const result: LocationResult = { ...coords, displayName };
          handleSelect(result);
        } catch {
          // Just move the map without updating the text
        }
        setLocating(false);
      },
      () => setLocating(false),
      { timeout: 8000 },
    );
  };

  const shortName = (full: string) => {
    // Show first two comma-separated parts for compact display
    const parts = full.split(',');
    return parts.slice(0, 2).join(',').trim();
  };

  return (
    <div ref={containerRef} className="relative space-y-1">
      {/* Input row */}
      <div
        className={`flex items-center gap-2 rounded-xl bg-secondary px-3 py-2.5 transition-all ${
          error ? 'ring-1 ring-destructive' : 'focus-within:ring-2 focus-within:ring-primary/50'
        }`}
      >
        <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            onChange(e.target.value);
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
        />
        {query && (
          <button type="button" onClick={handleClear} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="h-3.5 w-3.5" />
          </button>
        )}
        <button
          type="button"
          onClick={handleLocateMe}
          disabled={locating}
          title="Use my location"
          className="text-muted-foreground hover:text-primary transition-colors disabled:opacity-40"
        >
          {locating ? <Loader2 className="h-4 w-4 animate-spin" /> : <LocateFixed className="h-4 w-4" />}
        </button>
        <button
          type="button"
          onClick={handleSearch}
          disabled={searching || !query.trim()}
          className="rounded-lg bg-primary/15 px-2.5 py-1 text-[11px] font-semibold text-primary hover:bg-primary/25 transition-colors disabled:opacity-40"
        >
          {searching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Search'}
        </button>
      </div>

      {/* Selected pill */}
      {selected && (
        <div className="flex items-center gap-1.5 rounded-lg bg-primary/10 px-3 py-1.5">
          <MapPin className="h-3 w-3 shrink-0 text-primary" />
          <span className="text-[11px] font-medium text-primary line-clamp-1">{shortName(selected.displayName)}</span>
        </div>
      )}

      {/* Error hint */}
      {error && <p className="px-2 text-[10px] text-destructive">{error}</p>}

      {/* Results dropdown */}
      <AnimatePresence>
        {isOpen && (searching || results.length > 0 || searchError) && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            className="absolute left-0 right-0 z-50 mt-1 overflow-hidden rounded-xl border border-border bg-card shadow-lg"
          >
            {searching && (
              <div className="flex items-center gap-2 px-4 py-3 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Searching…
              </div>
            )}
            {searchError && !searching && (
              <p className="px-4 py-3 text-xs text-muted-foreground">{searchError}</p>
            )}
            {!searching && results.map((r, i) => (
              <button
                key={i}
                type="button"
                onClick={() => handleSelect(r)}
                className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-secondary/60 transition-colors border-b border-border/40 last:border-0"
              >
                <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                <div className="min-w-0">
                  <p className="text-xs font-medium text-foreground line-clamp-1">{shortName(r.displayName)}</p>
                  <p className="text-[10px] text-muted-foreground line-clamp-1">{r.displayName}</p>
                </div>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
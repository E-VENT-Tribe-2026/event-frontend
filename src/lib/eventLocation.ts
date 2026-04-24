import type { EventItem } from '@/lib/storage';

/**
 * Derive a city-like label from an event location string.
 * We use the first comma-separated segment as the selectable city value
 * because many stored locations are "City, Region, Country" or
 * "Venue, City, Country".
 */
export function extractCityFromLocation(location: string): string {
  const value = location.trim();
  if (!value) return '';
  const [firstPart = ''] = value.split(',').map((part) => part.trim());
  return firstPart;
}

export function getEventCities(events: EventItem[]): string[] {
  const unique = new Set<string>();
  for (const event of events) {
    const city = extractCityFromLocation(event.location || '');
    if (city) unique.add(city);
  }
  return Array.from(unique).sort((a, b) => a.localeCompare(b));
}

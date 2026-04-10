/** Open Google Maps search at coordinates or by place name. */
export function openInGoogleMapsUrl(params: { lat: number; lng: number; placeName?: string }): string {
  const { lat, lng, placeName } = params;
  const coordsOk =
    Number.isFinite(lat) && Number.isFinite(lng) && !(lat === 0 && lng === 0);
  if (coordsOk) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${lat},${lng}`)}`;
  }
  if (placeName?.trim()) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(placeName.trim())}`;
  }
  return 'https://www.google.com/maps/';
}

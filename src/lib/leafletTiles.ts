/**
 * Carto Basemaps raster URL (from their dashboard):
 *   https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png?key=YOUR_KEY
 * Without VITE_CARTO_API_KEY we use Esri so the map is not covered in "API KEY REQUIRED".
 */
const CARTO_KEY = import.meta.env.VITE_CARTO_API_KEY?.trim();

const CARTO_URL =
  `https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png?key=${encodeURIComponent(CARTO_KEY ?? '')}`;

const ESRI_URL =
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}';

export const LEAFLET_TILE_URL = CARTO_KEY ? CARTO_URL : ESRI_URL;

export const LEAFLET_TILE_OPTIONS = {
  attribution: CARTO_KEY
    ? '&copy; OpenStreetMap &copy; CARTO'
    : 'Tiles &copy; Esri &mdash; Source: Esri, TomTom, Garmin, FAO, NOAA, USGS',
  maxZoom: 20,
  noWrap: true,
  updateWhenIdle: true,
  keepBuffer: 4,
};

import type { EventItem } from '@/lib/storage';

const POSTAL_RE = /^\d{4,6}(\s+\S.*)?$|^[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}$/i;

const SKIP_WORDS = new Set([
  'germany','deutschland','france','spain','italy','netherlands','belgium',
  'austria','switzerland','poland','portugal','sweden','norway','denmark',
  'finland','greece','turkey','russia','ukraine','czech republic','hungary',
  'romania','slovakia','croatia','serbia','bulgaria',
  'united states','united states of america','usa','us',
  'united kingdom','uk','great britain','england','scotland','wales',
  'canada','australia','new zealand','india','china','japan','brazil',
  'mexico','south africa','argentina','colombia','chile','peru',
  'al','ak','az','ar','ca','co','ct','de','fl','ga','hi','id','il','in','ia',
  'ks','ky','la','me','md','ma','mi','mn','ms','mo','mt','ne','nv','nh','nj',
  'nm','ny','nc','nd','oh','ok','or','pa','ri','sc','sd','tn','tx','ut','vt',
  'va','wa','wv','wi','wy','dc',
  'alabama','alaska','arizona','arkansas','california','colorado','connecticut',
  'delaware','florida','georgia','hawaii','idaho','illinois','indiana','iowa',
  'kansas','kentucky','louisiana','maine','maryland','massachusetts','michigan',
  'minnesota','mississippi','missouri','montana','nebraska','nevada',
  'new hampshire','new jersey','new mexico','new york','north carolina',
  'north dakota','ohio','oklahoma','oregon','pennsylvania','rhode island',
  'south carolina','south dakota','tennessee','texas','utah','vermont',
  'virginia','washington','west virginia','wisconsin','wyoming',
  'bavaria','bayern','berlin','hamburg','bremen','saxony','sachsen',
  'thuringia','thüringen','hesse','hessen','lower saxony','niedersachsen',
  'north rhine-westphalia','nordrhein-westfalen','rhineland-palatinate',
  'rheinland-pfalz','saarland','schleswig-holstein','mecklenburg-vorpommern',
  'saxony-anhalt','sachsen-anhalt','brandenburg','baden-württemberg',
]);

function isNoise(segment: string): boolean {
  const s = segment.trim();
  if (!s) return true;
  if (POSTAL_RE.test(s)) return true;
  return SKIP_WORDS.has(s.toLowerCase());
}

/**
 * Extract the city from an OpenStreetMap/Nominatim reverse-geocoded string.
 * Walks backwards from the end, skipping country, state, and postal segments.
 */
export function extractCityFromLocation(location: string): string {
  const value = location.trim();
  if (!value) return '';
  const parts = value.split(',').map((p) => p.trim()).filter(Boolean);
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0];

  for (let i = parts.length - 1; i >= 0; i--) {
    const seg = parts[i].trim();
    if (!seg) continue;
    // German inline postal: "28759 Bremen" → "Bremen"
    const inlinePostal = seg.match(/^\d{4,6}\s+(.+)$/);
    if (inlinePostal) return inlinePostal[1].trim();
    if (!isNoise(seg)) return seg;
  }
  return parts[0];
}

export function getEventCities(events: EventItem[]): string[] {
  const unique = new Set<string>();
  for (const event of events) {
    const city = extractCityFromLocation(event.location || '');
    if (city) unique.add(city);
  }
  return Array.from(unique).sort((a, b) => a.localeCompare(b));
}

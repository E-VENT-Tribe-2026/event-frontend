/**
 * Central avatar URLs: real photos when valid, otherwise deterministic Dicebear SVGs.
 * Dicebear 9.x — stable, works without auth (7.x endpoints were deprecated for some clients).
 */

const DICEBEAR_STYLE = 'avataaars';

/** Public SVG endpoint — always returns an image for any seed. */
export function getGeneratedAvatarUrl(seed: string): string {
  const s = (seed || 'guest').toString().slice(0, 128);
  return `https://api.dicebear.com/9.x/${DICEBEAR_STYLE}/svg?seed=${encodeURIComponent(s)}`;
}

/** First usable image URL from candidates (http(s) or data:image). */
export function pickImageUrl(...candidates: (string | null | undefined)[]): string | null {
  for (const u of candidates) {
    if (typeof u !== 'string') continue;
    const t = u.trim();
    if (!t) continue;
    if (/^https?:\/\//i.test(t)) return t;
    if (t.startsWith('data:image')) return t;
  }
  return null;
}

/** Image URL for display: real photo if present, else generated. */
export function resolveAvatarDisplayUrl(options: {
  photoUrl?: string | null;
  altUrl?: string | null;
  seed: string;
}): string {
  const picked = pickImageUrl(options.photoUrl, options.altUrl);
  if (picked) return picked;
  return getGeneratedAvatarUrl(options.seed);
}

/** 1–2 uppercase initials for fallback UI. */
export function getInitials(name: string | undefined | null, email?: string | null): string {
  const n = (name || '').trim();
  if (n) {
    const parts = n.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return n.slice(0, 2).toUpperCase();
  }
  const e = (email || '').split('@')[0] || '?';
  return e.slice(0, 2).toUpperCase();
}

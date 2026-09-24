/**
 * Profile photo limits — shared by registration and edit profile (FR 7.1).
 */
export const PROFILE_PHOTO_MAX_BYTES = 5 * 1024 * 1024; // 5 MB
export const PROFILE_PHOTO_MAX_LABEL = '5 MB';

/** MIME types accepted for profile photos. */
export const PROFILE_PHOTO_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
] as const;

export const PROFILE_PHOTO_ACCEPT_ATTR = 'image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp';

export const PROFILE_PHOTO_FORMAT_HINT = 'JPEG, PNG or WebP · max 5 MB';

const EXT_TO_MIME: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};

function mimeFromName(name: string): string | null {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  return EXT_TO_MIME[ext] || null;
}

export type ProfilePhotoValidationResult =
  | { ok: true }
  | { ok: false; reason: 'format' | 'size'; message: string };

/** Validate a profile photo before preview or upload. */
export function validateProfilePhotoFile(file: File): ProfilePhotoValidationResult {
  const mime = (file.type || mimeFromName(file.name) || '').toLowerCase();
  const allowed = PROFILE_PHOTO_MIME_TYPES as readonly string[];
  if (!mime || !allowed.includes(mime)) {
    return {
      ok: false,
      reason: 'format',
      message: 'Photo format not accepted. Use JPEG, PNG or WebP.',
    };
  }
  if (file.size > PROFILE_PHOTO_MAX_BYTES) {
    return {
      ok: false,
      reason: 'size',
      message: `Photo is too large. Maximum size is ${PROFILE_PHOTO_MAX_LABEL}.`,
    };
  }
  return { ok: true };
}

/** Map a storage provider error to a size/format message when possible. */
export function storageRefusalMessage(raw: string): string | null {
  const text = (raw || '').toLowerCase();
  if (!text) return null;
  if (/size|too large|maximum|exceed|413|payload|file too big/.test(text)) {
    return `Photo is too large. Maximum size is ${PROFILE_PHOTO_MAX_LABEL}.`;
  }
  if (/mime|content.?type|not allowed|unsupported|invalid type|format/.test(text)) {
    return 'Photo format not accepted. Use JPEG, PNG or WebP.';
  }
  return null;
}

export function extensionForMime(mime: string): string {
  if (mime === 'image/png') return 'png';
  if (mime === 'image/webp') return 'webp';
  return 'jpg';
}

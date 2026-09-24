/** Same limit and formats as the avatars storage bucket and the edit-profile screen. */
export const PROFILE_PHOTO_MAX_BYTES = 5 * 1024 * 1024;

const ACCEPTED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

export function profilePhotoError(file: File): string | null {
  if (!ACCEPTED_TYPES.has(file.type)) {
    return 'Photo must be a JPEG, PNG or WebP image';
  }
  if (file.size > PROFILE_PHOTO_MAX_BYTES) {
    return 'Photo must be 5 MB or smaller';
  }
  return null;
}

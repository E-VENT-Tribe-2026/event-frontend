import { supabase } from '@/lib/supabase';
import { extensionForMime, storageRefusalMessage, validateProfilePhotoFile } from '@/lib/profilePhoto';
import { getGeneratedAvatarUrl } from '@/lib/avatars';

/** Seeds that form the default icon set assigned at sign-up. */
export const DEFAULT_ICON_SEEDS = [
  'aurora',
  'blaze',
  'coral',
  'drift',
  'ember',
  'flint',
  'grove',
  'haven',
  'ivy',
  'jade',
  'kite',
  'lunar',
] as const;

export function pickDefaultIconUrl(): string {
  const randomBytes = new Uint32Array(1);
  crypto.getRandomValues(randomBytes);
  const seed = DEFAULT_ICON_SEEDS[randomBytes[0] % DEFAULT_ICON_SEEDS.length];
  return getGeneratedAvatarUrl(seed);
}

const AVATAR_BUCKET = 'avatars';

/**
 * Upload a profile photo from the browser to Supabase Storage and return its public URL.
 */
export async function uploadProfilePhotoToStorage(
  userId: string,
  file: File,
): Promise<string> {
  const validation = validateProfilePhotoFile(file);
  if (!validation.ok) {
    throw new Error(validation.message);
  }
  if (!supabase) {
    throw new Error('Storage is not configured.');
  }

  const mime = file.type || 'image/jpeg';
  const ext = extensionForMime(mime);
  const path = `${userId}/avatar-${Date.now()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from(AVATAR_BUCKET)
    .upload(path, file, {
      cacheControl: '3600',
      upsert: true,
      contentType: mime,
    });

  if (uploadError) {
    const mapped = storageRefusalMessage(uploadError.message || '');
    throw new Error(mapped || uploadError.message || 'Photo upload failed.');
  }

  const { data } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path);
  const publicUrl = data?.publicUrl;
  if (!publicUrl) {
    throw new Error('Could not resolve photo address after upload.');
  }
  return publicUrl;
}

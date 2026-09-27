import { validateProfilePhotoFile } from '@/lib/profilePhoto';
import { getGeneratedAvatarUrl } from '@/lib/avatars';
import { getAuthToken } from '@/lib/auth';

// Helper to construct your backend API URL safely
import { getApiUrl } from '@/lib/api'; // Adjust this import path if your api helper is located elsewhere

/** Seeds that form the default icon set assigned at sign-up. */
export const DEFAULT_ICON_SEEDS = [
  'aurora', 'blaze', 'coral', 'drift', 'ember', 'flint',
  'grove', 'haven', 'ivy', 'jade', 'kite', 'lunar',
] as const;

export function pickDefaultIconUrl(): string {
  const randomBytes = new Uint32Array(1);
  crypto.getRandomValues(randomBytes);
  const seed = DEFAULT_ICON_SEEDS[randomBytes[0] % DEFAULT_ICON_SEEDS.length];
  return getGeneratedAvatarUrl(seed);
}

/**
 * Upload a profile photo through your backend API endpoint and return its public URL.
 */
export async function uploadProfilePhotoToStorage(
  userId: string,
  file: File,
): Promise<string> {
  const validation = validateProfilePhotoFile(file);
  console.log('DEBUG file:', file.name, file.type, file.size);
  if (!validation.ok) {
    const errorMsg = 'error' in validation ? String(validation.error) : 'Invalid photo file.';
    throw new Error(errorMsg);
  }

  const token = getAuthToken();
  console.log('Token being sent:', token);
  if (!token) {
    throw new Error('You must be logged in to upload a profile photo.');
}

  const formData = new FormData();
  formData.append('file', file);
  formData.append('userId', userId); 

  const response = await fetch(getApiUrl('/api/profile/upload-photo'), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,

    },
    body: formData,
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.detail || errData.message || 'Photo upload failed.');
  }

  const data = await response.json();
  const publicUrl = data.avatar_url || data.url;

  if (!publicUrl) {
    throw new Error('Could not resolve photo address after upload.');
  }

  return publicUrl;
}
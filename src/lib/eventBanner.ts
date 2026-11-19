import { getCategoryBanner } from '@/lib/categoryBanners';
import { getApiUrl } from '@/lib/api';
import { getAuthToken } from '@/lib/auth';
import { validateProfilePhotoFile } from '@/lib/profilePhoto';

function usableImageUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const url = value.trim();
  if (!url) return null;
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:') || url.startsWith('blob:')) {
    return url;
  }
  return null;
}

function urlFromUnknown(value: unknown): string | null {
  const direct = usableImageUrl(value);
  if (direct) return direct;
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const rec = value as Record<string, unknown>;
  return (
    usableImageUrl(rec.banner_url) ||
    usableImageUrl(rec.url) ||
    usableImageUrl(rec.image_url) ||
    usableImageUrl(rec.public_url)
  );
}

/** http(s) URL that the backend can store — blob/data previews stay local only. */
export function publicBannerUrl(value: unknown): string | null {
  const url = urlFromUnknown(value);
  if (!url) return null;
  if (url.startsWith('https://') || url.startsWith('http://')) return url;
  return null;
}

/** Custom upload or API banner when present; otherwise the category default. */
export function eventBannerFrom(api: Record<string, unknown> | null | undefined, category?: string): string {
  if (api) {
    for (const key of ['banner_url', 'banner', 'image_url', 'cover_url', 'image']) {
      const url = urlFromUnknown(api[key]);
      if (url) return url;
    }
  }
  return getCategoryBanner(category);
}

function publicUrlFromUploadBody(data: unknown): string | null {
  if (!data || typeof data !== 'object') return null;
  const rec = data as Record<string, unknown>;
  return publicBannerUrl(rec) || publicBannerUrl(rec.data) || publicBannerUrl(rec.banner);
}

/**
 * Upload a custom event banner and return its public URL.
 * Tries POST /api/events/upload-banner, then POST /api/events/banner.
 */
export async function uploadEventBanner(file: File): Promise<string> {
  const validation = validateProfilePhotoFile(file);
  if (!validation.ok) throw new Error(validation.message);

  const token = getAuthToken();
  if (!token) throw new Error('You must be logged in to upload a banner.');

  const paths = ['/api/events/upload-banner', '/api/events/banner'];
  let lastError = 'Banner upload failed.';

  for (const path of paths) {
    const formData = new FormData();
    formData.append('file', file);
    const response = await fetch(getApiUrl(path), {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });
    if (response.status === 404) continue;
    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      lastError = String(
        (errData as { detail?: unknown; message?: unknown }).detail ||
          (errData as { message?: unknown }).message ||
          lastError,
      );
      throw new Error(lastError);
    }
    const publicUrl = publicUrlFromUploadBody(await response.json().catch(() => null));
    if (!publicUrl) throw new Error('Could not resolve banner address after upload.');
    return publicUrl;
  }

  throw new Error(lastError);
}

import { getCategoryBanner } from '@/lib/categoryBanners';

function usableImageUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const url = value.trim();
  if (!url) return null;
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:') || url.startsWith('blob:')) {
    return url;
  }
  return null;
}

/** Custom upload or API banner when present; otherwise the category default. */
export function eventBannerFrom(api: Record<string, unknown> | null | undefined, category?: string): string {
  if (api) {
    for (const key of ['banner_url', 'image_url', 'cover_url', 'image']) {
      const url = usableImageUrl(api[key]);
      if (url) return url;
    }
  }
  return getCategoryBanner(category);
}

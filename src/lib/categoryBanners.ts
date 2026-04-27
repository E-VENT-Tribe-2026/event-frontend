/**
 * Default banner images per event category.
 * Images are sourced from Unsplash and match the seed data where applicable.
 */
export const CATEGORY_BANNERS: Record<string, string> = {
  Music:      'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=600&q=80',
  Tech:       'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=600&q=80',
  Food:       'https://images.unsplash.com/photo-1501281668745-f7f57925c3b4?w=600&q=80',
  Wellness:   'https://images.unsplash.com/photo-1511795409834-ef04bbd61622?w=600&q=80',
  Art:        'https://images.unsplash.com/photo-1505236858219-8359eb29e329?w=600&q=80',
  Networking: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600&q=80',
  Gaming:     'https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=600&q=80',
  Sports:     'https://images.unsplash.com/photo-1461896836934-ffe607ba8211?w=600&q=80',
  Movies:     'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=600&q=80',
  Study:      'https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?w=600&q=80',
  Travel:     'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=600&q=80',
  Fitness:    'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=600&q=80',
  Coffee:     'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=600&q=80',
};

/** Fallback image used when a category has no specific banner. */
export const DEFAULT_BANNER =
  'https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?w=600&q=80';

/**
 * Returns the default banner image for a given event category.
 * Falls back to DEFAULT_BANNER if the category is not recognised.
 */
export function getCategoryBanner(category?: string): string {
  if (!category) return DEFAULT_BANNER;
  return CATEGORY_BANNERS[category] ?? DEFAULT_BANNER;
}

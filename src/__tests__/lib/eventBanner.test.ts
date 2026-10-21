import { describe, it, expect } from 'vitest';
import { eventBannerFrom } from '@/lib/eventBanner';
import { getCategoryBanner } from '@/lib/categoryBanners';

describe('eventBannerFrom', () => {
  it('prefers banner_url over other image fields', () => {
    expect(
      eventBannerFrom(
        {
          banner_url: 'https://cdn.example/banner.jpg',
          image_url: 'https://cdn.example/image.jpg',
          image: 'https://cdn.example/legacy.jpg',
        },
        'Music',
      ),
    ).toBe('https://cdn.example/banner.jpg');
  });

  it('falls back to the category default when no usable URL is present', () => {
    expect(eventBannerFrom({ image: 'not-a-url' }, 'Sports')).toBe(getCategoryBanner('Sports'));
    expect(eventBannerFrom(null, 'Music')).toBe(getCategoryBanner('Music'));
  });

  it('accepts http, blob and data URLs', () => {
    expect(eventBannerFrom({ image: 'http://cdn.example/a.jpg' })).toBe('http://cdn.example/a.jpg');
    expect(eventBannerFrom({ image: 'blob:http://localhost/abc' })).toBe('blob:http://localhost/abc');
    expect(eventBannerFrom({ image: 'data:image/png;base64,abc' })).toBe('data:image/png;base64,abc');
  });
});

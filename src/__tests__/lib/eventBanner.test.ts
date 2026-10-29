import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { eventBannerFrom, publicBannerUrl, uploadEventBanner } from '@/lib/eventBanner';
import { getCategoryBanner } from '@/lib/categoryBanners';
import * as authModule from '@/lib/auth';

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

  it('reads a nested banner object from the events API', () => {
    expect(
      eventBannerFrom(
        {
          banner_url: null,
          banner: { url: 'https://cdn.example/nested.jpg' },
        },
        'Movies',
      ),
    ).toBe('https://cdn.example/nested.jpg');
  });

  it('does not send blob previews as a stored banner URL', () => {
    expect(publicBannerUrl('blob:http://localhost/abc')).toBeNull();
    expect(publicBannerUrl('https://cdn.example/ok.jpg')).toBe('https://cdn.example/ok.jpg');
  });
});

describe('uploadEventBanner', () => {
  beforeEach(() => {
    vi.spyOn(authModule, 'getAuthToken').mockReturnValue('tok');
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('posts the file and returns the public URL', async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ banner_url: 'https://cdn.example/event.jpg' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const file = new File(['abc'], 'night.jpg', { type: 'image/jpeg' });
    await expect(uploadEventBanner(file)).resolves.toBe('https://cdn.example/event.jpg');
    expect(String(fetchMock.mock.calls[0][0])).toContain('/api/events/upload-banner');
  });
});

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchAllPublicEvents } from '@/lib/queries';
import { setAuthToken } from '@/lib/auth';

function jsonOk(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

function row(id: string) {
  return {
    id,
    title: id,
    category: 'Music',
    start_datetime: '2030-07-20T15:00:00.000Z',
    cost: 0,
    max_capacity: 20,
    location_name: 'Berlin',
    latitude: 52.5,
    longitude: 13.4,
  };
}

describe('fetchAllPublicEvents', () => {
  beforeEach(() => {
    setAuthToken('tok');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('walks every page until the list is shorter than the page size', async () => {
    const page1 = Array.from({ length: 50 }, (_, i) => row(`e-${i}`));
    const page2 = [row('e-last')];
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('page=2')) return jsonOk({ data: page2, has_more: false });
      return jsonOk({ data: page1, has_more: true });
    });
    vi.stubGlobal('fetch', fetchMock);

    const events = await fetchAllPublicEvents();
    expect(events).toHaveLength(51);
    expect(events[0].id).toBe('e-0');
    expect(events[50].id).toBe('e-last');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

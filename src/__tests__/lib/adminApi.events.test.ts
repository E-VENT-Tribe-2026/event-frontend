import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchAdminEvents, fetchAdminEventDetails } from '@/lib/adminApi';
import * as authModule from '@/lib/auth';

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  const headers = new Headers(init.headers);
  headers.set('content-type', 'application/json');
  return new Response(JSON.stringify(body), { ...init, headers });
}

describe('adminApi events (ticket #249)', () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
    vi.spyOn(authModule, 'getAuthToken').mockReturnValue('mock_admin_token');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('asks for one page of one tab and sends the admin token without caching', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ items: [], total: 0, page: 2, limit: 20, total_pages: 2 })
    );

    const res = await fetchAdminEvents('cancelled', 2, 20);
    expect(res.page).toBe(2);

    const [url, init] = fetchMock.mock.calls[0];
    const parsed = new URL(String(url), 'http://localhost');
    expect(parsed.pathname).toBe('/api/admin/events');
    expect(parsed.searchParams.get('status_filter')).toBe('cancelled');
    expect(parsed.searchParams.get('page')).toBe('2');
    expect(parsed.searchParams.get('limit')).toBe('20');
    expect(parsed.searchParams.has('search')).toBe(false);
    expect(init?.cache).toBe('no-store');
    expect((init?.headers as Record<string, string>).Authorization).toBe('Bearer mock_admin_token');
  });

  it('sends the trimmed search text and leaves it out when blank', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ items: [], total: 0, page: 1, limit: 20, total_pages: 1 }));

    await fetchAdminEvents('all', 1, 20, '  Summit ');
    await fetchAdminEvents('all', 1, 20, '   ');

    const first = new URL(String(fetchMock.mock.calls[0][0]), 'http://localhost');
    const second = new URL(String(fetchMock.mock.calls[1][0]), 'http://localhost');
    expect(first.searchParams.get('search')).toBe('Summit');
    expect(second.searchParams.has('search')).toBe(false);
  });

  it('throws the backend message when the list request fails', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ detail: 'Forbidden' }, { status: 403 }));
    await expect(fetchAdminEvents('all')).rejects.toThrow('Forbidden');
  });

  it('loads one event by id (id is URL-encoded) without caching', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ id: 'e/1', title: 'Summit', start_datetime: '2026-11-20T09:00:00Z', status: 'active', organizer: null })
    );

    const res = await fetchAdminEventDetails('e/1');
    expect(res.title).toBe('Summit');

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain('/api/admin/events/e%2F1');
    expect(init?.cache).toBe('no-store');
  });

  it('throws on 404 so the page can show an error', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ detail: 'Event not found.' }, { status: 404 }));
    await expect(fetchAdminEventDetails('nope')).rejects.toThrow('Event not found.');
  });
});

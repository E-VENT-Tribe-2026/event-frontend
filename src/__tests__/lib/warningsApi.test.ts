import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AUTH_EXPIRED_EVENT } from '@/lib/auth';
import {
  WARNINGS_ENDPOINTS,
  WarningsApiError,
  acknowledgeWarning,
  fetchPendingWarnings,
  parsePendingWarnings,
} from '@/lib/warningsApi';

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

describe('parsePendingWarnings — backend contract (event-backend #191)', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => vi.restoreAllMocks());

  it('reads items and keeps the numeric id as a string', () => {
    const body = { items: [{ id: 7, created_at: '2026-10-01T10:00:00Z', reason: 'Spam', about: 'event' }] };
    expect(parsePendingWarnings(body)).toEqual([{ id: '7', reason: 'Spam' }]);
  });

  it('keeps the server order (oldest first)', () => {
    const body = { items: [{ id: 1, reason: 'Older' }, { id: 2, reason: 'Newer' }] };
    expect(parsePendingWarnings(body).map((w) => w.id)).toEqual(['1', '2']);
  });

  it('reads only items, nothing else', () => {
    expect(parsePendingWarnings([{ id: 1, reason: 'bare array' }])).toEqual([]);
    expect(parsePendingWarnings({ data: [{ id: 1, reason: 'A' }] })).toEqual([]);
    expect(parsePendingWarnings({ items: 'not a list' })).toEqual([]);
    expect(parsePendingWarnings(null)).toEqual([]);
  });

  it('drops rows without an id', () => {
    expect(parsePendingWarnings({ items: [{ reason: 'no id' }, null, { id: '  ', reason: 'blank' }] })).toEqual([]);
  });

  it('keeps a row without a reason (it must still be acknowledged) and logs it', () => {
    expect(parsePendingWarnings({ items: [{ id: 1 }] })).toEqual([{ id: '1', reason: '' }]);
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('without a reason'), '1');
  });

  it('keeps the reason as the raw string (no HTML handling)', () => {
    const [w] = parsePendingWarnings({ items: [{ id: 1, reason: '<b>bold</b>' }] });
    expect(w.reason).toBe('<b>bold</b>');
  });
});

describe('warnings requests', () => {
  const fetchMock = vi.fn<typeof fetch>();
  const onExpired = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    window.addEventListener(AUTH_EXPIRED_EVENT, onExpired);
  });

  afterEach(() => {
    window.removeEventListener(AUTH_EXPIRED_EVENT, onExpired);
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('loads pending warnings with the bearer token and without any caching', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ items: [{ id: 1, created_at: '2026-10-01T10:00:00Z', reason: 'Spam', about: 'event' }] }));
    const result = await fetchPendingWarnings('token-abc');
    expect(result).toEqual([{ id: '1', reason: 'Spam' }]);

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain('/api/warnings/pending');
    expect(init?.method ?? 'GET').toBe('GET');
    expect((init?.headers as Record<string, string>).Authorization).toBe('Bearer token-abc');
    expect(init?.cache).toBe('no-store');
  });

  it('passes the abort signal through', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ items: [] }));
    const controller = new AbortController();
    await fetchPendingWarnings('token-abc', controller.signal);
    expect(fetchMock.mock.calls[0][1]?.signal).toBe(controller.signal);
  });

  it('asks the server every time (no client cache)', async () => {
    fetchMock.mockImplementation(async () => jsonResponse({ items: [] }));
    await fetchPendingWarnings('token-abc');
    await fetchPendingWarnings('token-abc');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('rejects on 404 when loading (no longer means "no warnings")', async () => {
    fetchMock.mockResolvedValue(new Response('Not Found', { status: 404 }));
    await expect(fetchPendingWarnings('token-abc')).rejects.toMatchObject({ status: 404 });
    expect(onExpired).not.toHaveBeenCalled();
  });

  it('treats an invalid JSON body as no warnings and logs it', async () => {
    fetchMock.mockResolvedValue(new Response('not json', { status: 200 }));
    await expect(fetchPendingWarnings('token-abc')).resolves.toEqual([]);
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('not valid JSON'));
  });

  it('rejects with the status on other failures', async () => {
    fetchMock.mockResolvedValue(new Response('boom', { status: 500 }));
    const err = await fetchPendingWarnings('token-abc').catch((e) => e);
    expect(err).toBeInstanceOf(WarningsApiError);
    expect(err.status).toBe(500);
    expect(onExpired).not.toHaveBeenCalled();
  });

  it('rejects with status 0 when loading hits a network error', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
    const err = await fetchPendingWarnings('token-abc').catch((e) => e);
    expect(err).toBeInstanceOf(WarningsApiError);
    expect(err.status).toBe(0);
  });

  it('passes an aborted load through unchanged', async () => {
    const controller = new AbortController();
    controller.abort();
    fetchMock.mockRejectedValue(new DOMException('Aborted', 'AbortError'));
    const err = await fetchPendingWarnings('token-abc', controller.signal).catch((e) => e);
    expect(err).not.toBeInstanceOf(WarningsApiError);
    expect(err.name).toBe('AbortError');
  });

  it('does not report an abort during the body read as invalid JSON', async () => {
    const controller = new AbortController();
    const res = {
      ok: true,
      status: 200,
      json: () => {
        controller.abort();
        return Promise.reject(new DOMException('Aborted', 'AbortError'));
      },
    } as unknown as Response;
    fetchMock.mockResolvedValue(res);
    await expect(fetchPendingWarnings('token-abc', controller.signal)).rejects.toMatchObject({ name: 'AbortError' });
    expect(console.warn).not.toHaveBeenCalled();
  });

  it('fires the auth-expired event on 401 when loading', async () => {
    fetchMock.mockResolvedValue(new Response('', { status: 401 }));
    await expect(fetchPendingWarnings('token-abc')).rejects.toMatchObject({ status: 401 });
    expect(onExpired).toHaveBeenCalledTimes(1);
  });

  it('acknowledges a warning with POST and no caching', async () => {
    fetchMock.mockResolvedValue(jsonResponse({}, 200));
    await acknowledgeWarning('token-abc', '7');

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain('/api/warnings/7/acknowledge');
    expect(String(url)).toContain(WARNINGS_ENDPOINTS.ACKNOWLEDGE('7'));
    expect(init?.method).toBe('POST');
    expect(init?.cache).toBe('no-store');
    expect((init?.headers as Record<string, string>).Authorization).toBe('Bearer token-abc');
  });

  it('passes the abort signal through when acknowledging', async () => {
    fetchMock.mockResolvedValue(jsonResponse({}, 200));
    const controller = new AbortController();
    await acknowledgeWarning('token-abc', 'w1', controller.signal);
    expect(fetchMock.mock.calls[0][1]?.signal).toBe(controller.signal);
  });

  it('does not sign out for a 401 that arrives after the request was aborted', async () => {
    const controller = new AbortController();
    fetchMock.mockImplementation(async () => {
      controller.abort();
      return new Response('', { status: 401 });
    });
    await expect(acknowledgeWarning('token-abc', 'w1', controller.signal)).rejects.toMatchObject({ status: 401 });
    expect(onExpired).not.toHaveBeenCalled();
  });

  it('succeeds again when the same warning is acknowledged twice', async () => {
    fetchMock.mockImplementation(async () => jsonResponse({}, 200));
    await expect(acknowledgeWarning('token-abc', '7')).resolves.toBeUndefined();
    await expect(acknowledgeWarning('token-abc', '7')).resolves.toBeUndefined();
  });

  it('rejects on 404 (warning not found) so the user can retry', async () => {
    fetchMock.mockResolvedValue(new Response('', { status: 404 }));
    await expect(acknowledgeWarning('token-abc', 'w1')).rejects.toMatchObject({ status: 404 });
    expect(onExpired).not.toHaveBeenCalled();
  });

  it('fires the auth-expired event on 401 when acknowledging', async () => {
    fetchMock.mockResolvedValue(new Response('', { status: 401 }));
    await expect(acknowledgeWarning('token-abc', 'w1')).rejects.toMatchObject({ status: 401 });
    expect(onExpired).toHaveBeenCalledTimes(1);
  });

  it('rejects with status 0 on a network error', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
    await expect(acknowledgeWarning('token-abc', 'w1')).rejects.toMatchObject({ status: 0 });
  });
});

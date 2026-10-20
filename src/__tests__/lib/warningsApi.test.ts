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

describe('parsePendingWarnings — placeholder contract (#191)', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => vi.restoreAllMocks());

  it('reads a bare array', () => {
    expect(parsePendingWarnings([{ id: 'w1', reason: 'Spam', created_at: '2026-10-01T10:00:00Z' }])).toEqual([
      { id: 'w1', reason: 'Spam' },
    ]);
  });

  it('reads { data: [...] } and { warnings: [...] } envelopes', () => {
    expect(parsePendingWarnings({ data: [{ id: 1, reason: 'A' }] })).toEqual([{ id: '1', reason: 'A' }]);
    expect(parsePendingWarnings({ warnings: [{ id: 'w2', reason: 'B' }] })).toEqual([{ id: 'w2', reason: 'B' }]);
  });

  it('drops rows without an id and treats unknown shapes as no warnings', () => {
    expect(parsePendingWarnings([{ reason: 'no id' }, null, { id: '  ', reason: 'blank' }])).toEqual([]);
    expect(parsePendingWarnings({ unexpected: true })).toEqual([]);
    expect(parsePendingWarnings(null)).toEqual([]);
  });

  it('keeps a row without a reason (it must still be acknowledged) and logs it', () => {
    expect(parsePendingWarnings([{ id: 'w1' }])).toEqual([{ id: 'w1', reason: '' }]);
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('without a reason'), 'w1');
  });

  it('keeps the reason as the raw string (no HTML handling)', () => {
    const [w] = parsePendingWarnings([{ id: 'w1', reason: '<b>bold</b>' }]);
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
    fetchMock.mockResolvedValue(jsonResponse([{ id: 'w1', reason: 'Spam' }]));
    const result = await fetchPendingWarnings('token-abc');
    expect(result).toEqual([{ id: 'w1', reason: 'Spam' }]);

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain(WARNINGS_ENDPOINTS.PENDING);
    expect((init?.headers as Record<string, string>).Authorization).toBe('Bearer token-abc');
    expect(init?.cache).toBe('no-store');
  });

  it('passes the abort signal through', async () => {
    fetchMock.mockResolvedValue(jsonResponse([]));
    const controller = new AbortController();
    await fetchPendingWarnings('token-abc', controller.signal);
    expect(fetchMock.mock.calls[0][1]?.signal).toBe(controller.signal);
  });

  it('asks the server every time (no client cache)', async () => {
    fetchMock.mockImplementation(async () => jsonResponse([]));
    await fetchPendingWarnings('token-abc');
    await fetchPendingWarnings('token-abc');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('treats 404 (endpoint not shipped yet) as no warnings', async () => {
    fetchMock.mockResolvedValue(new Response('Not Found', { status: 404 }));
    await expect(fetchPendingWarnings('token-abc')).resolves.toEqual([]);
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
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
    await acknowledgeWarning('token-abc', 'w/1');

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain(WARNINGS_ENDPOINTS.ACKNOWLEDGE('w/1'));
    expect(String(url)).toContain('w%2F1');
    expect(init?.method).toBe('POST');
    expect(init?.cache).toBe('no-store');
    expect((init?.headers as Record<string, string>).Authorization).toBe('Bearer token-abc');
  });

  it('passes the abort signal through when acknowledging', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
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

  it.each([409, 410])('treats %i (no longer pending) as done', async (status) => {
    fetchMock.mockResolvedValue(new Response('', { status }));
    await expect(acknowledgeWarning('token-abc', 'w1')).resolves.toBeUndefined();
  });

  it('does not treat 404 as done (it could be a wrong route), so the user can retry', async () => {
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

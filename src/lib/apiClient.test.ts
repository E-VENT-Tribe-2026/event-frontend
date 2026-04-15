import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { apiClient } from './apiClient';

function jsonResponse(body: unknown, init: ResponseInit & { json?: boolean } = {}) {
  const headers = new Headers(init.headers);
  if (init.json !== false) headers.set('content-type', 'application/json');
  return new Response(JSON.stringify(body), { ...init, headers });
}

describe('apiClient', () => {
  const fetchMock = vi.fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('get returns parsed JSON on 200', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ hello: 'world' }));
    await expect(apiClient.get<{ hello: string }>('/api/x')).resolves.toEqual({ hello: 'world' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain('/api/x');
    expect(init?.method ?? 'GET').toBe('GET');
  });

  it('post sends JSON body', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true }));
    await apiClient.post('/api/y', { a: 1 });
    const [, init] = fetchMock.mock.calls[0];
    expect(init?.method).toBe('POST');
    expect(init?.headers).toMatchObject({ 'Content-Type': 'application/json' });
    expect(init?.body).toBe(JSON.stringify({ a: 1 }));
  });

  it('throws ApiError with detail from JSON error body', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ detail: 'Not found' }, { status: 404, statusText: 'Not Found' }),
    );
    await expect(apiClient.get('/missing')).rejects.toMatchObject({
      name: 'ApiError',
      message: 'Not found',
      status: 404,
    });
  });

  it('throws ApiError with text body when not JSON', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response('plain error', { status: 502, headers: { 'content-type': 'text/plain' } }),
    );
    await expect(apiClient.get('/bad')).rejects.toMatchObject({
      name: 'ApiError',
      message: 'plain error',
      status: 502,
    });
  });
});

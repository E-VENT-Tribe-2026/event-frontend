import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { setAuthToken } from '@/lib/auth';
import { ACCOUNT_REFUSED_EVENT, installAccountRefusalWatcher } from '@/lib/accountRefusal';

const ADMIN_DETAIL = 'Administrator accounts cannot perform user actions.';

function jsonResponse(body: unknown, status: number) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

function suspended(reason: string | null) {
  return jsonResponse({ detail: { code: 'account_suspended', message: 'Your account is suspended.', reason } }, 403);
}

/** Lets the background body read finish. */
async function settle() {
  for (let i = 0; i < 5; i += 1) await new Promise((r) => setTimeout(r, 0));
}

describe('account refusal watcher — ticket #294 Part 6', () => {
  const baseFetch = vi.fn<typeof fetch>();
  const onRefused = vi.fn();
  const listener = (e: Event) => onRefused((e as CustomEvent).detail);

  beforeEach(() => {
    baseFetch.mockReset();
    onRefused.mockReset();
    vi.stubGlobal('fetch', baseFetch);
    installAccountRefusalWatcher();
    window.addEventListener(ACCOUNT_REFUSED_EVENT, listener);
    setAuthToken('token-abc');
  });

  afterEach(() => {
    window.removeEventListener(ACCOUNT_REFUSED_EVENT, listener);
    vi.unstubAllGlobals();
  });

  it('fires the suspended event with the reason for the current session', async () => {
    baseFetch.mockResolvedValue(suspended('Spam in event chats.'));
    await fetch('/api/events', { headers: { Authorization: 'Bearer token-abc' } });
    await vi.waitFor(() => expect(onRefused).toHaveBeenCalledWith({ kind: 'suspended', reason: 'Spam in event chats.' }));
  });

  it('fires the suspended event with a null reason', async () => {
    baseFetch.mockResolvedValue(suspended(null));
    await fetch('/api/events', { headers: { Authorization: 'Bearer token-abc' } });
    await vi.waitFor(() => expect(onRefused).toHaveBeenCalledWith({ kind: 'suspended', reason: null }));
  });

  it('reads the token from a Headers instance', async () => {
    baseFetch.mockResolvedValue(suspended('Spam'));
    await fetch('/api/events', { headers: new Headers({ Authorization: 'Bearer token-abc' }) });
    await vi.waitFor(() => expect(onRefused).toHaveBeenCalledTimes(1));
  });

  it('reads the token from a Request input', async () => {
    baseFetch.mockResolvedValue(suspended('Spam'));
    await fetch(new Request('http://localhost/api/events', { headers: { Authorization: 'Bearer token-abc' } }));
    await vi.waitFor(() => expect(onRefused).toHaveBeenCalledTimes(1));
  });

  it('fires the administrator event for the exact administrator detail', async () => {
    baseFetch.mockResolvedValue(jsonResponse({ detail: ADMIN_DETAIL }, 403));
    await fetch('/api/friends', { headers: { Authorization: 'Bearer token-abc' } });
    await vi.waitFor(() => expect(onRefused).toHaveBeenCalledWith({ kind: 'administrator' }));
  });

  it('fires nothing for a different token', async () => {
    baseFetch.mockResolvedValue(suspended('Spam'));
    await fetch('/api/events', { headers: { Authorization: 'Bearer old-token' } });
    await settle();
    expect(onRefused).not.toHaveBeenCalled();
  });

  it('fires nothing for a request without an Authorization header (the sign-in request)', async () => {
    baseFetch.mockResolvedValue(suspended('Spam'));
    await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    await settle();
    expect(onRefused).not.toHaveBeenCalled();
  });

  it('fires nothing when the session changes before the body is read', async () => {
    baseFetch.mockResolvedValue(suspended('Spam'));
    await fetch('/api/events', { headers: { Authorization: 'Bearer token-abc' } });
    setAuthToken('token-new');
    await settle();
    expect(onRefused).not.toHaveBeenCalled();
  });

  it('fires nothing for any other 403, a 401 or a 200', async () => {
    const auth = { headers: { Authorization: 'Bearer token-abc' } };
    baseFetch.mockResolvedValueOnce(jsonResponse({ detail: 'Forbidden' }, 403));
    await fetch('/api/a', auth);
    baseFetch.mockResolvedValueOnce(jsonResponse({ detail: 'Administrator accounts cannot do this.' }, 403));
    await fetch('/api/b', auth);
    baseFetch.mockResolvedValueOnce(new Response('not json', { status: 403 }));
    await fetch('/api/c', auth);
    baseFetch.mockResolvedValueOnce(jsonResponse({ detail: { code: 'account_suspended', reason: 'x' } }, 401));
    await fetch('/api/d', auth);
    baseFetch.mockResolvedValueOnce(jsonResponse({ detail: { code: 'account_suspended', reason: 'x' } }, 200));
    await fetch('/api/e', auth);
    await settle();
    expect(onRefused).not.toHaveBeenCalled();
  });

  it('gives the caller the original response, body still readable', async () => {
    const original = suspended('Spam');
    baseFetch.mockResolvedValue(original);
    const res = await fetch('/api/events', { headers: { Authorization: 'Bearer token-abc' } });
    expect(res).toBe(original);
    await expect(res.json()).resolves.toEqual({
      detail: { code: 'account_suspended', message: 'Your account is suspended.', reason: 'Spam' },
    });
  });

  it('wraps fetch only once when installed twice', async () => {
    const wrapped = window.fetch;
    installAccountRefusalWatcher();
    expect(window.fetch).toBe(wrapped);

    baseFetch.mockResolvedValue(suspended('Spam'));
    await fetch('/api/events', { headers: { Authorization: 'Bearer token-abc' } });
    await settle();
    expect(baseFetch).toHaveBeenCalledTimes(1);
    expect(onRefused).toHaveBeenCalledTimes(1);
  });
});

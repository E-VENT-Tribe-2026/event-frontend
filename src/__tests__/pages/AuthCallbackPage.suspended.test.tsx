import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AuthCallbackPage from '@/pages/AuthCallbackPage';
import { ACCOUNT_REFUSED_EVENT } from '@/lib/accountRefusal';
import { clearAuthToken, getAuthToken } from '@/lib/auth';

const { mockNavigate, getSessionMock } = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
  getSessionMock: vi.fn(),
}));

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('@/lib/supabase', () => ({
  supabase: { auth: { getSession: getSessionMock, exchangeCodeForSession: vi.fn() } },
  syncSupabaseSession: vi.fn(() => Promise.resolve()),
  clearSupabaseSession: vi.fn(),
}));

const session = {
  access_token: 'google-token',
  user: { id: 'user-1', email: 'a@b.com', user_metadata: { full_name: 'Alex Smith' } },
};

function urlOf(input: RequestInfo | URL) {
  return typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
}

function jsonResponse(body: unknown, status: number) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

/** Mocks the backend; `authMe` decides what GET /api/auth/me answers. */
function mockBackend(authMe: () => Promise<Response>) {
  vi.mocked(fetch).mockImplementation(async (input: RequestInfo | URL) => {
    const url = urlOf(input);
    if (url.includes('/api/auth/me')) return authMe();
    if (url.includes('/api/auth/mfa/status')) return jsonResponse({ role: 'user', is_admin: false }, 200);
    if (url.includes('/api/profile/me')) return jsonResponse({ username: 'alex', full_name: 'Alex Smith' }, 200);
    return new Response('not mocked', { status: 500 });
  });
}

function calledUrls() {
  return vi.mocked(fetch).mock.calls.map(([input]) => urlOf(input as RequestInfo | URL));
}

function renderPage() {
  render(
    <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }} initialEntries={['/auth/callback']}>
      <AuthCallbackPage />
    </MemoryRouter>,
  );
}

describe('AuthCallbackPage — suspended Google account (ticket #294 Part 5)', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    getSessionMock.mockReset();
    getSessionMock.mockResolvedValue({ data: { session }, error: null });
    clearAuthToken();
    sessionStorage.clear();
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('checks /api/auth/me with the bearer token', async () => {
    mockBackend(async () => jsonResponse({ id: 'user-1', email: 'a@b.com' }, 200));
    renderPage();

    await waitFor(() => expect(mockNavigate).toHaveBeenCalled());
    const call = vi.mocked(fetch).mock.calls.find(([input]) => urlOf(input as RequestInfo | URL).includes('/api/auth/me'));
    expect((call?.[1]?.headers as Record<string, string>).Authorization).toBe('Bearer google-token');
  });

  it('keeps the session and announces suspension so the app can block them', async () => {
    const onRefused = vi.fn();
    const listener = (e: Event) => onRefused((e as CustomEvent).detail);
    window.addEventListener(ACCOUNT_REFUSED_EVENT, listener);
    mockBackend(async () => jsonResponse(
      { detail: { code: 'account_suspended', message: 'Your account is suspended.', reason: 'Spam' } },
      403,
    ));
    renderPage();

    await waitFor(() => {
      expect(onRefused).toHaveBeenCalledWith({ kind: 'suspended', reason: 'Spam' });
    });
    expect(mockNavigate).not.toHaveBeenCalled();
    expect(getAuthToken()).toBe('google-token');
    // It stops there: no admin check, no profile load.
    expect(calledUrls().some((u) => u.includes('/api/auth/mfa/status'))).toBe(false);
    expect(calledUrls().some((u) => u.includes('/api/profile/me'))).toBe(false);
    window.removeEventListener(ACCOUNT_REFUSED_EVENT, listener);
  });

  it('passes a null reason through', async () => {
    const onRefused = vi.fn();
    const listener = (e: Event) => onRefused((e as CustomEvent).detail);
    window.addEventListener(ACCOUNT_REFUSED_EVENT, listener);
    mockBackend(async () => jsonResponse(
      { detail: { code: 'account_suspended', message: 'Your account is suspended.', reason: null } },
      403,
    ));
    renderPage();

    await waitFor(() => {
      expect(onRefused).toHaveBeenCalledWith({ kind: 'suspended', reason: null });
    });
    expect(mockNavigate).not.toHaveBeenCalled();
    window.removeEventListener(ACCOUNT_REFUSED_EVENT, listener);
  });

  it('lets a user who is not suspended continue normally', async () => {
    mockBackend(async () => jsonResponse({ id: 'user-1', email: 'a@b.com' }, 200));
    renderPage();

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/home', { replace: true }));
    expect(getAuthToken()).toBe('google-token');
    expect(calledUrls().some((u) => u.includes('/api/profile/me'))).toBe(true);
  });

  it('continues normally on a 403 without the suspended code', async () => {
    mockBackend(async () => jsonResponse({ detail: 'Forbidden' }, 403));
    renderPage();

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/home', { replace: true }));
    expect(getAuthToken()).toBe('google-token');
  });

  it('continues normally when the check fails', async () => {
    mockBackend(async () => { throw new TypeError('Failed to fetch'); });
    renderPage();

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/home', { replace: true }));
    expect(getAuthToken()).toBe('google-token');
  });
});

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import LoginPage from '@/pages/LoginPage';
import { clearAuthToken, getAuthToken } from '@/lib/auth';

const { mockNavigate } = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
}));

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('@/lib/supabase', () => ({
  supabase: null,
  syncSupabaseSession: vi.fn(() => Promise.resolve()),
  clearSupabaseSession: vi.fn(),
}));

function jsonResponse(body: unknown, status: number) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

function suspendedResponse(reason: string | null) {
  return jsonResponse(
    { detail: { code: 'account_suspended', message: 'Your account is suspended.', reason } },
    403,
  );
}

function renderPage(state?: unknown) {
  render(
    <MemoryRouter
      future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      initialEntries={[{ pathname: '/login', state }]}
    >
      <Routes>
        <Route path="/login" element={<LoginPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

function signIn() {
  fireEvent.change(screen.getByPlaceholderText('Email'), { target: { value: 'a@b.com' } });
  fireEvent.change(screen.getByPlaceholderText('Password'), { target: { value: 'secret' } });
  fireEvent.click(screen.getByRole('button', { name: /sign in/i }));
}

describe('LoginPage — suspended account (ticket #294 Part 5)', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    clearAuthToken();
    sessionStorage.clear();
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response('{}', { status: 500 }))));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('shows a persistent notice with the reason, without signing in', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(suspendedResponse('Repeated spam in event chats.'));
    renderPage();
    signIn();

    const banner = await screen.findByRole('alert');
    expect(banner).toHaveTextContent('Your account is suspended.');
    expect(banner).toHaveTextContent('Repeated spam in event chats.');
    expect(mockNavigate).not.toHaveBeenCalled();
    expect(getAuthToken()).toBeNull();
  });

  it('shows only the heading when there is no reason', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(suspendedResponse(null));
    renderPage();
    signIn();

    const banner = await screen.findByRole('alert');
    expect(banner).toHaveTextContent(/^Your account is suspended\.$/);
    expect(banner.querySelectorAll('p')).toHaveLength(1);
  });

  it('never mentions contacting anyone', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(suspendedResponse('Spam'));
    renderPage();
    signIn();

    await screen.findByRole('alert');
    expect(document.body).not.toHaveTextContent(/contact/i);
  });

  it('shows the reason as plain text, never as HTML', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(suspendedResponse('<img src=x onerror="alert(1)"><b>bold</b>'));
    renderPage();
    signIn();

    const banner = await screen.findByRole('alert');
    expect(banner).toHaveTextContent('<img src=x onerror="alert(1)"><b>bold</b>');
    expect(banner.querySelector('img')).toBeNull();
    expect(banner.querySelector('b')).toBeNull();
  });

  it('hides the notice when the email is edited', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(suspendedResponse('Spam'));
    renderPage();
    signIn();
    await screen.findByRole('alert');

    fireEvent.change(screen.getByPlaceholderText('Email'), { target: { value: 'other@b.com' } });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('hides the notice when the password is edited', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(suspendedResponse('Spam'));
    renderPage();
    signIn();
    await screen.findByRole('alert');

    fireEvent.change(screen.getByPlaceholderText('Password'), { target: { value: 'secret2' } });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('hides the notice when the form is submitted again', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(suspendedResponse('Spam'))
      .mockResolvedValueOnce(jsonResponse({ detail: 'Invalid credentials' }, 401));
    renderPage();
    signIn();
    await screen.findByRole('alert');

    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(await screen.findByText('Invalid credentials')).toBeInTheDocument();
  });

  it('keeps the old message for a wrong password (401)', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ detail: 'Invalid credentials' }, 401));
    renderPage();
    signIn();

    expect(await screen.findByText('Invalid credentials')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByText('Your account is suspended.')).not.toBeInTheDocument();
  });

  it('keeps the old message for a 403 that is not a suspension', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ detail: 'Forbidden' }, 403));
    renderPage();
    signIn();

    expect(await screen.findByText('Forbidden')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('shows the notice when opened with a suspension in the router state', () => {
    renderPage({ suspension: { reason: 'Harassment in chat.' } });
    const banner = screen.getByRole('alert');
    expect(banner).toHaveTextContent('Your account is suspended.');
    expect(banner).toHaveTextContent('Harassment in chat.');
  });

  it('shows the notice without a reason from the router state', () => {
    renderPage({ suspension: { reason: null } });
    expect(screen.getByRole('alert')).toHaveTextContent(/^Your account is suspended\.$/);
  });

  it('shows no notice for other router state', () => {
    renderPage({ from: '/home' });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});

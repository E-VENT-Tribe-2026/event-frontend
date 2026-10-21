import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import ChooseUsernamePage, { rememberGoogleName } from '@/pages/ChooseUsernamePage';
import { setAuthToken, clearAuthToken } from '@/lib/auth';

const { mockNavigate } = vi.hoisted(() => ({ mockNavigate: vi.fn() }));

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => mockNavigate };
});

describe('ChooseUsernamePage', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    sessionStorage.clear();
    setAuthToken('tok');
  });

  afterEach(() => {
    clearAuthToken();
    vi.unstubAllGlobals();
  });

  function renderPage() {
    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }} initialEntries={['/choose-username']}>
        <Routes>
          <Route path="/choose-username" element={<ChooseUsernamePage />} />
        </Routes>
      </MemoryRouter>,
    );
  }

  it('prefills the saved name, shows both rules, and refuses an empty full name', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ username: null, full_name: 'Alex Smith' }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })));
    renderPage();
    expect(await screen.findByLabelText('Full name')).toHaveValue('Alex Smith');
    expect(screen.getByText(/3–20 characters/)).toBeInTheDocument();
    expect(screen.getByText(/3–50 characters/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Full name'), { target: { value: '   ' } });
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));
    expect(await screen.findByText('Full name is required')).toBeInTheDocument();
    expect(mockNavigate).not.toHaveBeenCalledWith('/home');
  });

  it('saves username and full name together, then continues', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes('/api/profile/me') && (!init || !init.method || init.method === 'GET')) {
        return new Response(JSON.stringify({ username: null, full_name: '' }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    });
    vi.stubGlobal('fetch', fetchMock);
    rememberGoogleName('Alex Smith');
    renderPage();
    expect(await screen.findByLabelText('Full name')).toHaveValue('Alex Smith');
    fireEvent.change(screen.getByLabelText('Username'), { target: { value: 'John_42' } });
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/home', { replace: true }));
    const writes = fetchMock.mock.calls.filter((call) => {
      const method = (call[1] as RequestInit | undefined)?.method;
      return Boolean(method && method !== 'GET');
    });
    expect(writes).toHaveLength(1);
    expect(String(writes[0][0])).toContain('/api/profile/choose-username');
    expect((writes[0][1] as RequestInit).method).toBe('POST');
    expect(JSON.parse(String((writes[0][1] as RequestInit).body))).toEqual({
      full_name: 'Alex Smith',
      username: 'john_42',
    });
  });

  it('skips the form when a wrapped profile already has a username', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ data: { username: 'alex', full_name: 'Alex Smith' } }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })),
    );
    renderPage();
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/home', { replace: true }));
  });

  it('still shows the form when GET /profile/me says setup is required', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(
        JSON.stringify({
          detail: 'Profile setup required: please choose a username and enter your full name.',
        }),
        { status: 403, headers: { 'content-type': 'application/json' } },
      )),
    );
    rememberGoogleName('Alex Smith');
    renderPage();
    expect(await screen.findByLabelText('Username')).toBeInTheDocument();
    expect(screen.getByLabelText('Full name')).toHaveValue('Alex Smith');
    expect(mockNavigate).not.toHaveBeenCalledWith('/home', { replace: true });
  });
});
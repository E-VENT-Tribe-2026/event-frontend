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

  it('saves the full name and a lowercased username, then continues', async () => {
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
    const bodies = fetchMock.mock.calls
      .filter((call) => (call[1] as RequestInit | undefined)?.body)
      .map((call) => JSON.parse(String((call[1] as RequestInit).body)));
    expect(bodies).toEqual(expect.arrayContaining([
      { full_name: 'Alex Smith' },
      { username: 'john_42' },
    ]));
  });
});

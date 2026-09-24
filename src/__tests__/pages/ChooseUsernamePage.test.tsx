import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import ChooseUsernamePage from '@/pages/ChooseUsernamePage';
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
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response('{}', { status: 500 }))));
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

  it('shows both rules and refuses an empty full name', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ username: null, full_name: 'Alex Smith' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    renderPage();
    expect(await screen.findByText(/3–20 characters/)).toBeInTheDocument();
    expect(screen.getByText(/3–50 characters/)).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Full Name')).toHaveValue('Alex Smith');
    fireEvent.change(screen.getByPlaceholderText('Full Name'), { target: { value: '   ' } });
    fireEvent.change(screen.getByPlaceholderText('Username'), { target: { value: 'alex' } });
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));
    expect(await screen.findByText('Full name is required')).toBeInTheDocument();
    expect(mockNavigate).not.toHaveBeenCalledWith('/home');
  });

  it('saves the full name and a lowercased username, then continues', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes('/api/profile/me') && (!init || init.method === undefined)) {
        return new Response(JSON.stringify({ username: null, full_name: '' }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({ id: 'u1' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    });
    sessionStorage.setItem('eventapp:google-name', 'Google Name');
    renderPage();
    expect(await screen.findByDisplayValue('Google Name')).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText('Username'), { target: { value: 'John_42' } });
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/home', { replace: true }));
    const bodies = fetchMock.mock.calls
      .filter((call) => (call[1] as RequestInit | undefined)?.body)
      .map((call) => JSON.parse(String((call[1] as RequestInit).body)));
    expect(bodies).toEqual(expect.arrayContaining([
      { full_name: 'Google Name' },
      { username: 'john_42' },
    ]));
  });
});

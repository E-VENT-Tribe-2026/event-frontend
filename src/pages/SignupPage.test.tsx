import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import SignupPage from './SignupPage';
import { clearAuthToken } from '@/lib/auth';

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
}));

describe('SignupPage', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    clearAuthToken();
    sessionStorage.clear();
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(new Response('{}', { status: 500 }))),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function renderPage() {
    render(
      <MemoryRouter
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
        initialEntries={['/signup']}
      >
        <Routes>
          <Route path="/signup" element={<SignupPage />} />
        </Routes>
      </MemoryRouter>,
    );
  }

  it('shows validation messages when submitting empty form', async () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /create account/i }));
    expect(await screen.findByText('Name is required')).toBeInTheDocument();
    expect(screen.getByText('Email is required')).toBeInTheDocument();
    expect(screen.getByText('Password is required')).toBeInTheDocument();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('shows conflict message when server returns 409', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ message: 'User exists' }), {
        status: 409,
        headers: { 'content-type': 'application/json' },
      }),
    );

    renderPage();
    fireEvent.change(screen.getByPlaceholderText('Full Name'), { target: { value: 'Alex' } });
    fireEvent.change(screen.getByPlaceholderText('Email'), { target: { value: 'alex@example.com' } });
    fireEvent.change(screen.getByPlaceholderText('Password'), { target: { value: 'secret1' } });
    fireEvent.change(screen.getByPlaceholderText('Confirm Password'), { target: { value: 'secret1' } });
    const dobInput = document.querySelector('input[type="date"]') as HTMLInputElement;
    fireEvent.change(dobInput, { target: { value: '2000-01-15' } });
    const genderSelect = screen.getByRole('combobox');
    fireEvent.change(genderSelect, { target: { value: 'Male' } });

    fireEvent.click(screen.getByRole('button', { name: /^create account$/i }));

    expect(await screen.findByText('An account with this email already exists.')).toBeInTheDocument();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('registers and navigates home when API returns tokens and profile loads', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      if (url.includes('/api/auth/register')) {
        return new Response(
          JSON.stringify({ access_token: 'tok', refresh_token: 'ref' }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        );
      }
      if (url.includes('/api/auth/me')) {
        return new Response(JSON.stringify({ id: 'new-user', email: 'alex@example.com' }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }
      return new Response('not mocked', { status: 500 });
    });

    renderPage();
    fireEvent.change(screen.getByPlaceholderText('Full Name'), { target: { value: 'Alex' } });
    fireEvent.change(screen.getByPlaceholderText('Email'), { target: { value: 'alex@example.com' } });
    fireEvent.change(screen.getByPlaceholderText('Password'), { target: { value: 'secret1' } });
    fireEvent.change(screen.getByPlaceholderText('Confirm Password'), { target: { value: 'secret1' } });
    const dobInput = document.querySelector('input[type="date"]') as HTMLInputElement;
    fireEvent.change(dobInput, { target: { value: '2000-01-15' } });
    const genderSelect = screen.getByRole('combobox');
    fireEvent.change(genderSelect, { target: { value: 'Female' } });

    fireEvent.click(screen.getByRole('button', { name: /^create account$/i }));

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/home');
    });
  });
});

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import SignupPage from '@/pages/SignupPage';
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
  syncSupabaseSession: vi.fn(() => Promise.resolve()),
  clearSupabaseSession: vi.fn(),
}));

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('SignupPage', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    clearAuthToken();
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

  async function unlockSignup() {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ valid: true, email: 'alex@example.com' }));
    renderPage();
    fireEvent.change(screen.getByPlaceholderText('Email'), { target: { value: 'alex@example.com' } });
    fireEvent.change(screen.getByPlaceholderText('Invitation code'), { target: { value: 'ABCD-2345' } });
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));
    await screen.findByPlaceholderText('Username');
  }

  it('does not show the registration form until email and code are verified', () => {
    renderPage();
    expect(screen.getByPlaceholderText('Email')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Invitation code')).toBeInTheDocument();
    expect(screen.queryByPlaceholderText('Username')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /create account/i })).not.toBeInTheDocument();
  });

  it('keeps the form locked when the code is rejected', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ valid: false }));
    renderPage();
    fireEvent.change(screen.getByPlaceholderText('Email'), { target: { value: 'alex@example.com' } });
    fireEvent.change(screen.getByPlaceholderText('Invitation code'), { target: { value: 'ZZZZ-9999' } });
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));
    expect(await screen.findByText('This invitation is not valid or has expired.')).toBeInTheDocument();
    expect(screen.queryByPlaceholderText('Username')).not.toBeInTheDocument();
  });

  it('locks the invited email after a valid code', async () => {
    await unlockSignup();
    const emailInput = screen.getByPlaceholderText('Email') as HTMLInputElement;
    expect(emailInput).toHaveAttribute('readonly');
    expect(emailInput.value).toBe('alex@example.com');
    fireEvent.change(emailInput, { target: { value: 'other@example.com' } });
    expect(emailInput.value).toBe('alex@example.com');
  });

  it('shows validation messages when submitting empty form', async () => {
    await unlockSignup();
    fireEvent.click(screen.getByRole('button', { name: /create account/i }));
    expect(await screen.findByText('Username is required')).toBeInTheDocument();
    expect(screen.getByText('Password is required')).toBeInTheDocument();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('shows conflict message when server returns 409', async () => {
    await unlockSignup();
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse({ message: 'Email already exists' }, 409),
    );

    fireEvent.change(screen.getByPlaceholderText('Username'), {
      target: { value: 'alex_user' },
    });
    fireEvent.change(screen.getByPlaceholderText('Full name'), { target: { value: 'Alex' } });
    fireEvent.change(screen.getByPlaceholderText('Password'), { target: { value: 'Secret1!' } });
    fireEvent.change(screen.getByPlaceholderText('Confirm Password'), { target: { value: 'Secret1!' } });
    const dobInput = screen.getByLabelText(/birthdate/i) as HTMLInputElement;
    fireEvent.focus(dobInput);
    fireEvent.change(dobInput, { target: { value: '2000-01-15' } });
    const genderSelect = screen.getByRole('combobox');
    fireEvent.change(genderSelect, { target: { value: 'Male' } });

    fireEvent.click(screen.getByRole('button', { name: /^create account$/i }));

    expect(await screen.findByText('This email address is already in use.', { selector: 'div.fixed' })).toBeInTheDocument();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('registers with the verified email and invite_code', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      if (url.includes('/api/auth/verify-invite')) {
        return jsonResponse({ valid: true, email: 'alex@example.com' });
      }
      if (url.includes('/api/auth/register')) {
        const body = JSON.parse(String(init?.body ?? '{}')) as { invite_code?: string; email?: string };
        expect(body.email).toBe('alex@example.com');
        expect(body.invite_code).toBe('ABCD-2345');
        return jsonResponse({ access_token: 'tok', refresh_token: 'ref' });
      }
      if (url.includes('/api/auth/me')) {
        return jsonResponse({ id: 'new-user', email: 'alex@example.com' });
      }
      return new Response('not mocked', { status: 500 });
    });

    renderPage();
    fireEvent.change(screen.getByPlaceholderText('Email'), { target: { value: 'alex@example.com' } });
    fireEvent.change(screen.getByPlaceholderText('Invitation code'), { target: { value: 'ABCD-2345' } });
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));
    await screen.findByPlaceholderText('Username');

    fireEvent.change(screen.getByPlaceholderText('Username'), {
      target: { value: 'alex_user' },
    });
    fireEvent.change(screen.getByPlaceholderText('Full name'), { target: { value: 'Alex' } });
    fireEvent.change(screen.getByPlaceholderText('Password'), { target: { value: 'Secret1!' } });
    fireEvent.change(screen.getByPlaceholderText('Confirm Password'), { target: { value: 'Secret1!' } });
    const dobInput = screen.getByLabelText(/birthdate/i) as HTMLInputElement;
    fireEvent.focus(dobInput);
    fireEvent.change(dobInput, { target: { value: '2000-01-15' } });
    const genderSelect = screen.getByRole('combobox');
    fireEvent.change(genderSelect, { target: { value: 'Female' } });

    fireEvent.click(screen.getByRole('button', { name: /^create account$/i }));

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/home');
    });
  });
});

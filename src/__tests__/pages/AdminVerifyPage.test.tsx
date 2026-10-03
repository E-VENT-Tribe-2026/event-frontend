import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AdminVerifyPage from '@/pages/AdminVerifyPage';
import { setPendingAdminVerification, getPendingAdminVerification } from '@/lib/adminAuth';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock('@/lib/supabase', () => ({ supabase: null }));

function renderPage() {
  render(
    <MemoryRouter>
      <AdminVerifyPage />
    </MemoryRouter>,
  );
}

describe('AdminVerifyPage', () => {
  const fetchMock = vi.fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>();

  beforeEach(() => {
    mockNavigate.mockReset();
    sessionStorage.clear();
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => vi.unstubAllGlobals());

  it('redirects to /login when there is nothing pending', () => {
    renderPage();
    expect(mockNavigate).toHaveBeenCalledWith('/login', { replace: true });
  });

  it('Scenario B — fetches and shows the QR code when no app is linked yet', async () => {
    setPendingAdminVerification({ accessToken: 'aal1-token', hasMfaLinked: false });
    fetchMock.mockImplementation(async (input) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : (input as Request).url;
      if (url.includes('/api/auth/mfa/enroll')) {
        return new Response(
          JSON.stringify({
            factor_id: '018f3a5e-...',
            totp: { qr_code: 'data:image/svg+xml;utf-8,<svg></svg>', secret: 'JBSWY3DPEHPK3PXP', uri: 'otpauth://...' },
          }),
          { status: 200 },
        );
      }
      return new Response('{}', { status: 500 });
    });

    renderPage();
    expect(await screen.findByAltText(/scan this qr code/i)).toBeInTheDocument();
    expect(screen.getByText('JBSWY3DPEHPK3PXP')).toBeInTheDocument();
  });

  it('Scenario C — asks directly for the code when an app is already linked (no enroll call)', () => {
    setPendingAdminVerification({ accessToken: 'aal1-token-2', hasMfaLinked: true, factorId: 'f1' });
    renderPage();
    expect(screen.queryByAltText(/scan this qr code/i)).not.toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByPlaceholderText('6-digit code')).toBeInTheDocument();
  });

  it('Scenario D — shows the refusal reason for a wrong code and does not navigate away', async () => {
    setPendingAdminVerification({ accessToken: 'aal1-token-2', hasMfaLinked: true, factorId: 'f1' });
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ detail: 'Invalid verification code. Please check your authenticator app and try again.' }),
        { status: 400 },
      ),
    );

    renderPage();
    fireEvent.change(screen.getByPlaceholderText('6-digit code'), { target: { value: '000000' } });
    fireEvent.click(screen.getByRole('button', { name: /verify and continue/i }));

    expect(await screen.findByText(/invalid verification code/i)).toBeInTheDocument();
    expect(mockNavigate).not.toHaveBeenCalled();
    // Still pending — the admin has not been let into the app.
    expect(getPendingAdminVerification()).not.toBeNull();
  });

  it('Scenario C step 2 — a correct code clears pending state and continues sign-in', async () => {
    setPendingAdminVerification({ accessToken: 'aal1-token-2', hasMfaLinked: true, factorId: 'f1' });
    fetchMock.mockImplementation(async (input) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : (input as Request).url;
      if (url.includes('/api/auth/mfa/verify')) {
        return new Response(JSON.stringify({ access_token: 'aal2-token', is_verified: true }), { status: 200 });
      }
      if (url.includes('/api/auth/me')) {
        return new Response(JSON.stringify({ id: 'admin-1', email: 'admin@example.com' }), { status: 200 });
      }
      if (url.includes('/api/profile/me')) {
        return new Response(JSON.stringify({ username: 'admin_1', full_name: 'Admin One' }), { status: 200 });
      }
      return new Response('{}', { status: 500 });
    });

    renderPage();
    fireEvent.change(screen.getByPlaceholderText('6-digit code'), { target: { value: '654321' } });
    fireEvent.click(screen.getByRole('button', { name: /verify and continue/i }));

    await waitFor(() => {
      // Per the ticket's AC: reaches the normal post-sign-in screen, not a special admin route.
      expect(mockNavigate).toHaveBeenCalledWith('/home', { replace: true });
    });
    expect(getPendingAdminVerification()).toBeNull();
  });

  it('"Back to Sign In" clears pending state and returns to /login', () => {
    setPendingAdminVerification({ accessToken: 'aal1-token-2', hasMfaLinked: true, factorId: 'f1' });
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /back to sign in/i }));
    expect(getPendingAdminVerification()).toBeNull();
    expect(mockNavigate).toHaveBeenCalledWith('/login', { replace: true });
  });
});

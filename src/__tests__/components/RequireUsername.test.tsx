import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import RequireUsername from '@/components/RequireUsername';
import { setAuthToken, clearAuthToken } from '@/lib/auth';
import { setPendingAdminVerification, clearPendingAdminVerification } from '@/lib/adminAuth';

function renderGuarded(initialPath = '/home') {
  render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/admin-verify" element={<div>Admin Verify Screen</div>} />
        <Route path="/choose-username" element={<div>Choose Username Screen</div>} />
        <Route
          path="/home"
          element={
            <RequireUsername>
              <div>Protected Home Screen</div>
            </RequireUsername>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe('RequireUsername — ticket #247 admin-verification gate', () => {
  const fetchMock = vi.fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
    clearAuthToken();
    clearPendingAdminVerification();
  });

  afterEach(() => vi.unstubAllGlobals());

  it('passes through when there is no token at all (pre-existing behavior, unaffected)', () => {
    renderGuarded();
    expect(screen.getByText('Protected Home Screen')).toBeInTheDocument();
  });

  it('redirects to /admin-verify when an admin verification is pending, before checking anything else', async () => {
    setAuthToken('aal1-token');
    setPendingAdminVerification({ accessToken: 'aal1-token', hasMfaLinked: true, factorId: 'f1' });
    // Deliberately no /api/profile/me mock — if the code reached that check first, this would hang/fail.
    renderGuarded();
    expect(await screen.findByText('Admin Verify Screen')).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('still falls through to the username check once verification is no longer pending', async () => {
    setAuthToken('verified-token');
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ username: 'alex' }), { status: 200 }),
    );
    renderGuarded();
    await waitFor(() => {
      expect(screen.getByText('Protected Home Screen')).toBeInTheDocument();
    });
  });
});

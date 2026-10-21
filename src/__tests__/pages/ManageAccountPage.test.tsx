import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import ManageAccountPage from '@/pages/ManageAccountPage';
import type { User } from '@/lib/storage';
import { clearAuthToken, setAuthToken } from '@/lib/auth';

const { getCurrentUserMock, updateUserMock } = vi.hoisted(() => ({
  getCurrentUserMock: vi.fn<[], User | null>(),
  updateUserMock: vi.fn(),
}));

vi.mock('@/lib/storage', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@/lib/storage')>();
  return {
    ...mod,
    getCurrentUser: () => getCurrentUserMock(),
    updateUser: updateUserMock,
  };
});

vi.mock('@/components/BottomNav', () => ({ default: () => null }));
vi.mock('@/components/TopBar', () => ({ default: () => null }));

const basicUser = {
  id: 'u1',
  role: 'participant',
  name: 'Sonia',
  username: 'sonia',
  email: 'sonia@test.com',
  password: '',
  avatar: '',
  profilePhoto: '',
  coverPhoto: '',
  interests: [],
  dob: '',
  gender: '',
  isPremium: false,
  friends: [],
  createdAt: '2026-01-15T00:00:00.000Z',
} as User;

function renderPage() {
  render(
    <MemoryRouter initialEntries={['/account']}>
      <Routes>
        <Route path="/account" element={<ManageAccountPage />} />
        <Route path="/premium" element={<div>Pro upgrade</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('ManageAccountPage', () => {
  beforeEach(() => {
    getCurrentUserMock.mockReturnValue(basicUser);
    updateUserMock.mockReset();
    updateUserMock.mockImplementation(() => {
      getCurrentUserMock.mockReturnValue(basicUser);
    });
  });

  afterEach(() => {
    clearAuthToken();
    vi.unstubAllGlobals();
  });

  it('shows the Basic plan and a Pro upgrade for the base account', () => {
    renderPage();
    expect(screen.getByRole('heading', { name: 'Manage account' })).toBeInTheDocument();
    expect(screen.getAllByTestId('plan-badge')[0]).toHaveTextContent('Basic');
    expect(screen.getByText('sonia@test.com')).toBeInTheDocument();
    expect(screen.getAllByText('@sonia').length).toBeGreaterThan(0);
    expect(screen.getByText('See what your friends are up to')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Upgrade to Pro · €5\/mo/i })).toHaveAttribute('href', '/premium');
    expect(screen.getByTestId('account-email')).toHaveTextContent('sonia@test.com');
    expect(screen.getByTestId('account-username')).toHaveTextContent('@sonia');
  });

  it('shows the signed-in email and username from the profile APIs', async () => {
    setAuthToken('tok');
    getCurrentUserMock.mockReturnValue({ ...basicUser, email: '', username: '' });
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('/api/auth/me')) {
          return new Response(JSON.stringify({ id: 'u1', email: 'real@event.app' }), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          });
        }
        if (url.includes('/api/profile/me')) {
          return new Response(JSON.stringify({ id: 'u1', username: 'real_sonia', email: 'real@event.app' }), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          });
        }
        return new Response('{}', { status: 404 });
      }),
    );

    renderPage();
    expect(await screen.findByTestId('account-email')).toHaveTextContent('real@event.app');
    expect(screen.getByTestId('account-username')).toHaveTextContent('@real_sonia');
    await waitFor(() => {
      expect(updateUserMock).toHaveBeenCalledWith({
        email: 'real@event.app',
        username: 'real_sonia',
      });
    });
  });

  it('shows Pro without an upgrade CTA after the account is upgraded', () => {
    getCurrentUserMock.mockReturnValue({ ...basicUser, isPremium: true });
    renderPage();
    expect(screen.getAllByTestId('plan-badge')[0]).toHaveTextContent('Pro');
    expect(screen.queryByRole('link', { name: /Upgrade to Pro/i })).not.toBeInTheDocument();
    expect(screen.getByText(/Thanks for being on Pro/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel subscription' })).toBeInTheDocument();
  });

  it('cancels Pro and returns the account to Basic after confirm', () => {
    getCurrentUserMock.mockReturnValue({ ...basicUser, isPremium: true });
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel subscription' }));
    expect(screen.getByRole('heading', { name: 'Cancel subscription?' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Switch to Basic' }));
    expect(updateUserMock).toHaveBeenCalledWith({ isPremium: false });
    expect(screen.getAllByTestId('plan-badge')[0]).toHaveTextContent('Basic');
    expect(screen.getByRole('link', { name: /Upgrade to Pro/i })).toBeInTheDocument();
    expect(screen.getByText(/You are back on Basic/i)).toBeInTheDocument();
  });

  it('keeps Pro if the cancel dialog is dismissed', () => {
    getCurrentUserMock.mockReturnValue({ ...basicUser, isPremium: true });
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel subscription' }));
    fireEvent.click(screen.getByRole('button', { name: 'Keep Pro' }));
    expect(updateUserMock).not.toHaveBeenCalledWith({ isPremium: false });
    expect(screen.getAllByTestId('plan-badge')[0]).toHaveTextContent('Pro');
  });
});

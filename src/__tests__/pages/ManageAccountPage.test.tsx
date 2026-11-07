import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import ManageAccountPage from '@/pages/ManageAccountPage';
import type { User } from '@/lib/storage';
import { clearAuthToken, setAuthToken } from '@/lib/auth';
import { readNotificationPrefs } from '@/lib/accountSettings';

const { getCurrentUserMock, updateUserMock, fetchBlockedUsersMock, unblockUserMock } = vi.hoisted(() => ({
  getCurrentUserMock: vi.fn<[], User | null>(),
  updateUserMock: vi.fn(),
  fetchBlockedUsersMock: vi.fn(),
  unblockUserMock: vi.fn(),
}));

vi.mock('@/lib/storage', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@/lib/storage')>();
  return {
    ...mod,
    getCurrentUser: () => getCurrentUserMock(),
    updateUser: updateUserMock,
  };
});

vi.mock('@/lib/friendsApi', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@/lib/friendsApi')>();
  return {
    ...mod,
    fetchBlockedUsers: (...args: unknown[]) => fetchBlockedUsersMock(...args),
    unblockUser: (...args: unknown[]) => unblockUserMock(...args),
  };
});

vi.mock('@/components/BottomNav', () => ({ default: () => null }));
vi.mock('@/components/TopBar', () => ({ default: () => null }));
vi.mock('@/components/LocationSearchInput', () => ({
  default: ({
    value,
    onChange,
    onSelect,
  }: {
    value: string;
    onChange: (v: string) => void;
    onSelect: (r: { lat: number; lng: number; displayName: string }) => void;
  }) => (
    <div>
      <input aria-label="Home city search" value={value} onChange={(e) => onChange(e.target.value)} />
      <button type="button" onClick={() => onSelect({ lat: 52.52, lng: 13.405, displayName: 'Berlin, Germany' })}>
        Pick Berlin
      </button>
    </div>
  ),
}));

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
      </Routes>
    </MemoryRouter>,
  );
}

describe('ManageAccountPage', () => {
  beforeEach(() => {
    window.localStorage.clear();
    getCurrentUserMock.mockReturnValue(basicUser);
    updateUserMock.mockReset();
    updateUserMock.mockImplementation(() => {
      getCurrentUserMock.mockReturnValue(basicUser);
    });
    fetchBlockedUsersMock.mockReset();
    fetchBlockedUsersMock.mockResolvedValue({ page: 1, limit: 50, has_more: false, data: [] });
    unblockUserMock.mockReset();
    unblockUserMock.mockResolvedValue(undefined);
  });

  afterEach(() => {
    clearAuthToken();
    vi.unstubAllGlobals();
    window.localStorage.clear();
  });

  it('shows the signed-in name, email and username', () => {
    renderPage();
    expect(screen.getByRole('heading', { name: 'Manage account' })).toBeInTheDocument();
    expect(screen.getByText('Sonia')).toBeInTheDocument();
    expect(screen.getByText('sonia@test.com')).toBeInTheDocument();
    expect(screen.getAllByText('@sonia').length).toBeGreaterThan(0);
    expect(screen.getByTestId('account-email')).toHaveTextContent('sonia@test.com');
    expect(screen.getByTestId('account-username')).toHaveTextContent('@sonia');
    expect(screen.queryByRole('link', { name: /Upgrade to Pro/i })).not.toBeInTheDocument();
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

  it('renders sign-in, blocked, notifications, home city and danger zone', async () => {
    renderPage();
    expect(await screen.findByTestId('account-signin')).toBeInTheDocument();
    expect(screen.getByTestId('account-blocked')).toBeInTheDocument();
    expect(screen.getByTestId('account-notifications')).toBeInTheDocument();
    expect(screen.getByTestId('account-home-city')).toBeInTheDocument();
    expect(screen.getByTestId('account-danger')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Change password' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Update password' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Log out of this device' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete account' })).toBeInTheDocument();
  });

  it('unblocks someone from the blocked list', async () => {
    fetchBlockedUsersMock.mockResolvedValue({
      page: 1,
      limit: 50,
      has_more: false,
      data: [{
        blocked_at: '2026-01-01T00:00:00.000Z',
        user: {
          id: 'blocked-1',
          username: 'nox',
          full_name: 'Nox',
          display_name: 'Nox',
          avatar_kind: null,
          icon_id: null,
          avatar_url: null,
        },
      }],
    });
    renderPage();
    expect(await screen.findByText('Nox')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Unblock Nox' }));
    await waitFor(() => expect(unblockUserMock).toHaveBeenCalledWith('blocked-1'));
    await waitFor(() => expect(screen.queryByText('Nox')).not.toBeInTheDocument());
  });

  it('saves a notification preference', async () => {
    renderPage();
    const invitations = await screen.findByRole('switch', { name: 'Invitations' });
    fireEvent.click(invitations);
    await waitFor(() => {
      expect(readNotificationPrefs('u1').invitations).toBe(false);
    });
  });

  it('requires typing the username before delete is enabled', async () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Delete account' }));
    const confirm = await screen.findByRole('button', { name: 'Delete forever' });
    expect(confirm).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Type to confirm account deletion'), { target: { value: 'sonia' } });
    expect(confirm).not.toBeDisabled();
  });

  it('posts a password change', async () => {
    setAuthToken('tok');
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes('/api/auth/reset-password') && init?.method === 'POST') {
        return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'content-type': 'application/json' } });
      }
      if (url.includes('/api/auth/me')) {
        return new Response(JSON.stringify({ id: 'u1', email: 'sonia@test.com', app_metadata: { provider: 'email' } }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }
      if (url.includes('/api/profile/me')) {
        return new Response(JSON.stringify({ id: 'u1', username: 'sonia', email: 'sonia@test.com' }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }
      return new Response('{}', { status: 404 });
    });
    vi.stubGlobal('fetch', fetchMock);
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Change password' }));
    fireEvent.change(screen.getByLabelText('Current password'), { target: { value: 'oldpass12' } });
    fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'newpass12' } });
    fireEvent.change(screen.getByLabelText('Confirm new password'), { target: { value: 'newpass12' } });
    fireEvent.click(screen.getByRole('button', { name: 'Update password' }));
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/api/auth/reset-password'),
        expect.objectContaining({ method: 'POST' }),
      );
    });
  });
});

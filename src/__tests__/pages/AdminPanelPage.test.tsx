import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import AdminPanelPage from '@/pages/AdminPanelPage';
import BottomNav from '@/components/BottomNav';
import AdminGuard from '@/components/AdminGuard';
import * as adminApi from '@/lib/adminApi';
import * as authModule from '@/lib/auth';

const mockUsers: adminApi.AdminUserSummary[] = [
  {
    id: 'user-1',
    username: 'alex_smith',
    full_name: 'Alex Smith',
    role: 'user',
    created_at: '2026-03-15T10:30:00Z',
  },
  {
    id: 'user-2',
    username: null, // Account without username
    full_name: 'Jordan Doe',
    role: 'user',
    created_at: '2026-04-01T12:00:00Z',
  },
  {
    id: 'user-3',
    username: 'super_admin',
    full_name: 'Sarah Connor',
    role: 'administrator',
    created_at: '2026-01-01T00:00:00Z',
  },
];

const mockUserDetailsAlex: adminApi.AdminUserDetails = {
  id: 'user-1',
  username: 'alex_smith',
  full_name: 'Alex Smith',
  created_at: '2026-03-15T10:30:00Z',
  is_admin: false,
  role: 'user',
  organized_events: {
    upcoming: [{ id: 'e1', title: 'Future Workshop', date: '2026-12-01T10:00:00Z', status: 'active' }],
    past: [{ id: 'e2', title: 'Past Meetup', date: '2026-01-10T18:00:00Z', status: 'active' }],
    cancelled: [{ id: 'e3', title: 'Cancelled Hackathon', date: '2026-08-15T09:00:00Z', status: 'cancelled', is_cancelled: true }],
  },
  joined_events: {
    upcoming: [],
    past: [],
    cancelled: [],
  },
};

const mockUserDetailsSarah: adminApi.AdminUserDetails = {
  id: 'user-3',
  username: 'super_admin',
  full_name: 'Sarah Connor',
  created_at: '2026-01-01T00:00:00Z',
  is_admin: true,
  role: 'administrator',
  organized_events: {
    upcoming: [],
    past: [],
    cancelled: [],
  },
  joined_events: {
    upcoming: [],
    past: [],
    cancelled: [],
  },
};

describe('Admin Panel — Ticket #248', () => {
  beforeEach(() => {
    vi.spyOn(authModule, 'getAuthToken').mockReturnValue('mock_token');
    vi.spyOn(adminApi, 'checkAdminVerified').mockResolvedValue({
      isVerifiedAdmin: true,
      role: 'administrator',
    });
    vi.spyOn(adminApi, 'fetchAdminCounts').mockResolvedValue({
      total_users: 150,
      events: { total: 42, upcoming: 18, past: 20, cancelled: 4 },
    });
    vi.spyOn(adminApi, 'fetchAdminUsers').mockResolvedValue({
      items: mockUsers,
      total: 3,
      page: 1,
      limit: 20,
      total_pages: 1,
    });
    vi.spyOn(adminApi, 'fetchAdminUserDetails').mockImplementation(async (userId) => {
      if (userId === 'user-3') return mockUserDetailsSarah;
      return mockUserDetailsAlex;
    });
    vi.spyOn(adminApi, 'grantAdminRole').mockResolvedValue({
      message: 'Administrator role granted successfully.',
      user_id: 'user-1',
      role: 'administrator',
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders total registered users count and lists users', async () => {
    render(
      <MemoryRouter initialEntries={['/admin']}>
        <AdminPanelPage />
      </MemoryRouter>
    );

    // Check count
    expect(await screen.findByText('150')).toBeInTheDocument();
    expect(screen.getByText('Total Registered Users')).toBeInTheDocument();

    // Check users
    expect(screen.getByText('Alex Smith')).toBeInTheDocument();
    expect(screen.getByText('@alex_smith')).toBeInTheDocument();

    // Check account without a username displays with full name alone
    expect(screen.getByText('Jordan Doe')).toBeInTheDocument();
    expect(screen.queryByText('@Jordan Doe')).not.toBeInTheDocument();
  });

  it('searches users with debounce', async () => {
    render(
      <MemoryRouter initialEntries={['/admin']}>
        <AdminPanelPage />
      </MemoryRouter>
    );

    await screen.findByText('Alex Smith');

    const searchInput = screen.getByPlaceholderText(/Search users by username/i);
    fireEvent.change(searchInput, { target: { value: 'alex' } });

    await waitFor(
      () => {
        expect(adminApi.fetchAdminUsers).toHaveBeenCalledWith(1, 20, 'alex');
      },
      { timeout: 1000 }
    );
  });

  it('opens user details modal and displays details and event breakdown', async () => {
    render(
      <MemoryRouter initialEntries={['/admin']}>
        <AdminPanelPage />
      </MemoryRouter>
    );

    const userBtn = await screen.findByRole('button', { name: /View details for Alex Smith/i });
    fireEvent.click(userBtn);

    // Modal details
    expect(await screen.findByRole('heading', { name: 'User Details' })).toBeInTheDocument();
    expect(screen.getByTestId('user-role-badge')).toHaveTextContent('User');
    expect(screen.getByText(/Member since/i)).toBeInTheDocument();

    // Organized events
    expect(screen.getByText('Future Workshop')).toBeInTheDocument();
    expect(screen.getByText('Past Meetup')).toBeInTheDocument();
    expect(screen.getByText('Cancelled Hackathon')).toBeInTheDocument();
  });

  it('grants administrator role after confirmation and updates badge without reload', async () => {
    render(
      <MemoryRouter initialEntries={['/admin']}>
        <AdminPanelPage />
      </MemoryRouter>
    );

    const userBtn = await screen.findByRole('button', { name: /View details for Alex Smith/i });
    fireEvent.click(userBtn);

    // Click Grant Admin button
    const grantBtn = await screen.findByRole('button', { name: /Grant Admin/i });
    fireEvent.click(grantBtn);

    // Confirmation dialog
    expect(await screen.findByText(/Grant Administrator Role\?/i)).toBeInTheDocument();

    const confirmBtn = screen.getByRole('button', { name: /Yes, Grant Admin/i });
    fireEvent.click(confirmBtn);

    // After success: role badge updates to Admin and Grant Admin button disappears
    await waitFor(() => {
      expect(screen.getByTestId('admin-role-badge')).toHaveTextContent('Admin');
    });
    expect(screen.queryByRole('button', { name: /Grant Admin/i })).not.toBeInTheDocument();
    expect(adminApi.grantAdminRole).toHaveBeenCalledWith('user-1');
  });

  it('shows no grant admin button for an already administrator account', async () => {
    render(
      <MemoryRouter initialEntries={['/admin']}>
        <AdminPanelPage />
      </MemoryRouter>
    );

    const adminUserBtn = await screen.findByRole('button', { name: /View details for Sarah Connor/i });
    fireEvent.click(adminUserBtn);

    expect(await screen.findByTestId('admin-role-badge')).toHaveTextContent('Admin');
    expect(screen.queryByRole('button', { name: /Grant Admin/i })).not.toBeInTheDocument();
  });

  it('switches between Users and Events tabs', async () => {
    vi.spyOn(adminApi, 'fetchAdminEvents').mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      limit: 20,
      total_pages: 1,
    });

    render(
      <MemoryRouter initialEntries={['/admin']}>
        <AdminPanelPage />
      </MemoryRouter>
    );

    const eventsTabBtn = screen.getByRole('tab', { name: /Events/i });
    fireEvent.click(eventsTabBtn);

    expect(await screen.findByText('Total events')).toBeInTheDocument();
    expect(await screen.findByLabelText('Search by event title')).toBeInTheDocument();
  });

  describe('BottomNav & AdminGuard', () => {
    it('BottomNav shows Admin button immediately left of Profile for verified admin', async () => {
      render(
        <MemoryRouter initialEntries={['/home']}>
          <BottomNav />
        </MemoryRouter>
      );

      const adminLink = await screen.findByRole('link', { name: /Admin/i });
      expect(adminLink).toBeInTheDocument();

      const profileLink = screen.getByRole('link', { name: /Profile/i });
      expect(profileLink).toBeInTheDocument();

      // Ensure Admin is immediately before Profile in document order
      expect(adminLink.compareDocumentPosition(profileLink)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    });

    it('BottomNav hides Admin button when user is not a verified admin', async () => {
      vi.spyOn(adminApi, 'checkAdminVerified').mockResolvedValue({ isVerifiedAdmin: false });

      render(
        <MemoryRouter initialEntries={['/home']}>
          <BottomNav />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.queryByRole('link', { name: /Admin/i })).not.toBeInTheDocument();
      });
    });

    it('AdminGuard blocks unverified user and redirects to /home', async () => {
      vi.spyOn(adminApi, 'checkAdminVerified').mockResolvedValue({ isVerifiedAdmin: false });

      render(
        <MemoryRouter initialEntries={['/admin']}>
          <Routes>
            <Route path="/home" element={<div>Home Page Screen</div>} />
            <Route
              path="/admin"
              element={
                <AdminGuard>
                  <div>Secret Admin Content</div>
                </AdminGuard>
              }
            />
          </Routes>
        </MemoryRouter>
      );

      expect(await screen.findByText('Home Page Screen')).toBeInTheDocument();
      expect(screen.queryByText('Secret Admin Content')).not.toBeInTheDocument();
    });
  });
});

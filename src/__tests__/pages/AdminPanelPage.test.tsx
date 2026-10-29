import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
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

const mockUserDetailsAlex: adminApi.AdminUserDetailsFull = {
  id: 'user-1',
  username: 'alex_smith',
  full_name: 'Alex Smith',
  created_at: '2026-03-15T10:30:00Z',
  is_admin: false,
  role: 'user',
  is_suspended: false,
  warnings: [],
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

const mockUserDetailsSarah: adminApi.AdminUserDetailsFull = {
  id: 'user-3',
  username: 'super_admin',
  full_name: 'Sarah Connor',
  created_at: '2026-01-01T00:00:00Z',
  is_admin: true,
  role: 'administrator',
  is_suspended: false,
  warnings: [],
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
    // Mock fetch for AdminPanelPage's profile name fetch (fire-and-forget — just needs to not throw)
    vi.stubGlobal('fetch', vi.fn(() =>
      Promise.resolve({ ok: true, json: async () => ({ full_name: 'Test Admin', username: 'test_admin' }) } as Response)
    ));
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
    vi.spyOn(adminApi, 'fetchAdminEvents').mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      limit: 20,
      total_pages: 1,
    });
    vi.spyOn(adminApi, 'fetchAdminAudit').mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      limit: 20,
      total_pages: 1,
      has_more: false,
      next_before: null,
    });
    vi.spyOn(adminApi, 'fetchAdminReports').mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      limit: 20,
      total_pages: 1,
    });
    vi.spyOn(adminApi, 'grantAdminRole').mockResolvedValue({
      message: 'Administrator role granted successfully.',
      user_id: 'user-1',
      role: 'administrator',
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('renders total registered users count and lists users', async () => {
    render(
      <MemoryRouter initialEntries={['/admin']}>
        <AdminPanelPage />
      </MemoryRouter>
    );

    // Check count — comes from fetchAdminUsers response total field
    expect(await screen.findByText('3')).toBeInTheDocument();
    expect(screen.getByText('Registered users')).toBeInTheDocument();

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

    const searchInput = screen.getByPlaceholderText(/Search by username/i);
    fireEvent.change(searchInput, { target: { value: 'alex' } });

    await waitFor(
      () => {
        expect(adminApi.fetchAdminUsers).toHaveBeenCalledWith(1, 50, 'alex');
      },
      { timeout: 1000 }
    );
  });

  it('navigates to inline user detail and displays details and event breakdown', async () => {
    render(
      <MemoryRouter initialEntries={['/admin']}>
        <AdminPanelPage />
      </MemoryRouter>
    );

    const userBtn = await screen.findByRole('button', { name: /View details for Alex Smith/i });
    fireEvent.click(userBtn);

    // Inline detail — back button visible
    expect(await screen.findByRole('button', { name: /Back to Users/i })).toBeInTheDocument();
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

    // Click Make Admin button
    const grantBtn = await screen.findByRole('button', { name: /Make Admin/i });
    fireEvent.click(grantBtn);

    // Confirmation dialog
    expect(await screen.findByText(/Grant Administrator Role\?/i)).toBeInTheDocument();

    const confirmBtn = screen.getByRole('button', { name: /Grant Admin/i });
    fireEvent.click(confirmBtn);

    // After success: role badge updates to Admin and Make Admin button disappears
    await waitFor(() => {
      expect(screen.getByTestId('admin-role-badge')).toHaveTextContent('Admin');
    });
    expect(screen.queryByRole('button', { name: /Make Admin/i })).not.toBeInTheDocument();
    expect(adminApi.grantAdminRole).toHaveBeenCalledWith('user-1');
  });

  it('shows suspended status on the admin profile and requires a reason to lift', async () => {
    vi.spyOn(adminApi, 'fetchAdminUsers').mockResolvedValue({
      items: [{ ...mockUsers[0], is_suspended: true, status: 'suspended' }],
      total: 1,
      page: 1,
      limit: 20,
      total_pages: 1,
    });
    vi.spyOn(adminApi, 'fetchAdminUserDetails').mockResolvedValue({
      ...mockUserDetailsAlex,
      is_suspended: true,
      status: 'suspended',
      suspension: {
        reason: 'Spam reports',
        suspended_at: '2026-01-01T00:00:00Z',
        suspended_by: 'ada',
      },
    });
    vi.spyOn(adminApi, 'liftSuspension').mockResolvedValue({ message: 'Suspension lifted.' });

    render(
      <MemoryRouter initialEntries={['/admin']}>
        <AdminPanelPage />
      </MemoryRouter>,
    );

    fireEvent.click(await screen.findByRole('button', { name: /View details for Alex Smith/i }));
    expect(await screen.findByTestId('account-status-badge')).toHaveTextContent('Suspended');
    expect(screen.getByText(/Spam reports/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Lift suspension/i }));
    const dialog = await screen.findByRole('alertdialog');
    expect(within(dialog).getByText(/Provide a reason for lifting/i)).toBeInTheDocument();

    const confirm = within(dialog).getByRole('button', { name: /Lift Suspension/i });
    expect(confirm).toBeDisabled();

    fireEvent.change(within(dialog).getByLabelText('Reason'), { target: { value: 'Appeal accepted' } });
    fireEvent.click(confirm);

    await waitFor(() => {
      expect(adminApi.liftSuspension).toHaveBeenCalledWith('user-1', 'Appeal accepted');
    });
    expect(await screen.findByTestId('account-status-badge')).toHaveTextContent('Active');
  });

  it('shows a lift-suspension reason in the audit log', async () => {
    vi.spyOn(adminApi, 'fetchAdminAudit').mockResolvedValue({
      items: [
        {
          id: 'a1',
          action: 'lift_suspension',
          admin_id: 'ada',
          admin_name: 'Ada Admin',
          admin_username: 'ada.admin',
          target_id: 'user-1',
          target_type: 'user',
          target_name: 'Alex Smith',
          target_username: 'alex_smith',
          reason: 'Appeal accepted',
          details: null,
          created_at: '2026-01-01T00:00:00Z',
        },
      ],
      total: 1,
      page: 1,
      limit: 20,
      total_pages: 1,
      has_more: false,
      next_before: null,
    });

    render(
      <MemoryRouter initialEntries={['/admin']}>
        <AdminPanelPage />
      </MemoryRouter>,
    );

    fireEvent.click(await screen.findByRole('tab', { name: /Audit Log/i }));
    expect(await screen.findAllByText('Lifted suspension')).not.toHaveLength(0);
    expect(screen.getAllByTestId('audit-reason').some((el) => el.textContent === 'Appeal accepted')).toBe(true);
    expect(screen.getAllByText('Ada Admin').length).toBeGreaterThan(0);
    expect(screen.getAllByText('@ada.admin').length).toBeGreaterThan(0);
  });

  it('shows no make admin button for an already administrator account', async () => {
    render(
      <MemoryRouter initialEntries={['/admin']}>
        <AdminPanelPage />
      </MemoryRouter>
    );

    const adminUserBtn = await screen.findByRole('button', { name: /View details for Sarah Connor/i });
    fireEvent.click(adminUserBtn);

    expect(await screen.findByTestId('admin-role-badge')).toHaveTextContent('Admin');
    expect(screen.queryByRole('button', { name: /Make Admin/i })).not.toBeInTheDocument();
  });

  it('switches between tabs (4-tab layout)', async () => {
    render(
      <MemoryRouter initialEntries={['/admin']}>
        <AdminPanelPage />
      </MemoryRouter>
    );

    // Users tab is default
    await screen.findByText('Alex Smith');

    // Switch to Events tab
    const eventsTabBtn = screen.getByRole('tab', { name: /Events/i });
    fireEvent.click(eventsTabBtn);

    expect(await screen.findByLabelText('Search by event title')).toBeInTheDocument();
    expect(screen.getByText('Total Events')).toBeInTheDocument();
    expect(eventsTabBtn).toHaveAttribute('aria-selected', 'true');
  });

  describe('BottomNav & AdminGuard', () => {
    it('BottomNav shows Admin after Friends and keeps Profile out of the tab bar', async () => {
      render(
        <MemoryRouter initialEntries={['/home']}>
          <BottomNav />
        </MemoryRouter>
      );

      const adminLink = await screen.findByRole('link', { name: /Admin/i });
      expect(adminLink).toBeInTheDocument();
      expect(screen.queryByRole('link', { name: /^Profile$/i })).not.toBeInTheDocument();

      const friendsLink = screen.getByRole('link', { name: /Friends/i });
      expect(friendsLink.compareDocumentPosition(adminLink)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
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

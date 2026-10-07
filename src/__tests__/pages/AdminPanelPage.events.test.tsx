import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import AdminPanelPage from '@/pages/AdminPanelPage';
import * as adminApi from '@/lib/adminApi';
import * as authModule from '@/lib/auth';

vi.mock('@/components/BottomNav', () => ({ default: () => <nav /> }));

const alex: adminApi.AdminUserDetails = {
  id: 'user-1',
  username: 'alex_smith',
  full_name: 'Alex Smith',
  created_at: '2026-03-15T10:30:00Z',
  is_admin: false,
  role: 'user',
  organized_events: {
    upcoming: [{ id: 'e1', title: 'Future Workshop', date: '2026-12-01T10:00:00Z', status: 'active' }],
    past: [],
    cancelled: [],
  },
  joined_events: { upcoming: [], past: [], cancelled: [] },
};

function renderPanel(path = '/admin') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/admin" element={<AdminPanelPage />} />
        <Route path="/admin/events/:eventId" element={<div>Panel event page</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe('Admin panel — events wiring (ticket #249)', () => {
  beforeEach(() => {
    vi.spyOn(authModule, 'getAuthToken').mockReturnValue('mock_token');
    vi.spyOn(adminApi, 'fetchAdminCounts').mockResolvedValue({
      total_users: 3,
      events: { total: 1, upcoming: 1, past: 0, cancelled: 0 },
    });
    vi.spyOn(adminApi, 'fetchAdminUsers').mockResolvedValue({
      items: [{ id: 'user-1', username: 'alex_smith', full_name: 'Alex Smith', role: 'user', created_at: '2026-03-15T10:30:00Z' }],
      total: 1,
      page: 1,
      limit: 20,
      total_pages: 1,
    });
    vi.spyOn(adminApi, 'fetchAdminUserDetails').mockResolvedValue(alex);
    vi.spyOn(adminApi, 'fetchAdminEvents').mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      limit: 20,
      total_pages: 1,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('opens the panel event page from an event listed in a user\'s details', async () => {
    renderPanel();
    fireEvent.click(await screen.findByRole('button', { name: /View details for Alex Smith/i }));
    fireEvent.click(await screen.findByRole('button', { name: /View details for Future Workshop/i }));
    expect(await screen.findByText('Panel event page')).toBeInTheDocument();
  });

  it('opens on the Events tab when the address says ?tab=events', async () => {
    renderPanel('/admin?tab=events');
    expect(await screen.findByLabelText('Search by event title')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Events/i })).toHaveAttribute('aria-selected', 'true');
  });

  it('opens on the Users tab by default', async () => {
    renderPanel();
    expect(await screen.findByText('Total Registered Users')).toBeInTheDocument();
  });
});

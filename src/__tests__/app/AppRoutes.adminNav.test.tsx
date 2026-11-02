import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AppRoutes from '@/app/AppRoutes';
import { clearAuthToken, setAuthToken } from '@/lib/auth';
import { setCurrentUserFromOAuth } from '@/lib/storage';
import * as adminApi from '@/lib/adminApi';
import { invalidatePrefix } from '@/lib/queryCache';

vi.mock('@/lib/supabase', () => ({
  supabase: null,
  syncSupabaseSession: vi.fn(() => Promise.resolve()),
  clearSupabaseSession: vi.fn(),
}));

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

describe('Admin routes — user chrome', () => {
  beforeEach(() => {
    invalidatePrefix('/api');
    setAuthToken('admin-token');
    setCurrentUserFromOAuth({
      id: 'admin-1',
      email: 'admin@example.com',
      username: 'test_admin',
      name: 'Test Admin',
      role: 'administrator',
    });
    vi.spyOn(adminApi, 'checkAdminVerified').mockResolvedValue({
      isVerifiedAdmin: true,
      role: 'administrator',
    });
    vi.spyOn(adminApi, 'fetchAdminCounts').mockResolvedValue({
      total_users: 0,
      events: { total: 0, upcoming: 0, past: 0, cancelled: 0 },
    });
    vi.spyOn(adminApi, 'fetchAdminUsers').mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      limit: 20,
      total_pages: 1,
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
    vi.spyOn(adminApi, 'fetchOpenReportCount').mockResolvedValue(0);
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('/api/profile/me')) {
          return json({ id: 'admin-1', username: 'test_admin', full_name: 'Test Admin', role: 'administrator' });
        }
        return json({}, 200);
      }),
    );
  });

  afterEach(() => {
    clearAuthToken();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('does not show the user top bar on the admin panel', async () => {
    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }} initialEntries={['/admin']}>
        <AppRoutes />
      </MemoryRouter>,
    );

    expect(await screen.findByText('Admin Panel')).toBeInTheDocument();
    expect(screen.queryByTestId('user-top-bar')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Notifications/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /^Home$/i })).not.toBeInTheDocument();
  });
});

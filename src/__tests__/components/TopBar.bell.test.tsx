import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import TopBar from '@/components/TopBar';

vi.mock('@/lib/auth', () => ({
  getAuthToken: () => 'bell-test-token-xxxxxxxxxxxx',
  setAuthToken: () => {},
  clearAuthToken: () => {},
}));

vi.mock('@/lib/storage', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@/lib/storage')>();
  return {
    ...mod,
    getCurrentUser: () => ({ id: 'me', name: 'Me', email: 'me@example.com' }),
    updateUser: () => {},
    logout: () => {},
  };
});

type Setup = { notifications: unknown[]; pending: number | 'fail' };

function stubBackend({ notifications, pending }: Setup) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockImplementation((url: string) => {
      const u = String(url);
      if (u.includes('/api/notifications/all')) {
        return Promise.resolve(new Response(JSON.stringify({ data: notifications }), { status: 200 }));
      }
      if (u.includes('/api/friends/requests/count')) {
        return pending === 'fail'
          ? Promise.resolve(new Response('{}', { status: 500 }))
          : Promise.resolve(new Response(JSON.stringify({ count: pending }), { status: 200 }));
      }
      return Promise.resolve(new Response('{}', { status: 200 }));
    })
  );
}

const bellDot = () => document.querySelector('a[href="/notifications"] span.animate-pulse');

function renderBar() {
  return render(
    <MemoryRouter>
      <TopBar search="" onSearchChange={() => {}} />
    </MemoryRouter>
  );
}

describe('TopBar bell dot (#296)', () => {
  beforeEach(() => {
    vi.resetModules();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('lights up when a friend request is waiting, even with no unread notification', async () => {
    stubBackend({ notifications: [{ id: 1, type: 'event_updated', message: 'x', is_read: true }], pending: 1 });
    renderBar();
    await waitFor(() => expect(bellDot()).not.toBeNull());
  });

  it('lights up for an unread notification when no request is waiting', async () => {
    stubBackend({ notifications: [{ id: 2, type: 'event_updated', message: 'y', is_read: false }], pending: 0 });
    renderBar();
    await waitFor(() => expect(bellDot()).not.toBeNull());
  });

  it('stays off when everything is read and no request is waiting', async () => {
    stubBackend({ notifications: [{ id: 3, type: 'event_updated', message: 'z', is_read: true }], pending: 0 });
    renderBar();
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(3));
    expect(bellDot()).toBeNull();
    expect(screen.getByTitle('Notifications')).toBeInTheDocument();
  });

  it('still shows the unread dot when the request count cannot be loaded', async () => {
    stubBackend({ notifications: [{ id: 4, type: 'event_updated', message: 'w', is_read: false }], pending: 'fail' });
    renderBar();
    await waitFor(() => expect(bellDot()).not.toBeNull());
  });
});

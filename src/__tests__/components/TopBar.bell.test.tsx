import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import TopBar from '@/components/TopBar';
import { clearCache } from '@/lib/queryCache';

vi.mock('@/lib/auth', () => ({
  AUTH_TOKEN_EVENT: 'eventapp:auth-token',
  getAuthToken: () => 'bell-test-token-xxxxxxxxxxxx',
  setAuthToken: () => {},
  clearAuthToken: () => {},
}));

vi.mock('@/lib/storage', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@/lib/storage')>();
  return {
    ...mod,
    getCurrentUser: () => ({ id: 'me', name: 'Me', email: 'me@example.com', isPremium: false }),
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
    clearCache();
    sessionStorage.clear();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('lights up when a friend request is waiting, even with no unread notification', async () => {
    stubBackend({ notifications: [{ id: 1, type: 'event_updated', message: 'x', is_read: true }], pending: 1 });
    renderBar();
    await waitFor(() => expect(bellDot()).toHaveTextContent('1'));
  });

  it('lights up for an unread notification when no request is waiting', async () => {
    stubBackend({ notifications: [{ id: 2, type: 'event_updated', message: 'y', is_read: false }], pending: 0 });
    renderBar();
    await waitFor(() => expect(bellDot()).toHaveTextContent('1'));
  });

  it('shows the unread count on the blinking badge', async () => {
    stubBackend({
      notifications: [
        { id: 5, type: 'event_updated', message: 'a', is_read: false },
        { id: 6, type: 'event_updated', message: 'b', is_read: false },
        { id: 7, type: 'event_updated', message: 'c', is_read: true },
      ],
      pending: 0,
    });
    renderBar();
    await waitFor(() => expect(bellDot()).toHaveTextContent('2'));
  });

  it('stays off when everything is read and no request is waiting', async () => {
    stubBackend({ notifications: [{ id: 3, type: 'event_updated', message: 'z', is_read: true }], pending: 0 });
    renderBar();
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(3));
    expect(bellDot()).toBeNull();
    expect(screen.getByTitle('Notifications')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /^Profile$/i })).toHaveAttribute('href', '/profile');
  });

  it('adds pending friend requests to the unread notification count', async () => {
    stubBackend({
      notifications: [
        { id: 8, type: 'event_updated', message: 'a', is_read: false },
        { id: 9, type: 'event_updated', message: 'b', is_read: true },
      ],
      pending: 2,
    });
    renderBar();
    await waitFor(() => expect(bellDot()).toHaveTextContent('3'));
  });

  it('does not double-count a pending request that already has an unread friend-request row', async () => {
    stubBackend({
      notifications: [
        { id: 10, type: 'friend_request_received', message: 'x', is_read: false },
        { id: 11, type: 'event_updated', message: 'y', is_read: false },
      ],
      pending: 1,
    });
    renderBar();
    await waitFor(() => expect(bellDot()).toHaveTextContent('2'));
  });

  it('updates the badge live when notifications change', async () => {
    stubBackend({ notifications: [], pending: 0 });
    renderBar();
    await waitFor(() => expect(fetch).toHaveBeenCalled());
    expect(bellDot()).toBeNull();

    stubBackend({
      notifications: [{ id: 12, type: 'event_updated', message: 'z', is_read: false }],
      pending: 2,
    });
    window.dispatchEvent(new CustomEvent('eventapp:notifications-changed'));
    await waitFor(() => expect(bellDot()).toHaveTextContent('3'));
  });

  it('still shows the unread dot when the request count cannot be loaded', async () => {
    stubBackend({ notifications: [{ id: 4, type: 'event_updated', message: 'w', is_read: false }], pending: 'fail' });
    renderBar();
    await waitFor(() => expect(bellDot()).not.toBeNull());
  });

  it('switches the color scheme from the settings menu', async () => {
    stubBackend({ notifications: [], pending: 0 });
    renderBar();
    const trigger = screen.getByRole('button', { name: 'Settings' });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(await screen.findByRole('menu')).toBeInTheDocument();
    fireEvent.click(await screen.findByRole('radio', { name: 'Light' }));
    expect(document.documentElement.dataset.colorScheme).toBe('light');
    fireEvent.click(screen.getByRole('radio', { name: 'Dark' }));
    expect(document.documentElement.dataset.colorScheme).toBe('dark');
  });

  it('opens Manage account from settings', async () => {
    stubBackend({ notifications: [], pending: 0 });
    renderBar();
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
    const item = await screen.findByRole('menuitem', { name: 'Manage account' });
    expect(item).toHaveAttribute('href', '/account');
    expect(screen.getByTestId('plan-badge')).toHaveTextContent('Basic');
  });
});

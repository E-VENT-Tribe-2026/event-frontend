import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ProfilePage from '@/pages/ProfilePage';
import { clearAuthToken, setAuthToken } from '@/lib/auth';
import { setCurrentUserFromOAuth } from '@/lib/storage';
import { invalidatePrefix } from '@/lib/queryCache';

vi.mock('@/components/BottomNav', () => ({ default: () => null }));

const ANN = {
  id: 'u-ann', username: 'ann_a', full_name: 'Ann Archer', display_name: 'ann_a',
  avatar_kind: 'icon', icon_id: 'sun', avatar_url: null,
};

describe('ProfilePage: Invitations tab (#291)', () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    invalidatePrefix('/api');
    setAuthToken('mock-token');
    setCurrentUserFromOAuth({ id: 'user-me', email: 'me@test.com', name: 'My Name', username: 'my_username' });
    const json = (body: unknown) =>
      new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/api/profile/me')) {
        return json({ id: 'user-me', email: 'me@test.com', username: 'my_username', full_name: 'My Name', avatar_kind: 'icon', icon_id: 'alex' });
      }
      if (url.includes('/api/invitations')) {
        return json({
          page: 1, limit: 20, has_more: false, total: 3,
          data: [1, 2, 3].map((n) => ({
            invitation_id: n, created_at: '2026-10-10T10:00:00+00:00', inviter: ANN,
            event: { id: 'ev-1', title: 'Summer Picnic', start_datetime: '2027-01-01T10:00:00+00:00' },
          })),
        });
      }
      if (url.includes('/api/events/my-events')) return json({ data: [] });
      return json([]);
    }));
  });
  afterEach(() => {
    clearAuthToken();
    vi.unstubAllGlobals();
  });

  it('puts the Invitations tab right of Favourites, with the number of invitations', async () => {
    render(<MemoryRouter><ProfilePage /></MemoryRouter>);
    await waitFor(() => expect(screen.getByTestId('profile-full-name')).toHaveTextContent('My Name'));

    const favourites = screen.getByTestId('tab-favourites');
    const invitations = screen.getByTestId('tab-invitations');
    expect(favourites.nextElementSibling).toBe(invitations);
    await waitFor(() => expect(invitations).toHaveTextContent(/Invitations\s*3/));
  });

  it('shows one row per invitation when the tab is opened', async () => {
    render(<MemoryRouter><ProfilePage /></MemoryRouter>);
    await waitFor(() => expect(screen.getByTestId('profile-full-name')).toHaveTextContent('My Name'));

    fireEvent.click(screen.getByTestId('tab-invitations'));
    expect(await screen.findAllByTestId('invitation-row')).toHaveLength(3);
  });
});

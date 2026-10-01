import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ProfilePage from '@/pages/ProfilePage';
import { clearAuthToken, setAuthToken } from '@/lib/auth';
import { setCurrentUserFromOAuth } from '@/lib/storage';
import { invalidatePrefix } from '@/lib/queryCache';

vi.mock('@/components/BottomNav', () => ({ default: () => null }));

const json = (body: unknown) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });

const baseProfile = {
  id: 'u1',
  email: 'a@b.com',
  username: 'john_42',
  full_name: 'John Smith',
  avatar_url: 'https://api.dicebear.com/9.x/avataaars/svg?seed=aurora',
  avatar_kind: 'icon',
  icon_id: 'aurora',
  banner_url: null,
};

const renderPage = () =>
  render(
    <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <ProfilePage />
    </MemoryRouter>,
  );

describe('ProfilePage identity', () => {
  beforeEach(() => {
    sessionStorage.clear();
    invalidatePrefix('/api');
    setAuthToken('tok');
    setCurrentUserFromOAuth({ id: 'u1', email: 'a@b.com', name: 'Local', username: 'alex' });
  });

  afterEach(() => {
    clearAuthToken();
    vi.unstubAllGlobals();
  });

  it('shows full name above username, the icon, and no banner when none is chosen', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('/api/profile/me')) return json(baseProfile);
        return json([]);
      }),
    );

    renderPage();

    // The page renders profile-username twice (one visible, one hidden), so use the first
    const usernames = await screen.findAllByTestId('profile-username');
    expect(usernames[0]).toHaveTextContent('john_42');

    expect(screen.getByTestId('profile-full-name')).toHaveTextContent('John Smith');
    expect(screen.getByTestId('profile-picture')).toHaveAttribute('data-avatar-kind', 'icon');
    expect(screen.getByTestId('profile-banner').style.backgroundImage).toBe('');

    const position = screen
      .getByTestId('profile-full-name')
      .compareDocumentPosition(usernames[0]);
    expect(position & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    expect(screen.queryByText('a@b.com')).not.toBeInTheDocument();
  });

  it('shows an uploaded photo and the chosen banner', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('/api/profile/me')) {
          return json({
            ...baseProfile,
            avatar_url: 'https://cdn.example.com/me.jpg',
            avatar_kind: 'photo',
            icon_id: null,
            banner_url: 'https://images.unsplash.com/photo-1',
          });
        }
        return json([]);
      }),
    );

    renderPage();

    await waitFor(() =>
      expect(screen.getByTestId('profile-picture')).toHaveAttribute('data-avatar-kind', 'photo'),
    );
    expect(screen.getByTestId('profile-banner').style.backgroundImage).toContain(
      'https://images.unsplash.com/photo-1',
    );
  });

  it('shows a saved full name after editing the profile', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes('/api/profile/me') && init?.method === 'PUT') {
        return json({ ...baseProfile, full_name: 'Jane Doe' });
      }
      if (url.includes('/api/profile/me')) return json(baseProfile);
      return json([]);
    });
    vi.stubGlobal('fetch', fetchMock);

    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: /edit profile/i }));
    fireEvent.change(screen.getByLabelText('Full name'), { target: { value: 'Jane Doe' } });
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));

    expect(await screen.findByTestId('profile-full-name')).toHaveTextContent('Jane Doe');
    expect(screen.getAllByTestId('profile-username')[0]).toHaveTextContent('john_42');

    const puts = fetchMock.mock.calls.filter(
      (call) => (call[1] as RequestInit | undefined)?.method === 'PUT',
    );
    expect(puts).toHaveLength(1);
    expect(JSON.parse(String((puts[0][1] as RequestInit).body)).full_name).toBe('Jane Doe');
  });

  it('refuses an empty full name and does not save a stand-in', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/api/profile/me')) return json(baseProfile);
      return json([]);
    });
    vi.stubGlobal('fetch', fetchMock);

    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: /edit profile/i }));
    expect(screen.queryByLabelText('Username')).not.toBeInTheDocument();
    expect(screen.getByText(/3–50 characters/)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Full name'), { target: { value: '   ' } });
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));

    expect((await screen.findAllByText('Full name is required')).length).toBeGreaterThan(0);

    // fetch(url, init): init is the second argument
    const puts = fetchMock.mock.calls.filter(
      (call) => (call[0] as RequestInit | undefined)?.method === 'PUT',
    );
    expect(puts).toHaveLength(0);
  });
});
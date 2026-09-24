import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ProfilePage from '@/pages/ProfilePage';
import { clearAuthToken, setAuthToken } from '@/lib/auth';
import { setCurrentUserFromOAuth } from '@/lib/storage';

vi.mock('@/components/BottomNav', () => ({ default: () => null }));

describe('ProfilePage identity', () => {
  beforeEach(() => {
    sessionStorage.clear();
    setAuthToken('tok');
    setCurrentUserFromOAuth({ id: 'u1', email: 'a@b.com', name: 'Local' });
  });

  afterEach(() => {
    clearAuthToken();
    vi.unstubAllGlobals();
  });

  it('shows full name above username, the icon, and no banner when none is chosen', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/api/profile/me')) {
        return new Response(JSON.stringify({
          id: 'u1',
          email: 'a@b.com',
          username: 'john_42',
          full_name: 'John Smith',
          avatar_url: 'https://api.dicebear.com/9.x/avataaars/svg?seed=aurora',
          avatar_kind: 'icon',
          icon_id: 'aurora',
          banner_url: null,
        }), { status: 200, headers: { 'content-type': 'application/json' } });
      }
      return new Response('[]', { status: 200, headers: { 'content-type': 'application/json' } });
    }));

    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <ProfilePage />
      </MemoryRouter>,
    );

    expect(await screen.findByTestId('profile-username')).toHaveTextContent('john_42');
    expect(screen.getByTestId('profile-full-name')).toHaveTextContent('John Smith');
    const picture = screen.getByTestId('profile-picture');
    expect(picture).toHaveAttribute('data-avatar-kind', 'icon');
    expect(picture).toHaveAttribute('data-icon-id', 'aurora');
    expect(screen.getByTestId('profile-banner').style.backgroundImage).toBe('');
    const fullNameBox = screen.getByTestId('profile-full-name').compareDocumentPosition(screen.getByTestId('profile-username'));
    expect(fullNameBox & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('shows an uploaded photo and the chosen banner', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/api/profile/me')) {
        return new Response(JSON.stringify({
          id: 'u1',
          email: 'a@b.com',
          username: 'john_42',
          full_name: 'John Smith',
          avatar_url: 'https://cdn.example.com/me.jpg',
          avatar_kind: 'photo',
          icon_id: null,
          banner_url: 'https://images.unsplash.com/photo-1',
        }), { status: 200, headers: { 'content-type': 'application/json' } });
      }
      return new Response('[]', { status: 200, headers: { 'content-type': 'application/json' } });
    }));

    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <ProfilePage />
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByTestId('profile-picture')).toHaveAttribute('data-avatar-kind', 'photo'));
    expect(screen.getByTestId('profile-picture')).toHaveAttribute('data-icon-id', '');
    expect(screen.getByTestId('profile-banner').style.backgroundImage).toContain('https://images.unsplash.com/photo-1');
  });

  it('refuses an empty full name and does not save a stand-in', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/api/profile/me')) {
        return new Response(JSON.stringify({
          id: 'u1', email: 'a@b.com', username: 'john_42', full_name: 'John Smith',
          avatar_url: 'https://api.dicebear.com/9.x/avataaars/svg?seed=aurora', avatar_kind: 'icon', icon_id: 'aurora', banner_url: null,
        }), { status: 200, headers: { 'content-type': 'application/json' } });
      }
      if (url.includes('/api/profile/assets')) {
        return new Response(JSON.stringify({
          icons: [{ id: 'aurora', url: 'https://api.dicebear.com/9.x/avataaars/svg?seed=aurora' }],
          banners: [{ id: 'night', label: 'Night', url: 'https://images.unsplash.com/photo-1' }],
        }), { status: 200, headers: { 'content-type': 'application/json' } });
      }
      return new Response('[]', { status: 200, headers: { 'content-type': 'application/json' } });
    });
    vi.stubGlobal('fetch', fetchMock);

    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <ProfilePage />
      </MemoryRouter>,
    );
    fireEvent.click(await screen.findByRole('button', { name: /edit profile/i }));
    expect(screen.getByText('Username cannot be changed')).toBeInTheDocument();
    expect(screen.queryByLabelText('Username')).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Full name'), { target: { value: '   ' } });
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));
    expect((await screen.findAllByText('Full name is required')).length).toBeGreaterThan(0);
    const puts = fetchMock.mock.calls.filter((call) => (call[1] as RequestInit | undefined)?.method === 'PUT');
    expect(puts).toHaveLength(0);
  });
});

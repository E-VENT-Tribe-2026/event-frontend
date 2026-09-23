import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { User } from '@/lib/storage';
import ChatPage from '@/pages/ChatPage';

const { getCurrentUserMock, getAuthTokenMock } = vi.hoisted(() => ({
  getCurrentUserMock: vi.fn<[], User | null>(),
  getAuthTokenMock: vi.fn<[], string | null>(),
}));

vi.mock('@/lib/storage', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@/lib/storage')>();
  return {
    ...mod,
    getCurrentUser: () => getCurrentUserMock(),
  };
});

vi.mock('@/components/BottomNav', () => ({
  default: () => null,
}));

vi.mock('@/lib/auth', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@/lib/auth')>();
  return {
    ...mod,
    getAuthToken: () => getAuthTokenMock(),
  };
});

vi.mock('@/lib/authProfile', () => ({
  fetchAuthUserFromToken: vi.fn(() => Promise.resolve({ id: 'u-chat', email: 'c@test.com' })),
  sameAuthUserId: (a: string | null | undefined, b: string | null | undefined) =>
    Boolean(a && b && String(a).trim().toLowerCase() === String(b).trim().toLowerCase()),
}));

const chatUser = {
  id: 'u-chat',
  name: 'Chatter',
  email: 'c@test.com',
  role: 'participant' as const,
  password: 'secret123',
  avatar: '',
  profilePhoto: '',
  coverPhoto: '',
  bio: '',
  interests: [],
  dob: '',
  gender: '',
  isPremium: false,
  friends: [],
  createdAt: '',
} satisfies User;

function mockFetchWithSenderProfile(profiles: { full_name?: string; username?: string } | undefined) {
  return vi.fn((input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    if (url.includes('/api/participants/my/events')) {
      return Promise.resolve(
        new Response(
          JSON.stringify([
            {
              events: {
                id: 'evt-1',
                title: 'DJ Luna',
                description: 'desc',
                category: 'Music',
                start_datetime: '2030-05-01T12:00:00.000Z',
                end_datetime: '2030-06-01T12:00:00.000Z',
                cost: 10,
                max_capacity: 20,
                location_name: 'Paris',
                latitude: 0,
                longitude: 0,
                created_by: 'org-1',
                status: 'active',
              },
            },
          ]),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
      );
    }
    if (url.includes('/api/events/my-events')) {
      return Promise.resolve(new Response(JSON.stringify({ data: [] }), { status: 200, headers: { 'content-type': 'application/json' } }));
    }
    if (url.includes('/api/chats/evt-1/messages')) {
      return Promise.resolve(
        new Response(
          JSON.stringify({
            data: [
              {
                id: 1,
                sender_id: 'other-user',
                content: 'Welcome!',
                created_at: '2030-05-01T12:00:00.000Z',
                message_type: 'user',
                profiles,
              },
            ],
            page: 1,
            limit: 100,
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
      );
    }
    if (url.includes('/api/events/evt-1')) {
      return Promise.resolve(
        new Response(JSON.stringify({ id: 'evt-1', status: 'active' }), { status: 200, headers: { 'content-type': 'application/json' } }),
      );
    }
    return Promise.resolve(new Response('{}', { status: 500 }));
  });
}

function renderChat() {
  render(
    <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }} initialEntries={['/chat']}>
      <Routes>
        <Route path="/chat" element={<ChatPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('ChatPage sender identity display (#215)', () => {
  beforeEach(() => {
    getCurrentUserMock.mockReturnValue(chatUser);
    getAuthTokenMock.mockReturnValue('tok-test');
  });

  afterEach(() => {
    window.sessionStorage.clear();
    vi.unstubAllGlobals();
  });

  it('shows "username (Full Name)" for another user\'s message when a username exists', async () => {
    vi.stubGlobal('fetch', mockFetchWithSenderProfile({ full_name: 'Jane Doe', username: 'jane_doe' }));
    renderChat();

    await waitFor(() => expect(screen.getByText('Chats')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /DJ Luna/i }));

    await waitFor(() => expect(screen.getByText('Welcome!')).toBeInTheDocument());
    expect(screen.getByText('jane_doe (Jane Doe)')).toBeInTheDocument();
  });

  it('falls back to full name alone when the sender has no username yet', async () => {
    vi.stubGlobal('fetch', mockFetchWithSenderProfile({ full_name: 'Jane Doe' }));
    renderChat();

    await waitFor(() => expect(screen.getByText('Chats')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /DJ Luna/i }));

    await waitFor(() => expect(screen.getByText('Welcome!')).toBeInTheDocument());
    expect(screen.getByText('Jane Doe')).toBeInTheDocument();
    expect(screen.queryByText(/\(/)).not.toBeInTheDocument();
  });
});
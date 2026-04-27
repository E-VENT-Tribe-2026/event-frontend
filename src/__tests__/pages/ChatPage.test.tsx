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

describe('ChatPage', () => {
  beforeEach(() => {
    getCurrentUserMock.mockReturnValue(chatUser);
    getAuthTokenMock.mockReturnValue('tok-test');
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(new Response('{}', { status: 500 }))),
    );
  });

  afterEach(() => {
    window.sessionStorage.clear();
    vi.unstubAllGlobals();
  });

  function renderChat() {
    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }} initialEntries={['/chat']}>
        <Routes>
          <Route path="/chat" element={<ChatPage />} />
        </Routes>
      </MemoryRouter>,
    );
  }

  it('opens event conversation and sends a message via primary chat API', async () => {
    let chatLoads = 0;
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
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
      if (url.includes('/api/chats/evt-1/messages') && init?.method === 'POST') {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              id: 2,
              event_id: 'evt-1',
              sender_id: 'u-chat',
              content: 'Hello from test',
              created_at: '2030-05-01T12:05:00.000Z',
              message_type: 'user',
            }),
            { status: 201, headers: { 'content-type': 'application/json' } },
          ),
        );
      }
      if (url.includes('/api/chats/evt-1/messages') && (!init?.method || init.method === 'GET')) {
        chatLoads += 1;
        if (chatLoads === 1) {
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
                  },
                ],
                page: 1,
                limit: 100,
              }),
              { status: 200, headers: { 'content-type': 'application/json' } },
            ),
          );
        }
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
                },
                {
                  id: 2,
                  sender_id: 'u-chat',
                  content: 'Hello from test',
                  created_at: '2030-05-01T12:05:00.000Z',
                  message_type: 'user',
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
    vi.stubGlobal('fetch', fetchMock);

    renderChat();

    await waitFor(() => {
      expect(screen.getByText('Chats')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /DJ Luna/i }));

    await waitFor(() => expect(screen.getByText('Welcome!')).toBeInTheDocument());

    const input = screen.getByPlaceholderText(/Type a message/i);
    fireEvent.change(input, { target: { value: 'Hello from test' } });
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });

    await waitFor(() => {
      expect(screen.getByText('Hello from test')).toBeInTheDocument();
    });
  });

  it('disables interaction when event chat becomes unavailable', async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      if (url.includes('/api/participants/my/events')) {
        return Promise.resolve(
          new Response(
            JSON.stringify([
              {
                events: {
                  id: 'evt-x',
                  title: 'Canceled Event',
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
      if (url.includes('/api/events/evt-x')) {
        return Promise.resolve(
          new Response(JSON.stringify({ id: 'evt-x', status: 'cancelled' }), { status: 200, headers: { 'content-type': 'application/json' } }),
        );
      }
      return Promise.resolve(new Response('{}', { status: 500 }));
    });
    vi.stubGlobal('fetch', fetchMock);

    renderChat();
    await waitFor(() => expect(screen.getByText('Chats')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /Canceled Event/i }));
    await waitFor(() => expect(screen.getByPlaceholderText(/Chat unavailable for this event/i)).toBeDisabled());
  });

  it('renders system-generated join/leave messages in chat', async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      if (url.includes('/api/participants/my/events')) {
        return Promise.resolve(
          new Response(
            JSON.stringify([
              {
                events: {
                  id: 'evt-sys',
                  title: 'System Event',
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
      if (url.includes('/api/chats/evt-sys/messages')) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              data: [
                {
                  id: 1,
                  sender_id: 'u-alice',
                  content: 'Alice joined the event',
                  message_type: 'participant_joined',
                  created_at: '2030-05-01T12:02:00.000Z',
                },
                {
                  id: 2,
                  sender_id: 'u-bob',
                  content: 'Bob left the event',
                  message_type: 'participant_left',
                  created_at: '2030-05-01T12:04:00.000Z',
                },
              ],
              page: 1,
              limit: 100,
            }),
            { status: 200, headers: { 'content-type': 'application/json' } },
          ),
        );
      }
      if (url.includes('/api/events/evt-sys')) {
        return Promise.resolve(
          new Response(JSON.stringify({ id: 'evt-sys', status: 'active' }), { status: 200, headers: { 'content-type': 'application/json' } }),
        );
      }
      return Promise.resolve(new Response('{}', { status: 500 }));
    });
    vi.stubGlobal('fetch', fetchMock);

    renderChat();
    await waitFor(() => expect(screen.getByText('Chats')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /System Event/i }));

    expect(await screen.findByText('Alice joined the event')).toBeInTheDocument();
    expect(screen.getByText('Bob left the event')).toBeInTheDocument();
  });
});

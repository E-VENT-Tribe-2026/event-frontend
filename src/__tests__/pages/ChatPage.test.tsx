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

// ── Helpers ─────────────────────────────────────────────────────────────────

const urlOf = (input: RequestInfo | URL) =>
  typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

/** A row as returned by GET /api/participants/my/events */
const joinedEvent = (
  id: string,
  title: string,
  opts: { status?: string; start?: string; end?: string } = {},
) => ({
  events: {
    id,
    title,
    description: 'desc',
    category: 'Music',
    start_datetime: opts.start ?? '2030-05-01T12:00:00.000Z',
    end_datetime: opts.end ?? '2030-06-01T12:00:00.000Z',
    cost: 10,
    max_capacity: 20,
    location_name: 'Paris',
    latitude: 0,
    longitude: 0,
    created_by: 'org-1',
    status: opts.status ?? 'active',
  },
});

/** Handles the two chat-list endpoints; returns undefined for anything else. */
const listRoutes = (url: string, joined: ReturnType<typeof joinedEvent>[]) => {
  if (url.includes('/api/participants/my/events')) return jsonResponse(joined);
  if (url.includes('/api/events/my-events')) return jsonResponse({ data: [] });
  return undefined;
};

/** Stubs global fetch. Unhandled routes (handler returns undefined) respond 500. */
const stubFetch = (handler: (url: string, init?: RequestInit) => Response | undefined) => {
  const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) =>
    Promise.resolve(handler(urlOf(input), init) ?? new Response('{}', { status: 500 })),
  );
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
};

function renderChat() {
  render(
    <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }} initialEntries={['/chat']}>
      <Routes>
        <Route path="/chat" element={<ChatPage />} />
        <Route path="/login" element={<div>Login page</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

/**
 * The "Chats" header renders while the list is still loading, so waiting for it
 * is not enough. Always wait for the chat item itself.
 */
const openChat = async (name: RegExp) => {
  fireEvent.click(await screen.findByRole('button', { name }));
};

// ── Tests ───────────────────────────────────────────────────────────────────

describe('ChatPage', () => {
  beforeEach(() => {
    getCurrentUserMock.mockReturnValue(chatUser);
    getAuthTokenMock.mockReturnValue('tok-test');
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response('{}', { status: 500 }))));
  });

  afterEach(() => {
    window.sessionStorage.clear();
    vi.unstubAllGlobals();
  });

  it('redirects to /login when there is no user', async () => {
    getCurrentUserMock.mockReturnValue(null);
    renderChat();
    expect(await screen.findByText('Login page')).toBeInTheDocument();
  });

  it('opens an event conversation and sends a message via the chat API', async () => {
    let chatLoads = 0;
    const welcome = {
      id: 1,
      sender_id: 'other-user',
      content: 'Welcome!',
      created_at: '2030-05-01T12:00:00.000Z',
      message_type: 'user',
    };
    const mine = {
      id: 2,
      sender_id: 'u-chat',
      content: 'Hello from test',
      created_at: '2030-05-01T12:05:00.000Z',
      message_type: 'user',
    };

    const fetchMock = stubFetch((url, init) => {
      const list = listRoutes(url, [joinedEvent('evt-1', 'DJ Luna')]);
      if (list) return list;

      if (url.includes('/api/chats/evt-1/messages')) {
        if (init?.method === 'POST') return jsonResponse({ ...mine, event_id: 'evt-1' }, 201);
        chatLoads += 1;
        // First load: just the welcome message. After sending: both messages.
        return jsonResponse({ data: chatLoads === 1 ? [welcome] : [welcome, mine], page: 1, limit: 100 });
      }
      return undefined;
    });

    renderChat();
    await openChat(/DJ Luna/i);

    expect(await screen.findByText('Welcome!')).toBeInTheDocument();

    const input = screen.getByPlaceholderText(/Type a message/i);
    fireEvent.change(input, { target: { value: 'Hello from test' } });
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });

    expect(await screen.findByText('Hello from test')).toBeInTheDocument();
    expect(input).toHaveValue('');

    // The message is sent as { content: <encoded payload> }
    const post = fetchMock.mock.calls.find(([, init]) => init?.method === 'POST');
    expect(post).toBeDefined();
    const body = JSON.parse(String(post![1]!.body));
    expect(JSON.parse(body.content)).toMatchObject({ v: 1, type: 'text', text: 'Hello from test' });
  });

  it('disables interaction when the chat becomes unavailable (403)', async () => {
    stubFetch((url) => {
      const list = listRoutes(url, [joinedEvent('evt-x', 'Locked Event')]);
      if (list) return list;
      if (url.includes('/api/chats/evt-x/messages')) return new Response('{}', { status: 403 });
      return undefined;
    });

    renderChat();
    await openChat(/Locked Event/i);

    await waitFor(() => expect(screen.getByPlaceholderText(/Type a message/i)).toBeDisabled());
    expect(screen.getByText('Chat unavailable')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Send message/i })).toBeDisabled();
  });

  it('makes cancelled event chats read-only', async () => {
    stubFetch((url) => {
      const list = listRoutes(url, [joinedEvent('evt-c', 'Canceled Event', { status: 'cancelled' })]);
      if (list) return list;
      if (url.includes('/api/chats/evt-c/messages')) return jsonResponse({ data: [] });
      return undefined;
    });

    renderChat();

    // Cancelled chats are not in the default "Active" tab
    fireEvent.click(await screen.findByRole('tab', { name: /Cancelled/i }));
    await openChat(/Canceled Event/i);

    const input = await screen.findByPlaceholderText(/Cancelled event chat is read-only/i);
    expect(input).toBeDisabled();
    expect(screen.getByText(/This event was cancelled\. The chat is read-only\./i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Send message/i })).toBeDisabled();
  });

  it('makes past event chats read-only (within the 48h window)', async () => {
    // Ended an hour ago: past, but not yet hidden by the 48h expiry rule
    const hoursAgo = (h: number) => new Date(Date.now() - h * 60 * 60 * 1000).toISOString();

    stubFetch((url) => {
      const list = listRoutes(url, [
        joinedEvent('evt-p', 'Old Gig', { start: hoursAgo(3), end: hoursAgo(1) }),
      ]);
      if (list) return list;
      if (url.includes('/api/chats/evt-p/messages')) return jsonResponse({ data: [] });
      return undefined;
    });

    renderChat();

    fireEvent.click(await screen.findByRole('tab', { name: /Past/i }));
    await openChat(/Old Gig/i);

    const input = await screen.findByPlaceholderText(/Past event chat is read-only/i);
    expect(input).toBeDisabled();
    expect(screen.getByText(/Past event · read-only/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Send message/i })).toBeDisabled();
  });

  it('renders system-generated join/leave messages in the chat', async () => {
    stubFetch((url) => {
      const list = listRoutes(url, [joinedEvent('evt-sys', 'System Event')]);
      if (list) return list;
      if (url.includes('/api/chats/evt-sys/messages')) {
        return jsonResponse({
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
        });
      }
      return undefined;
    });

    renderChat();
    await openChat(/System Event/i);

    expect(await screen.findByText('Alice joined the event')).toBeInTheDocument();
    expect(screen.getByText('Bob left the event')).toBeInTheDocument();
    // System messages never get a sender label or an avatar bubble
    expect(screen.queryByText('Unknown')).not.toBeInTheDocument();
  });
});
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { User } from '@/lib/storage';
import ChatPage from '@/pages/ChatPage';
import { notifyChatMessagesChanged } from '@/lib/realtimeEvents';
import { clearCache } from '@/lib/queryCache';
import { setViewingChatId } from '@/lib/chatUnread';

const { getCurrentUserMock, getAuthTokenMock } = vi.hoisted(() => ({
  getCurrentUserMock: vi.fn<[], User | null>(),
  getAuthTokenMock: vi.fn<[], string | null>(),
}));

vi.mock('@/lib/storage', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@/lib/storage')>();
  return { ...mod, getCurrentUser: () => getCurrentUserMock() };
});
vi.mock('@/components/BottomNav', () => ({ default: () => null }));
vi.mock('@/lib/auth', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@/lib/auth')>();
  return { ...mod, getAuthToken: () => getAuthTokenMock() };
});
vi.mock('@/lib/authProfile', () => ({
  fetchAuthUserFromToken: vi.fn(() => Promise.resolve({ id: 'u-chat', email: 'c@test.com' })),
  sameAuthUserId: (a: string | null | undefined, b: string | null | undefined) =>
    Boolean(a && b && String(a).trim().toLowerCase() === String(b).trim().toLowerCase()),
}));
vi.mock('@/lib/chatLive', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@/lib/chatLive')>();
  return { ...mod, useChatLiveChannels: () => {}, publishLiveChatMessage: () => {} };
});

const chatUser = {
  id: 'u-chat', name: 'Chatter', email: 'c@test.com', role: 'participant' as const, password: 'x', avatar: '',
  profilePhoto: '', coverPhoto: '', bio: '', interests: [], dob: '', gender: '', isPremium: false, friends: [],
  createdAt: '',
} satisfies User;

const urlOf = (input: RequestInfo | URL) =>
  typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const joinedEvent = (id: string, title: string) => ({
  events: {
    id, title, description: 'd', category: 'Music', start_datetime: '2030-05-01T12:00:00.000Z',
    end_datetime: '2030-06-01T12:00:00.000Z', cost: 10, max_capacity: 20, location_name: 'Paris',
    latitude: 0, longitude: 0, created_by: 'org-1', status: 'active',
  },
});

const REMOVED_EVENT_BODY = { detail: { code: 'event_removed', message: 'This event was removed by an administrator.' } };

function stubFetch(handler: (url: string, init?: RequestInit) => Response | undefined) {
  const fn = vi.fn((input: RequestInfo | URL, init?: RequestInit) =>
    Promise.resolve(handler(urlOf(input), init) ?? new Response('{}', { status: 500 })));
  vi.stubGlobal('fetch', fn);
  return fn;
}

const lists = (url: string, joined: ReturnType<typeof joinedEvent>[]) => {
  if (url.includes('/api/participants/my/events')) return jsonResponse(joined);
  if (url.includes('/api/events/my-events')) return jsonResponse({ data: [] });
  return undefined;
};

const row = (id: number, over: Record<string, unknown> = {}) => ({
  id, event_id: 'evt-1', sender_id: 'other-user', sender_name: 'Jane Doe', content: 'Hi all', created_at: '2030-05-01T12:00:00.000Z',
  message_type: 'user', is_removed: false, removed_at: null, ...over,
});

function renderChat(entry = '/chat') {
  return render(
    <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }} initialEntries={[entry]}>
      <Routes>
        <Route path="/chat" element={<ChatPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('Event chat: removed messages and removed events (#327)', () => {
  beforeEach(() => {
    getCurrentUserMock.mockReturnValue(chatUser);
    getAuthTokenMock.mockReturnValue('tok-test');
  });
  afterEach(() => {
    window.sessionStorage.clear();
    localStorage.clear();
    clearCache();
    setViewingChatId(null);
    vi.unstubAllGlobals();
  });

  it("keeps another user's removed message in the chat, replaced by a note, with no report flag", async () => {
    stubFetch((url) => {
      const list = lists(url, [joinedEvent('evt-1', 'DJ Luna')]);
      if (list) return list;
      if (url.includes('/api/chats/evt-1/messages')) {
        return jsonResponse({
          data: [
            row(41, { content: 'Hello everyone' }),
            row(42, { content: '', is_removed: true, removed_at: '2030-05-02T09:15:41Z' }),
            row(43, { content: 'Still here', sender_id: 'third-user', sender_name: 'Sam' }),
          ],
        });
      }
      return undefined;
    });
    renderChat();
    fireEvent.click(await screen.findByRole('button', { name: /DJ Luna/i }));

    // The messages around it stay, and the removed one is in its place as a note.
    expect(await screen.findByText('Hello everyone')).toBeInTheDocument();
    expect(screen.getByText('Still here')).toBeInTheDocument();
    const note = screen.getByTestId('removed-message');
    expect(note).toHaveTextContent('This message was removed by an administrator');
    // Only the two normal messages can be reported.
    expect(screen.getAllByRole('button', { name: 'Report message' })).toHaveLength(2);
  });

  it('shows the note to the sender too, for their own removed message', async () => {
    stubFetch((url) => {
      const list = lists(url, [joinedEvent('evt-1', 'DJ Luna')]);
      if (list) return list;
      if (url.includes('/api/chats/evt-1/messages')) {
        return jsonResponse({ data: [row(50, { sender_id: 'u-chat', content: '', is_removed: true, removed_at: '2030-05-02T09:15:41Z' })] });
      }
      return undefined;
    });
    renderChat();
    fireEvent.click(await screen.findByRole('button', { name: /DJ Luna/i }));
    expect(await screen.findByTestId('removed-message')).toHaveTextContent('This message was removed by an administrator');
  });

  it('turns a message into the note when it is removed while the chat is open', async () => {
    stubFetch((url) => {
      const list = lists(url, [joinedEvent('evt-1', 'DJ Luna')]);
      if (list) return list;
      if (url.includes('/api/chats/evt-1/messages')) return jsonResponse({ data: [row(42, { content: 'Soon gone' })] });
      return undefined;
    });
    renderChat();
    fireEvent.click(await screen.findByRole('button', { name: /DJ Luna/i }));
    expect(await screen.findByText('Soon gone')).toBeInTheDocument();

    await act(async () => {
      notifyChatMessagesChanged('evt-1', row(42, { content: '', is_removed: true, removed_at: '2030-05-02T09:15:41Z' }));
    });

    await waitFor(() => expect(screen.getByTestId('removed-message')).toBeInTheDocument());
    expect(screen.queryByText('Soon gone')).not.toBeInTheDocument();
  });

  it("shows the removal note in a removed event's chat and accepts no new messages", async () => {
    stubFetch((url) => {
      const list = lists(url, [joinedEvent('evt-1', 'DJ Luna')]);
      if (list) return list;
      if (url.includes('/api/chats/evt-1/messages')) return jsonResponse(REMOVED_EVENT_BODY, 410);
      return undefined;
    });
    renderChat();
    fireEvent.click(await screen.findByRole('button', { name: /DJ Luna/i }));

    const note = await screen.findByTestId('chat-removed-note');
    expect(note).toHaveTextContent('This event was removed by an administrator');
    const input = screen.getByPlaceholderText('This event was removed');
    expect(input).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Send message' })).toBeDisabled();
    // A removed event cannot be reported again.
    expect(screen.queryByRole('button', { name: /report event/i })).not.toBeInTheDocument();
  });

  it('opens the removal note when a removed event chat is opened from a link, not an error', async () => {
    stubFetch((url) => {
      const list = lists(url, []);
      if (list) return list;
      if (url.includes('/api/events/evt-gone')) return jsonResponse(REMOVED_EVENT_BODY, 410);
      if (url.includes('/api/chats/evt-gone/messages')) return jsonResponse(REMOVED_EVENT_BODY, 410);
      return undefined;
    });
    renderChat('/chat?eventId=evt-gone');

    const note = await screen.findByTestId('chat-removed-note');
    expect(note).toHaveTextContent('This event was removed by an administrator');
    expect(screen.queryByText(/no longer have access/i)).not.toBeInTheDocument();
    expect(within(screen.getByRole('banner')).getByText('Removed event')).toBeInTheDocument();
  });
});

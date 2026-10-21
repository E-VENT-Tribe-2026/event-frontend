import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import type { User } from '@/lib/storage';
import { invalidatePrefix, peekCache, setCacheEntry, TTL } from '@/lib/queryCache';
import { chatUser, renderChat, buildMyEventsResponse, emptyMyEventsResponse, unhandledResponse } from './chatTestFixtures';

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

type MessageRow = Record<string, unknown>;

/** A message row as the backend returns it: sender_name plus a nested sender summary. */
const otherUserRow = (over: MessageRow = {}): MessageRow => ({
  id: 1,
  event_id: 'evt-1',
  sender_id: 'other-user',
  sender_name: 'Jane Doe',
  sender_role: 'participant',
  sender: { id: 'other-user', username: 'jane_doe', full_name: 'Jane Doe', display_name: 'jane_doe' },
  content: 'Welcome!',
  created_at: '2030-05-01T12:00:00.000Z',
  ...over,
});

/** The saved-copy cache key ChatPage uses for chatUser's messages in evt-1. */
const MESSAGES_CACHE_KEY = '/api/chats/evt-1/messages:u-chat';

const messagesResponse = (rows: MessageRow[]) =>
  new Response(JSON.stringify({ data: rows, page: 1, limit: 100 }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });

/** Pass rows for a fixed reply, or a function to control each messages request. */
function mockChatFetch(messages: MessageRow[] | ((init?: RequestInit) => Promise<Response>)) {
  return vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    if (url.includes('/api/participants/my/events')) {
      return Promise.resolve(buildMyEventsResponse({ id: 'evt-1', title: 'DJ Luna' }));
    }
    if (url.includes('/api/events/my-events')) {
      return Promise.resolve(emptyMyEventsResponse());
    }
    if (url.includes('/api/chats/evt-1/messages')) {
      return typeof messages === 'function' ? messages(init) : Promise.resolve(messagesResponse(messages));
    }
    if (url.includes('/api/events/evt-1')) {
      return Promise.resolve(
        new Response(JSON.stringify({ id: 'evt-1', status: 'active' }), { status: 200, headers: { 'content-type': 'application/json' } }),
      );
    }
    return Promise.resolve(unhandledResponse());
  });
}

describe('ChatPage sender display (#292)', () => {
  beforeEach(() => {
    getCurrentUserMock.mockReturnValue(chatUser);
    getAuthTokenMock.mockReturnValue('tok-test');
  });

  afterEach(() => {
    window.sessionStorage.clear();
    vi.unstubAllGlobals();
  });

  async function openDjLunaChat(waitForText: string) {
    renderChat();
    await waitFor(() => expect(screen.getByText('Chats')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /DJ Luna/i }));
    await waitFor(() => expect(screen.getByText(waitForText)).toBeInTheDocument());
  }

  it("shows only the sender's full name, with no username and no brackets", async () => {
    vi.stubGlobal('fetch', mockChatFetch([otherUserRow()]));
    await openDjLunaChat('Welcome!');
    expect(screen.getByText('Jane Doe')).toBeInTheDocument();
    expect(screen.queryByText(/jane_doe/)).not.toBeInTheDocument();
    expect(screen.queryByText(/\(/)).not.toBeInTheDocument();
  });

  it('still shows the full name for rows that only carry a profiles object', async () => {
    vi.stubGlobal(
      'fetch',
      mockChatFetch([
        { id: 1, sender_id: 'other-user', content: 'Welcome!', created_at: '2030-05-01T12:00:00.000Z', profiles: { full_name: 'Jane Doe', username: 'jane_doe' } },
      ]),
    );
    await openDjLunaChat('Welcome!');
    expect(screen.getByText('Jane Doe')).toBeInTheDocument();
    expect(screen.queryByText(/jane_doe/)).not.toBeInTheDocument();
  });

  it('opens the sender\'s profile page when their profile picture is selected', async () => {
    vi.stubGlobal('fetch', mockChatFetch([otherUserRow()]));
    await openDjLunaChat('Welcome!');
    fireEvent.click(screen.getByRole('button', { name: /Open Jane Doe's profile/i }));
    expect(await screen.findByText('User profile page other-user')).toBeInTheDocument();
  });

  it('shows no sender name and no profile button on your own messages', async () => {
    vi.stubGlobal(
      'fetch',
      mockChatFetch([
        otherUserRow({
          sender_id: 'u-chat',
          sender_name: 'Chatter',
          sender: { id: 'u-chat', username: 'chatter', full_name: 'Chatter' },
          content: 'My own message',
        }),
      ]),
    );
    await openDjLunaChat('My own message');
    expect(screen.queryByText('Chatter')).not.toBeInTheDocument();
    expect(screen.queryByText(/chatter/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /profile/i })).not.toBeInTheDocument();
  });

  it('shows no sender name and no profile button on system messages', async () => {
    vi.stubGlobal(
      'fetch',
      mockChatFetch([
        {
          id: 1,
          event_id: 'evt-1',
          sender_id: null,
          sender_name: 'System',
          sender_role: 'system',
          sender: null,
          type: 'notification',
          content: 'The organizer updated the event',
          created_at: '2030-05-01T12:00:00.000Z',
        },
      ]),
    );
    await openDjLunaChat('The organizer updated the event');
    expect(screen.queryByText('System')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /profile/i })).not.toBeInTheDocument();
  });

  it('shows the saved messages at once on reopen, then replaces them with the server copy', async () => {
    let releaseRefresh: (res: Response) => void = () => {};
    let loads = 0;
    vi.stubGlobal(
      'fetch',
      mockChatFetch(() => {
        loads += 1;
        if (loads === 1) return Promise.resolve(messagesResponse([otherUserRow()]));
        return new Promise<Response>((resolve) => { releaseRefresh = resolve; });
      }),
    );

    await openDjLunaChat('Welcome!');
    fireEvent.click(screen.getByRole('button', { name: /Back to chats/i }));
    fireEvent.click(await screen.findByRole('button', { name: /DJ Luna/i }));

    // The refresh is still pending, yet the saved message is already on screen.
    expect(await screen.findByText('Welcome!')).toBeInTheDocument();
    await waitFor(() => expect(loads).toBe(2)); // the server is asked again on every open

    releaseRefresh(messagesResponse([otherUserRow(), otherUserRow({ id: 2, content: 'Doors open at 8' })]));
    expect(await screen.findByText('Doors open at 8')).toBeInTheDocument();
    expect(peekCache<MessageRow[]>(MESSAGES_CACHE_KEY)).toHaveLength(2); // saved copy replaced too
  });

  it('does not leave the chat stuck loading when you send while the first load is pending', async () => {
    let releaseFirstLoad: (res: Response) => void = () => {};
    let loads = 0;
    const mine = otherUserRow({ id: 2, sender_id: 'u-chat', sender: null, sender_name: 'Chatter', content: 'Sent while loading' });
    vi.stubGlobal(
      'fetch',
      mockChatFetch((init) => {
        if (init?.method === 'POST') return Promise.resolve(messagesResponse([mine]));
        loads += 1;
        if (loads === 1) return new Promise<Response>((resolve) => { releaseFirstLoad = resolve; });
        return Promise.resolve(messagesResponse([otherUserRow(), mine]));
      }),
    );

    const { container } = renderChat();
    fireEvent.click(await screen.findByRole('button', { name: /DJ Luna/i }));
    await waitFor(() => expect(container.querySelector('.shimmer')).not.toBeNull()); // first load still pending

    const input = screen.getByPlaceholderText(/Type a message/i);
    fireEvent.change(input, { target: { value: 'Sent while loading' } });
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });
    expect(await screen.findByText('Sent while loading')).toBeInTheDocument();

    // The older, slower first load finishes last and must not change anything.
    releaseFirstLoad(messagesResponse([otherUserRow()]));
    await waitFor(() => expect(container.querySelector('.shimmer')).toBeNull());
    expect(screen.getByText('Welcome!')).toBeInTheDocument();
    expect(screen.getByText('Sent while loading')).toBeInTheDocument();
  });

  it('never saves a failed messages response', async () => {
    vi.stubGlobal(
      'fetch',
      mockChatFetch(() => Promise.resolve(new Response('{}', { status: 500 }))),
    );

    renderChat();
    fireEvent.click(await screen.findByRole('button', { name: /DJ Luna/i }));
    await waitFor(() => expect(screen.getByText('Offline preview')).toBeInTheDocument());

    expect(peekCache(MESSAGES_CACHE_KEY)).toBeNull();
  });

  it('shows "Chat unavailable" and drops the saved copy when the refresh returns 403', async () => {
    setCacheEntry(MESSAGES_CACHE_KEY, [otherUserRow({ content: 'Old saved message' })], TTL.SHORT);
    vi.stubGlobal(
      'fetch',
      mockChatFetch(() => Promise.resolve(new Response('{}', { status: 403 }))),
    );

    renderChat();
    fireEvent.click(await screen.findByRole('button', { name: /DJ Luna/i }));

    expect(await screen.findByText('Chat unavailable')).toBeInTheDocument();
    expect(screen.queryByText('Old saved message')).not.toBeInTheDocument();
    expect(peekCache(MESSAGES_CACHE_KEY)).toBeNull();
  });

  it('reloads the chat list after it is invalidated, e.g. when you join an event', async () => {
    const fetchMock = mockChatFetch([otherUserRow()]);
    vi.stubGlobal('fetch', fetchMock);
    const listLoads = () =>
      fetchMock.mock.calls.filter(([input]) => String(input).includes('/api/participants/my/events')).length;

    const first = renderChat();
    expect(await screen.findByRole('button', { name: /DJ Luna/i })).toBeInTheDocument();
    first.unmount();

    // Same prefixes EventDetailsPage clears after join/leave and CreateEventPage after publishing.
    invalidatePrefix('/api/participants/my/events');
    invalidatePrefix('/api/events/my-events');

    renderChat();
    expect(await screen.findByRole('button', { name: /DJ Luna/i })).toBeInTheDocument();
    expect(listLoads()).toBe(2);
  });
});

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import type { User } from '@/lib/storage';
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

function mockFetchWithSenderProfile(profiles: { full_name?: string; username?: string } | undefined) {
  return vi.fn((input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    if (url.includes('/api/participants/my/events')) {
      return Promise.resolve(buildMyEventsResponse({ id: 'evt-1', title: 'DJ Luna' }));
    }
    if (url.includes('/api/events/my-events')) {
      return Promise.resolve(emptyMyEventsResponse());
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
    return Promise.resolve(unhandledResponse());
  });
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

  async function openDjLunaChatAndWaitForMessage() {
    renderChat();
    await waitFor(() => expect(screen.getByText('Chats')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /DJ Luna/i }));
    await waitFor(() => expect(screen.getByText('Welcome!')).toBeInTheDocument());
  }

  it('shows "username (Full Name)" for another user\'s message when a username exists', async () => {
    vi.stubGlobal('fetch', mockFetchWithSenderProfile({ full_name: 'Jane Doe', username: 'jane_doe' }));
    await openDjLunaChatAndWaitForMessage();
    expect(screen.getByText('jane_doe (Jane Doe)')).toBeInTheDocument();
  });

  it('falls back to full name alone when the sender has no username yet', async () => {
    vi.stubGlobal('fetch', mockFetchWithSenderProfile({ full_name: 'Jane Doe' }));
    await openDjLunaChatAndWaitForMessage();
    expect(screen.getByText('Jane Doe')).toBeInTheDocument();
    expect(screen.queryByText(/\(/)).not.toBeInTheDocument();
  });
});
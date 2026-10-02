import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchNotifications } from '@/lib/notificationsApi';

// This payload is copied verbatim from the backend dev's example comment on
// ticket #243 (event-backend#146), per the team's new workflow: build
// against the posted example, swap to the live endpoint once it exists.
const EXAMPLE_PAYLOAD = {
  page: 1,
  limit: 20,
  data: [
    {
      id: 301,
      user_id: '8f14e45f-ceea-4e67-a2c3-1c9d0f5b7a21',
      event_id: null,
      type: 'friend_request_received',
      message: 'john_42 sent you a friend request',
      is_read: false,
      created_at: '2026-09-30T09:15:30.123456',
      related_user_id: '5d41402a-bc4b-4a2b-9f6e-3e8c2b7a1d90',
      related_user: {
        id: '5d41402a-bc4b-4a2b-9f6e-3e8c2b7a1d90',
        username: 'john_42',
        full_name: 'John Smith',
        avatar_url: 'https://cdn.example.com/avatars/john_42.jpg',
        avatar_kind: 'photo',
        icon_id: null,
      },
    },
    {
      id: 302,
      user_id: '5d41402a-bc4b-4a2b-9f6e-3e8c2b7a1d90',
      event_id: null,
      type: 'friend_request_accepted',
      message: 'jane_doe accepted your friend request',
      is_read: false,
      created_at: '2026-09-30T11:00:00.000000',
      related_user_id: '8f14e45f-ceea-4e67-a2c3-1c9d0f5b7a21',
      related_user: {
        id: '8f14e45f-ceea-4e67-a2c3-1c9d0f5b7a21',
        username: 'jane_doe',
        full_name: 'Jane Doe',
        avatar_url: null,
        avatar_kind: 'icon',
        icon_id: 'fox',
      },
    },
    {
      id: 280,
      user_id: '8f14e45f-ceea-4e67-a2c3-1c9d0f5b7a21',
      event_id: 'c9f0f895-fb98-4b91-99f5-1fd0297e236d',
      type: 'event_updated',
      message: "Event 'Summer Picnic' was updated by john_42",
      is_read: true,
      created_at: '2026-09-28T08:00:00.000000',
      related_user_id: null,
      related_user: null,
    },
  ],
};

describe('fetchNotifications — ticket #243 friend request types', () => {
    const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('extracts related_user_id and related_user for a friend_request_received row', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify(EXAMPLE_PAYLOAD), { status: 200 })
    );
    const result = await fetchNotifications('token-for-test-1-aaaaaaaaaaaaaaaa');
    const received = result.find((n) => n.type === 'friend_request_received');

    expect(received?.related_user_id).toBe('5d41402a-bc4b-4a2b-9f6e-3e8c2b7a1d90');
    expect(received?.related_user).toEqual({
      id: '5d41402a-bc4b-4a2b-9f6e-3e8c2b7a1d90',
      username: 'john_42',
      full_name: 'John Smith',
      avatar_url: 'https://cdn.example.com/avatars/john_42.jpg',
      avatar_kind: 'photo',
      icon_id: null,
    });
  });

  it('extracts related_user with an icon avatar for a friend_request_accepted row', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify(EXAMPLE_PAYLOAD), { status: 200 })
    );
    const result = await fetchNotifications('token-for-test-2-bbbbbbbbbbbbbbbb');
    const accepted = result.find((n) => n.type === 'friend_request_accepted');

    expect(accepted?.related_user_id).toBe('8f14e45f-ceea-4e67-a2c3-1c9d0f5b7a21');
    expect(accepted?.related_user?.avatar_kind).toBe('icon');
    expect(accepted?.related_user?.icon_id).toBe('fox');
  });

  it('leaves related_user_id/related_user null for existing event notification types', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify(EXAMPLE_PAYLOAD), { status: 200 })
    );
    const result = await fetchNotifications('token-for-test-3-cccccccccccccccc');
    const eventNotif = result.find((n) => n.type === 'event_updated');

    expect(eventNotif?.related_user_id).toBeNull();
    expect(eventNotif?.related_user).toBeNull();
    // Existing event-linking behaviour must be untouched (ticket requirement:
    // "keep the existing notification types... as they are today").
    expect(eventNotif?.related_event_id).toBe('c9f0f895-fb98-4b91-99f5-1fd0297e236d');
  });
});

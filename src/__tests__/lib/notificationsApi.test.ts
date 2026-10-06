import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchNotifications } from '@/lib/notificationsApi';

// Payload copied from the backend dev's example on ticket #243 (event-backend#146):
// build against the posted example, then switch to the live endpoint.
const EXAMPLE_PAYLOAD = {
  page: 1,
  limit: 20,
  data: [
    {
      id: 301,
      event_id: null,
      type: 'friend_request_received',
      message: 'john_42 sent you a friend request',
      is_read: false,
      created_at: '2026-09-30T09:15:30.123456',
      related_user_id: '5d41402a-bc4b-4a2b-9f6e-3e8c2b7a1d90',
      related_user: { id: '5d41402a-bc4b-4a2b-9f6e-3e8c2b7a1d90', username: 'john_42', full_name: 'John Smith' },
    },
    {
      id: 302,
      event_id: null,
      type: 'friend_request_accepted',
      message: 'jane_doe accepted your friend request',
      is_read: false,
      created_at: '2026-09-30T11:00:00.000000',
      related_user_id: '8f14e45f-ceea-4e67-a2c3-1c9d0f5b7a21',
      related_user: { id: '8f14e45f-ceea-4e67-a2c3-1c9d0f5b7a21', username: 'jane_doe', full_name: 'Jane Doe' },
    },
    {
      id: 280,
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
  afterEach(() => vi.unstubAllGlobals());

  async function load(token: string) {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(EXAMPLE_PAYLOAD), { status: 200 }));
    return fetchNotifications(token);
  }

  it('keeps the other user\'s id on a friend_request_received row', async () => {
    const rows = await load('token-for-test-1-aaaaaaaaaaaaaaaa');
    const received = rows.find((n) => n.type === 'friend_request_received');
    expect(received?.related_user_id).toBe('5d41402a-bc4b-4a2b-9f6e-3e8c2b7a1d90');
  });

  it('keeps the other user\'s id on a friend_request_accepted row', async () => {
    const rows = await load('token-for-test-2-bbbbbbbbbbbbbbbb');
    const accepted = rows.find((n) => n.type === 'friend_request_accepted');
    expect(accepted?.related_user_id).toBe('8f14e45f-ceea-4e67-a2c3-1c9d0f5b7a21');
  });

  it('leaves related_user_id empty and the event link intact on an existing event notification', async () => {
    const rows = await load('token-for-test-3-cccccccccccccccc');
    const eventRow = rows.find((n) => n.type === 'event_updated');
    expect(eventRow?.related_user_id).toBeNull();
    expect(eventRow?.related_event_id).toBe('c9f0f895-fb98-4b91-99f5-1fd0297e236d');
  });
});

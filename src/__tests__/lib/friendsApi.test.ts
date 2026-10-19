import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { setAuthToken } from '@/lib/auth';
import {
  FRIENDS_CHANGED_EVENT,
  acceptFriendRequest,
  blockUser,
  fetchBlockedUsers,
  fetchFriends,
  parseFriendsError,
  searchUsers,
  sendFriendRequest,
  unblockUser,
  userAvatarUrl,
  userProfilePath,
} from '@/lib/friendsApi';
import { PROFILE_ICONS } from '@/lib/profileAssets';

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

const jane = {
  id: '8f14e45f-ceea-4e67-a2c3-1c9d0f5b7a21',
  username: 'jane_doe',
  full_name: 'Jane Doe',
  display_name: 'jane_doe',
  avatar_kind: 'icon',
  icon_id: 'sun',
  avatar_url: null,
};

describe('userAvatarUrl', () => {
  it('uses the uploaded photo when avatar_kind is photo', () => {
    expect(userAvatarUrl({ avatar_kind: 'photo', icon_id: 'sun', avatar_url: 'https://cdn/x.jpg' })).toBe('https://cdn/x.jpg');
  });

  it('uses the icon from the icon set when avatar_kind is icon', () => {
    const sun = PROFILE_ICONS.find((i) => i.id === 'sun')!;
    expect(userAvatarUrl({ avatar_kind: 'icon', icon_id: 'sun', avatar_url: null })).toBe(sun.url);
  });

  it('falls back to avatar_url for an unknown icon', () => {
    expect(userAvatarUrl({ avatar_kind: 'icon', icon_id: 'owl', avatar_url: 'https://cdn/owl.svg' })).toBe('https://cdn/owl.svg');
  });
});

describe('userProfilePath', () => {
  it('opens the own Profile tab for the signed-in user', () => {
    expect(userProfilePath('me', 'me')).toBe('/profile');
  });

  it('opens another user profile page otherwise', () => {
    expect(userProfilePath('other', 'me')).toBe('/user/other');
  });
});

describe('parseFriendsError', () => {
  it('shows the backend message for friendship errors', () => {
    const err = parseFriendsError(409, {
      detail: { code: 'request_already_received', message: 'This user has already sent you a friend request.', request_id: 57 },
    });
    expect(err.message).toBe('This user has already sent you a friend request.');
    expect(err.code).toBe('request_already_received');
    expect(err.requestId).toBe(57);
  });

  it('shows a plain-string detail', () => {
    expect(parseFriendsError(403, { detail: 'This profile is private' }).message).toBe('This profile is private');
  });

  it('does not show a raw 422 detail list', () => {
    const err = parseFriendsError(422, { detail: [{ loc: ['query', 'q'], msg: 'too short', type: 'x' }] });
    expect(err.message).toBe('The request was not valid. Please try again.');
  });

  it('explains a blocked friend request without exposing a raw code', () => {
    const err = parseFriendsError(403, { detail: { code: 'user_blocked' } });
    expect(err.code).toBe('user_blocked');
    expect(err.message).toBe('You cannot send a friend request to this user.');
  });
});

describe('friendship requests and caching', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    setAuthToken('token-abc');
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllGlobals();
  });

  it('sends the bearer token', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ page: 1, limit: 20, has_more: false, data: [] }));
    await fetchFriends();
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain('/api/friends?page=1&limit=20');
    expect(init.headers.Authorization).toBe('Bearer token-abc');
  });

  it('serves the friends list from the cache, and refetches after a mutation', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ page: 1, limit: 20, has_more: false, data: [] }));
    await fetchFriends();
    await fetchFriends();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const changed = vi.fn();
    window.addEventListener(FRIENDS_CHANGED_EVENT, changed);
    fetchMock.mockResolvedValueOnce(jsonResponse({ friend_since: '2026-09-30T11:00:00Z', user: jane }));
    await acceptFriendRequest(57);
    window.removeEventListener(FRIENDS_CHANGED_EVENT, changed);
    expect(changed).toHaveBeenCalledTimes(1);

    await fetchFriends();
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('caches search pages per query', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ page: 1, limit: 10, has_more: true, data: [{ ...jane }] }));
    const first = await searchUsers('JANE');
    await searchUsers('JANE');
    expect(first.has_more).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toContain('/api/profile/search?q=JANE&page=1&limit=10');
  });

  it('blocks a user via POST /api/blocks and invalidates the friends cache', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ blocked_at: '2026-10-15T12:00:00Z', user: jane }, 201));
    const result = await blockUser(jane.id);
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain('/api/blocks');
    expect(String(url)).not.toContain(`/api/blocks/${jane.id}`);
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({ user_id: jane.id });
    expect(result.blocked_at).toBe('2026-10-15T12:00:00Z');
    expect(result.user.id).toBe(jane.id);
  });

  it('lists blocked users from GET /api/blocks', async () => {
    fetchMock.mockResolvedValue(jsonResponse({
      page: 1, limit: 20, has_more: false,
      data: [{ blocked_at: '2026-10-15T12:00:00Z', user: jane }],
    }));
    const page = await fetchBlockedUsers();
    expect(String(fetchMock.mock.calls[0][0])).toContain('/api/blocks?page=1&limit=20');
    expect(page.data[0].user.username).toBe('jane_doe');
  });

  it('unblocks a user via DELETE /api/blocks/{user_id}', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ message: 'User unblocked' }));
    await unblockUser(jane.id);
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain(`/api/blocks/${jane.id}`);
    expect(init.method).toBe('DELETE');
  });

  it('refuses a friend request to a blocked user with 403 user_blocked', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ detail: { code: 'user_blocked' } }, 403));
    await expect(sendFriendRequest(jane.id)).rejects.toMatchObject({
      code: 'user_blocked',
      status: 403,
      message: 'You cannot send a friend request to this user.',
    });
  });

  it('throws the backend reason when an action is refused', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ detail: { code: 'request_not_found', message: 'Friend request not found.', request_id: null } }, 404),
    );
    await expect(acceptFriendRequest(1)).rejects.toThrow('Friend request not found.');
  });
});

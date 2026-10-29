import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useFriendsGoing, useFriendsGoingEvents } from '@/hooks/useFriendsGoing';
import { setAuthToken } from '@/lib/auth';
import { notifyEventsChanged } from '@/lib/realtimeEvents';
import type { UserSummary } from '@/lib/friendsApi';
import type { EventItem } from '@/lib/storage';

const { fetchAllFriendsMock, fetchEventParticipantsMock, fetchFriendsAttendingMock, fetchUserProfileMock } = vi.hoisted(() => ({
  fetchAllFriendsMock: vi.fn(),
  fetchEventParticipantsMock: vi.fn(),
  fetchFriendsAttendingMock: vi.fn(),
  fetchUserProfileMock: vi.fn(),
}));

vi.mock('@/lib/eventSocial', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@/lib/eventSocial')>();
  return {
    ...mod,
    fetchAllFriends: () => fetchAllFriendsMock(),
    fetchEventParticipants: (eventId: string) => fetchEventParticipantsMock(eventId),
  };
});

vi.mock('@/lib/eventAttendeesApi', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@/lib/eventAttendeesApi')>();
  return {
    ...mod,
    fetchFriendsAttending: (eventId: string, token: string | null) => fetchFriendsAttendingMock(eventId, token),
  };
});

vi.mock('@/lib/userProfileApi', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@/lib/userProfileApi')>();
  return {
    ...mod,
    fetchUserProfile: (userId: string) => fetchUserProfileMock(userId),
  };
});

const friend: UserSummary = {
  id: 'f1',
  username: 'maya',
  full_name: 'Maya',
  display_name: 'Maya',
  avatar_kind: 'icon',
  icon_id: 'sun',
  avatar_url: null,
};

describe('useFriendsGoing', () => {
  beforeEach(() => {
    setAuthToken('going-token');
    fetchAllFriendsMock.mockReset();
    fetchEventParticipantsMock.mockReset();
    fetchAllFriendsMock.mockResolvedValue([friend]);
    fetchEventParticipantsMock.mockResolvedValue([]);
  });

  it('reloads attendees when events change in realtime', async () => {
    const { result } = renderHook(() => useFriendsGoing('evt-1'));

    await waitFor(() => {
      expect(fetchEventParticipantsMock).toHaveBeenCalledWith('evt-1');
    });
    expect(result.current.friends).toEqual([]);

    fetchEventParticipantsMock.mockResolvedValue([{ user_id: 'f1', status: 'going' }]);
    notifyEventsChanged();

    await waitFor(() => {
      expect(result.current.friends.map((f) => f.id)).toEqual(['f1']);
    });
    expect(fetchEventParticipantsMock.mock.calls.length).toBeGreaterThan(1);
  });
});

const event = {
  id: 'evt-jazz',
  title: 'Quiet Jazz Night',
  description: '',
  category: 'Music',
  date: '2030-06-15',
  time: '18:00',
  location: 'Paris',
  lat: 0,
  lng: 0,
  budget: 0,
  participantsLimit: 20,
  participants: [],
  image: '',
  organizer: 'Maya',
  organizerId: 'u1',
  organizerAvatar: '',
  isPrivate: false,
  isDraft: false,
  requiresApproval: false,
  reviews: [],
  reports: [],
  collaborators: [],
  friendsAttendingCount: 1,
} as EventItem;

describe('useFriendsGoingEvents', () => {
  beforeEach(() => {
    setAuthToken('going-token');
    fetchAllFriendsMock.mockReset();
    fetchFriendsAttendingMock.mockReset();
    fetchUserProfileMock.mockReset();
    fetchAllFriendsMock.mockResolvedValue([friend]);
    fetchFriendsAttendingMock.mockResolvedValue([]);
    fetchUserProfileMock.mockResolvedValue({ id: 'f1', avatar_url: null, avatar_kind: null, icon_id: null });
  });

  it('uses the friends-attending endpoint so events you have not joined still appear', async () => {
    fetchFriendsAttendingMock.mockResolvedValue([
      { user_id: 'f1', is_friend: true, user: friend },
    ]);
    const { result } = renderHook(() => useFriendsGoingEvents([event]));

    await waitFor(() => {
      expect(result.current.rows).toHaveLength(1);
    });
    expect(fetchFriendsAttendingMock).toHaveBeenCalledWith('evt-jazz', 'going-token');
    expect(result.current.rows[0].event.title).toBe('Quiet Jazz Night');
    expect(result.current.rows[0].friends.map((f) => f.full_name)).toEqual(['Maya']);
  });

  it('still lists an event when the friends-attending count is set even if names fail to parse', async () => {
    fetchFriendsAttendingMock.mockResolvedValue([{ not: 'a user' }]);
    const { result } = renderHook(() => useFriendsGoingEvents([event]));

    await waitFor(() => {
      expect(result.current.rows).toHaveLength(1);
    });
    expect(result.current.rows[0].event.title).toBe('Quiet Jazz Night');
    expect(result.current.rows[0].friends).toEqual([]);
  });

  it('merges every friend’s upcoming events instead of stopping at the first counted homepage event', async () => {
    const alex: UserSummary = {
      id: 'f2',
      username: 'alex',
      full_name: 'Alex',
      display_name: 'Alex',
      avatar_kind: 'icon',
      icon_id: 'moon',
      avatar_url: null,
    };
    fetchAllFriendsMock.mockResolvedValue([friend, alex]);
    fetchFriendsAttendingMock.mockResolvedValue([
      { user_id: 'f1', is_friend: true, user: friend },
    ]);
    fetchUserProfileMock.mockImplementation(async (id: string) => {
      if (id === 'f1') {
        return {
          id: 'f1',
          avatar_url: null,
          avatar_kind: null,
          icon_id: null,
          joined_events: {
            upcoming: [{
              id: 'evt-jazz',
              title: 'Quiet Jazz Night',
              start_datetime: '2030-06-15T18:00:00.000Z',
            }],
          },
        };
      }
      return {
        id: 'f2',
        avatar_url: null,
        avatar_kind: null,
        icon_id: null,
        events: {
          joined: {
            upcoming: [
              {
                id: 'evt-jazz',
                title: 'Quiet Jazz Night',
                start_datetime: '2030-06-15T18:00:00.000Z',
              },
              {
                id: 'evt-brunch',
                title: 'Sunday Brunch',
                category: 'Food',
                start_datetime: '2030-06-20T11:00:00.000Z',
                location_name: 'Paris',
              },
            ],
          },
        },
      };
    });

    const { result } = renderHook(() => useFriendsGoingEvents([event]));

    await waitFor(() => {
      expect(result.current.rows).toHaveLength(2);
    });
    const jazz = result.current.rows.find((row) => row.event.id === 'evt-jazz');
    const brunch = result.current.rows.find((row) => row.event.id === 'evt-brunch');
    expect(jazz?.friends.map((f) => f.id).sort()).toEqual(['f1', 'f2']);
    expect(brunch?.event.title).toBe('Sunday Brunch');
    expect(brunch?.friends.map((f) => f.id)).toEqual(['f2']);
  });

  it("falls back to friends' upcoming joined events when the homepage list has no friends-attending counts", async () => {
    fetchUserProfileMock.mockResolvedValue({
      id: 'f1',
      avatar_url: null,
      avatar_kind: null,
      icon_id: null,
      events: {
        joined: {
          upcoming: [{
            id: 'evt-brunch',
            title: 'Sunday Brunch',
            category: 'Food',
            start_datetime: '2030-06-20T11:00:00.000Z',
            location_name: 'Paris',
          }],
        },
      },
    });
    const quietNight = { ...event, friendsAttendingCount: 0 };
    const { result } = renderHook(() => useFriendsGoingEvents([quietNight]));

    await waitFor(() => {
      expect(result.current.rows).toHaveLength(1);
    });
    expect(fetchFriendsAttendingMock).not.toHaveBeenCalled();
    expect(fetchUserProfileMock).toHaveBeenCalledWith('f1');
    expect(result.current.rows[0].event.title).toBe('Sunday Brunch');
    expect(result.current.rows[0].friends.map((f) => f.id)).toEqual(['f1']);
  });
});

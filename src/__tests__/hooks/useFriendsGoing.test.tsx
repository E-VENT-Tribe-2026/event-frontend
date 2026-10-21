import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useFriendsGoing } from '@/hooks/useFriendsGoing';
import { setAuthToken } from '@/lib/auth';
import { notifyEventsChanged } from '@/lib/realtimeEvents';
import type { UserSummary } from '@/lib/friendsApi';

const { fetchAllFriendsMock, fetchEventParticipantsMock } = vi.hoisted(() => ({
  fetchAllFriendsMock: vi.fn(),
  fetchEventParticipantsMock: vi.fn(),
}));

vi.mock('@/lib/eventSocial', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@/lib/eventSocial')>();
  return {
    ...mod,
    fetchAllFriends: () => fetchAllFriendsMock(),
    fetchEventParticipants: (eventId: string) => fetchEventParticipantsMock(eventId),
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

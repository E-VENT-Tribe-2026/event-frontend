import { describe, it, expect } from 'vitest';
import type { UserSummary } from '@/lib/friendsApi';
import { friendsGoingLabel, friendsGoingToEvent, goingParticipantIds, parseFriendsList, parseParticipants } from '@/lib/eventSocial';

const friend = (id: string, name: string): UserSummary => ({
  id,
  username: name.toLowerCase(),
  full_name: name,
  display_name: name,
  avatar_kind: 'icon',
  icon_id: 'sun',
  avatar_url: null,
});

describe('eventSocial', () => {
  it('parses participant lists from wrapped or raw arrays', () => {
    const raw = parseParticipants([
      { user_id: 'a', status: 'going' },
      { user: { id: 'b' }, status: 'removed' },
    ]);
    expect(goingParticipantIds(raw)).toEqual(['a']);
    expect(parseParticipants({ data: [{ user_id: 'c' }] }).map((p) => p.user_id)).toEqual(['c']);
    expect(parseParticipants({ participants: [{ profile_id: 'd' }] }).map((p) => p.user_id)).toEqual(['d']);
  });

  it('parses friends from several backend list shapes', () => {
    expect(parseFriendsList({ data: [{ user: { id: 'f1', full_name: 'Maya' } }] }).map((f) => f.id)).toEqual(['f1']);
    expect(parseFriendsList({ friends: [{ id: 'f2', name: 'Alex' }] }).map((f) => f.full_name)).toEqual(['Alex']);
  });

  it('matches friends who are going, ignoring case', () => {
    const matched = friendsGoingToEvent(
      [friend('F1', 'Maya'), friend('f2', 'Alex'), friend('f3', 'Sam')],
      ['f1', 'x'],
    );
    expect(matched.map((f) => f.full_name)).toEqual(['Maya']);
  });

  it('builds a readable friends-going label', () => {
    expect(friendsGoingLabel([friend('1', 'Maya')])).toBe('Maya is going');
    expect(friendsGoingLabel([friend('1', 'Maya'), friend('2', 'Alex')])).toBe('Maya and Alex are going');
    expect(friendsGoingLabel([friend('1', 'Maya'), friend('2', 'Alex'), friend('3', 'Sam')])).toBe(
      'Maya and 2 friends are going',
    );
  });
});

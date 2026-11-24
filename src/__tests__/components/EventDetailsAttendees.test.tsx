import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import EventDetailsAttendees from '@/pages/eventDetails/EventDetailsAttendees';
import type { AttendeeRow } from '@/pages/eventDetails/eventDetailsModel';

function rows(count: number): AttendeeRow[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `u${i + 1}`,
    name: `Person ${i + 1}`,
    username: `p${i + 1}`,
  }));
}

function renderList(attendees: AttendeeRow[]) {
  return render(
    <EventDetailsAttendees
      eventId="evt-1"
      currentUserId="u1"
      canViewFullAttendeeList
      canInviteFriends={false}
      showInviteDialog={false}
      onInviteDialogChange={() => {}}
      participationKnown
      useApiParticipation
      apiParticipantsEmpty={false}
      fullAttendeeRows={attendees}
      attendingFriends={[]}
      attendeeDisplayCount={attendees.length}
      isEventOwner={false}
      isCancelledEvent={false}
      isPastEvent={false}
      removingParticipantId={null}
      onRemove={vi.fn()}
    />,
  );
}

describe('EventDetailsAttendees preview', () => {
  it('lists everyone when there are five or fewer attendees', () => {
    renderList(rows(5));
    expect(screen.getByText('Person 1')).toBeInTheDocument();
    expect(screen.getByText('Person 5')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /see more/i })).not.toBeInTheDocument();
  });

  it('shows five attendees and See more, then expands the rest', () => {
    renderList(rows(7));
    expect(screen.getByText('Person 5')).toBeInTheDocument();
    expect(screen.queryByText('Person 6')).not.toBeInTheDocument();
    expect(screen.queryByText('Person 7')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /see more/i }));
    expect(screen.getByText('Person 6')).toBeInTheDocument();
    expect(screen.getByText('Person 7')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /see less/i }));
    expect(screen.queryByText('Person 6')).not.toBeInTheDocument();
  });
});

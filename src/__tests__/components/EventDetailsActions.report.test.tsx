import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import EventDetailsActions from '@/pages/eventDetails/EventDetailsActions';

vi.mock('@/components/ReportContentDialog', () => ({
  default: ({ open }: { open: boolean }) => (open ? <div>Report this event</div> : null),
}));

const base = {
  signedIn: true,
  canAccessEventChat: true,
  isCancelledEvent: false,
  isChatExpired: false,
  isEventOwner: false,
  isEventPassed: false,
  isPastEvent: false,
  isAtCapacity: false,
  isOrganizer: false,
  hasJoined: true,
  participationLoading: false,
  isUpdatingParticipation: false,
  isCancellingEvent: false,
  showSplitJoinLeave: false,
  useApiParticipation: true,
  requiresApproval: false,
  isFreeEvent: true,
  requestRejected: false,
  joinLabel: 'Leave event',
  onOpenChat: () => {},
  onEdit: () => {},
  onCancelEvent: () => {},
  onJoin: () => {},
  onLeave: () => {},
  eventId: 'evt-1',
};

describe('EventDetailsActions report', () => {
  it('lets a signed-in attendee open report event', () => {
    render(<EventDetailsActions {...base} />);
    fireEvent.click(screen.getByRole('button', { name: /report event/i }));
    expect(screen.getByText('Report this event')).toBeInTheDocument();
  });

  it('hides report for the event owner', () => {
    render(<EventDetailsActions {...base} isEventOwner />);
    expect(screen.queryByRole('button', { name: /report event/i })).not.toBeInTheDocument();
  });
});

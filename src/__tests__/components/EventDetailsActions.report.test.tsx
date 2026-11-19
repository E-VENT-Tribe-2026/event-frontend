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
  it('shows a "Report" button with the red flag and opens the report window', () => {
    render(<EventDetailsActions {...base} />);
    const button = screen.getByRole('button', { name: /^report$/i });
    expect(button).toHaveTextContent('Report');
    expect(button.querySelector('[data-testid="report-flag"]')).toHaveClass('text-red-500');
    fireEvent.click(button);
    expect(screen.getByText('Report this event')).toBeInTheDocument();
  });

  it('hides report for the event owner', () => {
    render(<EventDetailsActions {...base} isEventOwner />);
    expect(screen.queryByRole('button', { name: /^report$/i })).not.toBeInTheDocument();
  });
});

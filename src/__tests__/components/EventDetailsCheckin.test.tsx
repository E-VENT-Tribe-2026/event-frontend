import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import EventDetailsCheckin from '@/pages/eventDetails/EventDetailsCheckin';
import type { EventCheckinSummary } from '@/lib/checkinsApi';

const start = Date.parse('2030-01-01T18:00:00.000Z');

const organizerSummary: EventCheckinSummary = {
  code: '482193',
  qr_content: '482193',
  checked_in_count: 12,
  participant_count: 30,
  viewer_checked_in: false,
  include_times: true,
  checkins: [
    { user_id: 'u1', full_name: 'Ada Lovelace', username: 'ada', checked_in_at: '2030-01-01T18:05:00.000Z' },
  ],
};

const participantSummary: EventCheckinSummary = {
  checked_in_count: 12,
  participant_count: 30,
  viewer_checked_in: false,
  include_times: false,
  checkins: [{ user_id: 'u1', full_name: 'Ada Lovelace', username: 'ada' }],
};

describe('EventDetailsCheckin', () => {
  it('shows the organizer the QR, six-digit code, count, and check-in time', () => {
    render(
      <EventDetailsCheckin
        eventStartMs={start}
        currentUserId="org-1"
        isEventOwner
        hasJoined={false}
        summary={organizerSummary}
        checkinBusy={false}
        onSubmitCode={vi.fn()}
      />,
    );

    expect(screen.getByText('12 of 30 here')).toBeInTheDocument();
    expect(screen.getByTestId('checkin-code')).toHaveTextContent('482193');
    expect(screen.getByLabelText('Event check-in QR code')).toBeInTheDocument();
    expect(screen.getByText('Ada Lovelace')).toBeInTheDocument();
    expect(screen.queryByLabelText('Check-in code')).not.toBeInTheDocument();
  });

  it('lets a participant type the code and hides times', () => {
    const onSubmit = vi.fn();
    vi.spyOn(Date, 'now').mockReturnValue(start - 60 * 60 * 1000);

    render(
      <EventDetailsCheckin
        eventStartMs={start}
        currentUserId="u-me"
        isEventOwner={false}
        hasJoined
        summary={participantSummary}
        checkinBusy={false}
        onSubmitCode={onSubmit}
      />,
    );

    expect(screen.getByText('12 of 30 here')).toBeInTheDocument();
    expect(screen.queryByTestId('checkin-code')).not.toBeInTheDocument();
    expect(screen.getByText('Ada Lovelace')).toBeInTheDocument();
    expect(screen.getByText(/checked in/i)).toBeInTheDocument();
    expect(screen.getByLabelText('Check-in code')).toBeEnabled();

    fireEvent.change(screen.getByLabelText('Check-in code'), { target: { value: '482193' } });
    fireEvent.click(screen.getByRole('button', { name: /^check in$/i }));
    expect(onSubmit).toHaveBeenCalledWith('482193', 'code');

    vi.mocked(Date.now).mockRestore();
  });

  it('disables participant check-in until 2 hours before the event and shows an info control', () => {
    vi.spyOn(Date, 'now').mockReturnValue(start - 3 * 60 * 60 * 1000);
    const onSubmit = vi.fn();

    render(
      <EventDetailsCheckin
        eventStartMs={start}
        currentUserId="u-me"
        isEventOwner={false}
        hasJoined
        summary={participantSummary}
        checkinBusy={false}
        onSubmitCode={onSubmit}
      />,
    );

    expect(screen.getByRole('button', { name: /check-in opens 2 hours before the event/i })).toBeInTheDocument();
    expect(screen.getByLabelText('Check-in code')).toBeDisabled();
    expect(screen.getByRole('button', { name: /^check in$/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /scan qr code/i })).toBeDisabled();

    fireEvent.submit(screen.getByLabelText('Check-in code').closest('form') as HTMLFormElement);
    expect(onSubmit).not.toHaveBeenCalled();

    vi.mocked(Date.now).mockRestore();
  });
});

import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import EventDetailsBalloonLoader, {
  EVENT_BALLOON_CONFETTI_MS,
} from '@/pages/eventDetails/EventDetailsBalloonLoader';

describe('EventDetailsBalloonLoader', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows a growing balloon while the event is loading', () => {
    render(<EventDetailsBalloonLoader ready={false} onBurstDone={() => {}} />);
    expect(screen.getByTestId('event-balloon-loader')).toHaveAttribute('aria-label', 'Loading event');
    expect(screen.getByText('Loading')).toBeInTheDocument();
  });

  it('keeps the burst on screen for at least a second after data is ready', () => {
    expect(EVENT_BALLOON_CONFETTI_MS).toBeGreaterThanOrEqual(1000);
  });

  it('tells the page it can open as soon as the event is ready in tests', () => {
    const onBurstDone = vi.fn();
    const { rerender } = render(<EventDetailsBalloonLoader ready={false} onBurstDone={onBurstDone} />);
    expect(onBurstDone).not.toHaveBeenCalled();
    rerender(<EventDetailsBalloonLoader ready onBurstDone={onBurstDone} />);
    expect(onBurstDone).toHaveBeenCalled();
  });
});

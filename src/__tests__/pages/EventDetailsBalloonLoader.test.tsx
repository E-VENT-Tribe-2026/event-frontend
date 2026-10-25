import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import EventDetailsBalloonLoader from '@/pages/eventDetails/EventDetailsBalloonLoader';

describe('EventDetailsBalloonLoader', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows a growing balloon while the event is loading', () => {
    render(<EventDetailsBalloonLoader ready={false} onBurstDone={() => {}} />);
    expect(screen.getByTestId('event-balloon-loader')).toHaveAttribute('aria-label', 'Loading event');
    expect(screen.getByText('Inflating…')).toBeInTheDocument();
  });

  it('bursts and then tells the page it can open', () => {
    vi.useFakeTimers();
    const onBurstDone = vi.fn();
    const { rerender } = render(<EventDetailsBalloonLoader ready={false} onBurstDone={onBurstDone} />);
    rerender(<EventDetailsBalloonLoader ready onBurstDone={onBurstDone} />);
    expect(onBurstDone).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(onBurstDone).toHaveBeenCalled();
  });
});

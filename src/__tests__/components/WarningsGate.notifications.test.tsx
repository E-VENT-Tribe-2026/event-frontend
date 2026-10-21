import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import WarningsGate from '@/components/WarningsGate';
import { setAuthToken, clearAuthToken } from '@/lib/auth';
import { NOTIFICATIONS_CHANGED_EVENT } from '@/lib/notificationsApi';
import { acknowledgeWarning, fetchPendingWarnings, type UserWarning } from '@/lib/warningsApi';

vi.mock('@/lib/warningsApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/warningsApi')>()),
  fetchPendingWarnings: vi.fn(),
  acknowledgeWarning: vi.fn(),
}));

const { invalidateMock } = vi.hoisted(() => ({ invalidateMock: vi.fn() }));
vi.mock('@/lib/queries', () => ({
  invalidateNotifications: () => invalidateMock(),
}));

const fetchPending = vi.mocked(fetchPendingWarnings);
const acknowledge = vi.mocked(acknowledgeWarning);

const first: UserWarning = { id: '7', reason: 'First reason' };

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => { resolve = r; });
  return { promise, resolve };
}

function notificationsChanged() {
  act(() => { window.dispatchEvent(new CustomEvent(NOTIFICATIONS_CHANGED_EVENT)); });
}

describe('WarningsGate — notifications (ticket #294 Part 4)', () => {
  beforeEach(() => {
    fetchPending.mockReset();
    acknowledge.mockReset();
    invalidateMock.mockReset();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    clearAuthToken();
  });

  it('shows a new warning at once when the notifications change', async () => {
    setAuthToken('token-abc');
    fetchPending.mockResolvedValueOnce([]).mockResolvedValueOnce([first]);
    render(<WarningsGate />);
    await waitFor(() => expect(fetchPending).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();

    notificationsChanged();
    expect(fetchPending).toHaveBeenCalledTimes(2);
    expect(await screen.findByText('First reason')).toBeInTheDocument();
  });

  it('does not check while a warning is showing', async () => {
    setAuthToken('token-abc');
    fetchPending.mockResolvedValue([first]);
    render(<WarningsGate />);
    await screen.findByText('First reason');

    notificationsChanged();
    notificationsChanged();
    expect(fetchPending).toHaveBeenCalledTimes(1);
  });

  it('does not start a second check while one is in flight', async () => {
    setAuthToken('token-abc');
    const pending = deferred<UserWarning[]>();
    fetchPending.mockReturnValue(pending.promise);
    render(<WarningsGate />);
    expect(fetchPending).toHaveBeenCalledTimes(1);

    notificationsChanged();
    expect(fetchPending).toHaveBeenCalledTimes(1);
    await act(async () => pending.resolve([]));
  });

  it('does nothing when nobody is signed in', () => {
    render(<WarningsGate />);
    notificationsChanged();
    expect(fetchPending).not.toHaveBeenCalled();
  });

  it('refreshes the notification list after a successful acknowledgement, without re-checking', async () => {
    setAuthToken('token-abc');
    fetchPending.mockResolvedValue([first]);
    acknowledge.mockResolvedValue();
    // The real invalidateNotifications fires the change event; simulate that.
    invalidateMock.mockImplementation(() => window.dispatchEvent(new CustomEvent(NOTIFICATIONS_CHANGED_EVENT)));
    render(<WarningsGate />);

    fireEvent.click(await screen.findByRole('button', { name: 'I understand' }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    expect(invalidateMock).toHaveBeenCalledTimes(1);
    // The event arrived while the warning still counted as showing: no new check.
    expect(fetchPending).toHaveBeenCalledTimes(1);
  });

  it('does not refresh the list when acknowledging fails', async () => {
    setAuthToken('token-abc');
    fetchPending.mockResolvedValue([first]);
    acknowledge.mockRejectedValue(new Error('Failed to acknowledge warning (500)'));
    render(<WarningsGate />);

    fireEvent.click(await screen.findByRole('button', { name: 'I understand' }));
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(invalidateMock).not.toHaveBeenCalled();
  });

  it('stops listening after unmount', async () => {
    setAuthToken('token-abc');
    fetchPending.mockResolvedValue([]);
    const { unmount } = render(<WarningsGate />);
    await waitFor(() => expect(fetchPending).toHaveBeenCalledTimes(1));
    unmount();

    notificationsChanged();
    expect(fetchPending).toHaveBeenCalledTimes(1);
  });
});

import { useEffect } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import WarningsGate from '@/components/WarningsGate';
import { setAuthToken, clearAuthToken } from '@/lib/auth';
import { acknowledgeWarning, fetchPendingWarnings, WarningsApiError, type UserWarning } from '@/lib/warningsApi';

// The wire contract is the backend contract tested in warningsApi.test.ts; here the
// gate is tested against the API module's interface only.
vi.mock('@/lib/warningsApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/warningsApi')>()),
  fetchPendingWarnings: vi.fn(),
  acknowledgeWarning: vi.fn(),
}));

const fetchPending = vi.mocked(fetchPendingWarnings);
const acknowledge = vi.mocked(acknowledgeWarning);

const first: UserWarning = { id: 'w1', reason: 'First reason' };
const second: UserWarning = { id: 'w2', reason: 'Second reason' };

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => { resolve = r; });
  return { promise, resolve };
}

function setVisibility(state: 'visible' | 'hidden') {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state });
  document.dispatchEvent(new Event('visibilitychange'));
}

describe('WarningsGate — ticket #294 Stage A', () => {
  beforeEach(() => {
    fetchPending.mockReset();
    acknowledge.mockReset();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    clearAuthToken();
  });

  afterEach(() => {
    // Remove the own-property override so the real jsdom getter applies again.
    delete (document as { visibilityState?: unknown }).visibilityState;
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('does not ask for warnings when nobody is signed in', () => {
    render(<WarningsGate />);
    expect(fetchPending).not.toHaveBeenCalled();
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('shows nothing when there are no pending warnings', async () => {
    setAuthToken('token-abc');
    fetchPending.mockResolvedValue([]);
    render(<WarningsGate />);
    await waitFor(() => expect(fetchPending).toHaveBeenCalledTimes(1));
    expect(fetchPending).toHaveBeenCalledWith('token-abc', expect.any(AbortSignal));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('does not block the app when loading fails, and logs it without the token', async () => {
    setAuthToken('token-abc');
    fetchPending.mockRejectedValue(new WarningsApiError('Failed to load warnings (500)', 500));
    render(<WarningsGate />);
    await waitFor(() => expect(console.warn).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(JSON.stringify(vi.mocked(console.warn).mock.calls)).not.toContain('token-abc');
  });

  it('shows a single warning without a counter and closes after acknowledgement', async () => {
    setAuthToken('token-abc');
    fetchPending.mockResolvedValue([first]);
    acknowledge.mockResolvedValue();
    render(<WarningsGate />);

    expect(await screen.findByText('First reason')).toBeInTheDocument();
    expect(screen.queryByText(/1 of/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'I understand' }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    expect(acknowledge).toHaveBeenCalledWith('token-abc', 'w1', expect.any(AbortSignal));
  });

  it('shows several warnings one after another with a counter', async () => {
    setAuthToken('token-abc');
    fetchPending.mockResolvedValue([first, second]);
    acknowledge.mockResolvedValue();
    render(<WarningsGate />);

    expect(await screen.findByText('First reason')).toBeInTheDocument();
    expect(screen.getByText('1 of 2')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'I understand' }));
    expect(await screen.findByText('Second reason')).toBeInTheDocument();
    expect(screen.getByText('2 of 2')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'I understand' }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    expect(acknowledge).toHaveBeenNthCalledWith(2, 'token-abc', 'w2', expect.any(AbortSignal));
  });

  it('stays on the warning and lets the user retry when acknowledging fails', async () => {
    setAuthToken('token-abc');
    fetchPending.mockResolvedValue([first]);
    acknowledge
      .mockRejectedValueOnce(new WarningsApiError('Failed to acknowledge warning (500)', 500))
      .mockResolvedValueOnce();
    render(<WarningsGate />);

    fireEvent.click(await screen.findByRole('button', { name: 'I understand' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/try again/i);
    expect(screen.getByText('First reason')).toBeInTheDocument();
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('acknowledge failed'), expect.any(String));

    fireEvent.click(screen.getByRole('button', { name: 'I understand' }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    expect(acknowledge).toHaveBeenCalledTimes(2);
  });

  it('clears the error when moving on, and allows retrying the second warning', async () => {
    setAuthToken('token-abc');
    fetchPending.mockResolvedValue([first, second]);
    acknowledge
      .mockRejectedValueOnce(new WarningsApiError('Failed to acknowledge warning (network)', 0))
      .mockResolvedValueOnce()
      .mockRejectedValueOnce(new WarningsApiError('Failed to acknowledge warning (503)', 503))
      .mockResolvedValueOnce();
    render(<WarningsGate />);

    fireEvent.click(await screen.findByRole('button', { name: 'I understand' }));
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'I understand' }));

    expect(await screen.findByText('Second reason')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'I understand' }));
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('2 of 2')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'I understand' }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    expect(acknowledge.mock.calls.map(([, id]) => id)).toEqual(['w1', 'w1', 'w2', 'w2']);
  });

  it('checks again when the user returns to the tab, but not while a warning is showing', async () => {
    setAuthToken('token-abc');
    fetchPending.mockResolvedValueOnce([]);
    render(<WarningsGate />);
    await waitFor(() => expect(fetchPending).toHaveBeenCalledTimes(1));

    fetchPending.mockResolvedValueOnce([first]);
    act(() => setVisibility('hidden'));
    expect(fetchPending).toHaveBeenCalledTimes(1);
    act(() => setVisibility('visible'));
    expect(await screen.findByText('First reason')).toBeInTheDocument();
    expect(fetchPending).toHaveBeenCalledTimes(2);

    act(() => setVisibility('visible'));
    expect(fetchPending).toHaveBeenCalledTimes(2);
  });

  it('does not start a second request for the same session while one is in flight', async () => {
    setAuthToken('token-abc');
    const pending = deferred<UserWarning[]>();
    fetchPending.mockReturnValue(pending.promise);
    render(<WarningsGate />);
    expect(fetchPending).toHaveBeenCalledTimes(1);

    act(() => setVisibility('visible'));
    expect(fetchPending).toHaveBeenCalledTimes(1);

    await act(async () => pending.resolve([first]));
    expect(await screen.findByText('First reason')).toBeInTheDocument();
  });

  it('checks when the user signs in and clears the dialog on sign-out', async () => {
    fetchPending.mockResolvedValue([first]);
    render(<WarningsGate />);
    expect(fetchPending).not.toHaveBeenCalled();

    act(() => setAuthToken('token-abc'));
    expect(await screen.findByText('First reason')).toBeInTheDocument();

    act(() => clearAuthToken());
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
  });

  it('checks the new session when the account changes while a check is in flight', async () => {
    setAuthToken('token-a');
    const forA = deferred<UserWarning[]>();
    fetchPending.mockReturnValueOnce(forA.promise).mockResolvedValueOnce([second]);
    render(<WarningsGate />);
    const signalA = fetchPending.mock.calls[0][1] as AbortSignal;

    act(() => setAuthToken('token-b'));
    expect(fetchPending).toHaveBeenCalledTimes(2);
    expect(fetchPending.mock.calls[1][0]).toBe('token-b');
    expect(signalA.aborted).toBe(true);

    expect(await screen.findByText('Second reason')).toBeInTheDocument();
    // A late answer for the old account never replaces the new one.
    await act(async () => forA.resolve([first]));
    expect(screen.queryByText('First reason')).not.toBeInTheDocument();
  });

  it('ignores a failed acknowledgement from the previous session', async () => {
    setAuthToken('token-a');
    fetchPending.mockResolvedValueOnce([first]).mockResolvedValueOnce([second]);
    let rejectAck!: (err: unknown) => void;
    acknowledge.mockReturnValueOnce(new Promise<void>((_resolve, reject) => { rejectAck = reject; }));
    render(<WarningsGate />);

    fireEvent.click(await screen.findByRole('button', { name: 'I understand' }));
    const ackSignal = acknowledge.mock.calls[0][2] as AbortSignal;

    act(() => setAuthToken('token-b'));
    expect(ackSignal.aborted).toBe(true);
    expect(await screen.findByText('Second reason')).toBeInTheDocument();

    await act(async () => rejectAck(new WarningsApiError('Failed to acknowledge warning (500)', 500)));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'I understand' })).not.toHaveAttribute('aria-disabled');
  });

  it('drops an answer that arrives after sign-out', async () => {
    setAuthToken('token-abc');
    const pending = deferred<UserWarning[]>();
    fetchPending.mockReturnValue(pending.promise);
    render(<WarningsGate />);

    act(() => clearAuthToken());
    await act(async () => pending.resolve([first]));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('gives up on a hung request so later checks still run', async () => {
    vi.useFakeTimers();
    setAuthToken('token-abc');
    fetchPending.mockImplementationOnce((_token, signal) => new Promise((_resolve, reject) => {
      signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
    }));
    render(<WarningsGate />);
    const signal = fetchPending.mock.calls[0][1] as AbortSignal;

    await act(async () => { vi.advanceTimersByTime(10_000); });
    expect(signal.aborted).toBe(true);

    fetchPending.mockResolvedValueOnce([]);
    act(() => setVisibility('visible'));
    expect(fetchPending).toHaveBeenCalledTimes(2);
  });

  it('notices a sign-in that happened before the gate started listening', async () => {
    function SignsInOnMount() {
      useEffect(() => { setAuthToken('token-abc'); }, []);
      return null;
    }
    fetchPending.mockResolvedValue([first]);
    render(<><SignsInOnMount /><WarningsGate /></>);
    expect(await screen.findByText('First reason')).toBeInTheDocument();

    act(() => clearAuthToken());
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
  });

  it('lets another modal take the keyboard while yieldFocus is set', async () => {
    setAuthToken('token-abc');
    fetchPending.mockResolvedValue([first]);
    render(<><button type="button">Session modal button</button><WarningsGate yieldFocus /></>);
    await screen.findByText('First reason');

    const other = screen.getByRole('button', { name: 'Session modal button' });
    other.focus();
    expect(other).toHaveFocus();
  });

  it('never writes pending warnings to browser storage', async () => {
    setAuthToken('token-abc');
    fetchPending.mockResolvedValue([{ id: 'warning-id-xyz', reason: 'secret-reason-xyz' }]);
    render(<WarningsGate />);
    await screen.findByText('secret-reason-xyz');

    const dump = (s: Storage) => Object.keys(s).map((k) => `${k}=${s.getItem(k) ?? ''}`).join('\n');
    const stored = `${dump(localStorage)}\n${dump(sessionStorage)}`;
    expect(stored).not.toContain('secret-reason-xyz');
    expect(stored).not.toContain('warning-id-xyz');
  });
});

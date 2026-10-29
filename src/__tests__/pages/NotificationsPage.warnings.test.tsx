import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ApiNotification } from '@/lib/notificationsApi';
import NotificationsPage from '@/pages/NotificationsPage';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
  const mod = await importOriginal<typeof import('react-router-dom')>();
  return { ...mod, useNavigate: () => mockNavigate };
});

const { useNotificationsMock, invalidateMock, acknowledgeMock, markReadMock } = vi.hoisted(() => ({
  useNotificationsMock: vi.fn(),
  invalidateMock: vi.fn(),
  acknowledgeMock: vi.fn(),
  markReadMock: vi.fn(),
}));
vi.mock('@/lib/queries', () => ({
  useNotifications: () => useNotificationsMock(),
  invalidateNotifications: () => invalidateMock(),
}));
vi.mock('@/lib/warningsApi', () => ({
  acknowledgeWarning: (...args: unknown[]) => acknowledgeMock(...args),
}));
vi.mock('@/lib/notificationsApi', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@/lib/notificationsApi')>();
  return { ...mod, markNotificationRead: (...args: unknown[]) => markReadMock(...args) };
});
vi.mock('@/lib/storage', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@/lib/storage')>();
  return { ...mod, getCurrentUser: () => ({ id: 'me', name: 'Me', email: 'me@example.com' }), getNotifications: () => [], saveNotifications: () => {} };
});
vi.mock('@/lib/auth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/auth')>()),
  getAuthToken: () => 'test-token',
  setAuthToken: () => {},
}));
vi.mock('@/components/BottomNav', () => ({ default: () => null }));

const ACK_ERROR = "We couldn't confirm that you read this warning. Check your connection and try again.";

function minutesAgo(m: number) {
  return new Date(Date.now() - m * 60_000).toISOString();
}

function warningRow(over: Partial<ApiNotification>): ApiNotification {
  return {
    id: 'n0',
    type: 'warning',
    message: 'Reason',
    created_at: minutesAgo(1),
    read: false,
    is_warning: true,
    warning_id: '0',
    warning_acknowledged: false,
    warning_withdrawn: false,
    ...over,
  };
}

const WAITING = warningRow({ id: 'n1', warning_id: '7', message: 'Repeated spam in event chats.', created_at: minutesAgo(1) });
const ACKED = warningRow({ id: 'n2', warning_id: '8', message: 'Old warning, already read.', warning_acknowledged: true, read: true, created_at: minutesAgo(2) });
const WITHDRAWN = warningRow({ id: 'n3', warning_id: '9', message: 'Withdrawn by an admin.', warning_withdrawn: true, created_at: minutesAgo(3) });
const NORMAL: ApiNotification = { id: 'n4', type: 'event_updated', message: 'Picnic moved to 3 PM', created_at: minutesAgo(4), read: false };

function renderPage(rows: ApiNotification[] = [WAITING, ACKED, WITHDRAWN, NORMAL]) {
  useNotificationsMock.mockReturnValue({ data: rows, isLoading: false });
  render(<MemoryRouter><NotificationsPage /></MemoryRouter>);
}

/** The warning card that shows this reason. */
function card(reason: string): HTMLElement {
  return screen.getByText(reason).closest('[data-testid="warning-card"]') as HTMLElement;
}

describe('NotificationsPage — warning cards (ticket #294 Part 4)', () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    invalidateMock.mockReset();
    acknowledgeMock.mockReset();
    markReadMock.mockReset();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 200 })));
  });
  afterEach(() => vi.unstubAllGlobals());

  it('shows the amber card: label, title, two-line reason and "Tap to read"', () => {
    renderPage([WAITING]);
    const c = card('Repeated spam in event chats.');

    expect(c).toHaveAttribute('role', 'button');
    expect(c).toHaveAttribute('tabindex', '0');
    expect(c).toHaveAccessibleName('Warning from an administrator: tap to read');
    expect(within(c).getByText('Warning')).toBeInTheDocument();
    expect(within(c).getByText('Warning from an administrator')).toBeInTheDocument();
    expect(within(c).getByText('Repeated spam in event chats.')).toHaveClass('line-clamp-2');
    expect(within(c).getByText('Tap to read ›')).toBeInTheDocument();
    expect(within(c).getByTestId('unread-dot')).toHaveStyle({ background: 'hsl(38 92% 52%)' });
  });

  it('shows the reason as plain text, never as HTML', () => {
    renderPage([warningRow({ id: 'n9', message: '<img src=x onerror="alert(1)"><b>bold</b>' })]);
    const c = card('<img src=x onerror="alert(1)"><b>bold</b>');
    expect(c.querySelector('img')).toBeNull();
    expect(c.querySelector('b')).toBeNull();
  });

  it('gives a waiting warning no checkbox and no delete button', () => {
    renderPage();
    const c = card('Repeated spam in event chats.');
    expect(within(c).queryByRole('checkbox')).not.toBeInTheDocument();
    expect(within(c).queryByRole('button', { name: 'Delete notification' })).not.toBeInTheDocument();
  });

  it('keeps the checkbox and delete button on acknowledged and withdrawn warnings', () => {
    renderPage();
    for (const reason of ['Old warning, already read.', 'Withdrawn by an admin.']) {
      const c = card(reason);
      expect(within(c).getByRole('checkbox', { name: 'Select notification' })).toBeInTheDocument();
      expect(within(c).getByRole('button', { name: 'Delete notification' })).toBeInTheDocument();
    }
  });

  it('never selects a waiting warning with "Select All"', () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /select all/i }));
    // The acknowledged, withdrawn and normal notifications: 3, not 4.
    expect(screen.getByRole('button', { name: /deselect all \(3\)/i })).toBeInTheDocument();
  });

  it('opens the acknowledge dialog for a waiting warning, without marking it read', () => {
    renderPage();
    fireEvent.click(card('Repeated spam in event chats.'));

    const dialog = screen.getByRole('alertdialog', { name: 'Warning from an administrator' });
    expect(within(dialog).getByText('Repeated spam in event chats.')).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'I understand' })).toBeInTheDocument();
    expect(markReadMock).not.toHaveBeenCalled();
    expect(acknowledgeMock).not.toHaveBeenCalled();
    expect(invalidateMock).not.toHaveBeenCalled();
  });

  it('opens with Enter', () => {
    renderPage([WAITING]);
    const c = card('Repeated spam in event chats.');
    fireEvent.keyDown(c, { key: 'Enter' });
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
  });

  it('opens with Space', () => {
    renderPage([ACKED]);
    fireEvent.keyDown(card('Old warning, already read.'), { key: ' ' });
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('acknowledging calls the API, marks the card acknowledged and read, and refreshes the list', async () => {
    acknowledgeMock.mockResolvedValue(undefined);
    renderPage();
    fireEvent.click(card('Repeated spam in event chats.'));
    fireEvent.click(screen.getByRole('button', { name: 'I understand' }));

    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    expect(acknowledgeMock).toHaveBeenCalledWith('test-token', '7');
    expect(invalidateMock).toHaveBeenCalledTimes(1);

    const c = card('Repeated spam in event chats.');
    expect(within(c).queryByTestId('unread-dot')).not.toBeInTheDocument();
    expect(within(c).getByRole('button', { name: 'Delete notification' })).toBeInTheDocument();
    expect(within(c).getByRole('checkbox')).toBeInTheDocument();

    // It now opens in review mode.
    fireEvent.click(c);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('stays open with the error when acknowledging fails, and lets the user retry', async () => {
    acknowledgeMock.mockRejectedValueOnce(new Error('Failed to acknowledge warning (500)')).mockResolvedValueOnce(undefined);
    renderPage();
    fireEvent.click(card('Repeated spam in event chats.'));
    fireEvent.click(screen.getByRole('button', { name: 'I understand' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(ACK_ERROR);
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    expect(invalidateMock).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'I understand' }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    expect(acknowledgeMock).toHaveBeenCalledTimes(2);
  });

  it('opens an acknowledged warning in review mode with Close, sending nothing', async () => {
    renderPage();
    fireEvent.click(card('Old warning, already read.'));

    const dialog = screen.getByRole('dialog', { name: 'Warning from an administrator' });
    expect(within(dialog).getByRole('button', { name: 'Close' })).toBeInTheDocument();
    expect(within(dialog).queryByRole('button', { name: 'I understand' })).not.toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(acknowledgeMock).not.toHaveBeenCalled();
    expect(markReadMock).not.toHaveBeenCalled();
  });

  it('opens a withdrawn warning in review mode; Escape closes it', async () => {
    renderPage();
    fireEvent.click(card('Withdrawn by an admin.'));

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    fireEvent.keyDown(document.body, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(acknowledgeMock).not.toHaveBeenCalled();
    expect(markReadMock).not.toHaveBeenCalled();
  });

  it('leaves other notification cards unchanged', () => {
    renderPage();
    expect(screen.getByText('event updated')).toBeInTheDocument();
    expect(screen.getByText('Picnic moved to 3 PM').closest('[data-testid="warning-card"]')).toBeNull();
  });
});

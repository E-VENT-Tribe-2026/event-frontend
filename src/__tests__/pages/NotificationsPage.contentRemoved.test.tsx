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

const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000).toISOString();

const REMOVED_MESSAGE_TEXT =
  'Your content was removed. Your message in "Sunset Picnic" was removed by an administrator: "you are all idiots...". This counts as a warning.';
const REMOVED_EVENT_TEXT =
  'Your content was removed. Your event "Sunset Picnic" was removed by an administrator. This counts as a warning.';

const CONTENT_REMOVED: ApiNotification = {
  id: 'r1', type: 'content_removed', message: REMOVED_MESSAGE_TEXT, related_event_id: 'evt-gone',
  created_at: minutesAgo(1), read: false, is_warning: false, warning_id: '32', warning_acknowledged: false, warning_withdrawn: false,
};
const EVENT_REMOVED: ApiNotification = {
  id: 'r2', type: 'event_removed', message: 'Event "Sunset Picnic" was removed by an administrator.',
  related_event_id: 'evt-gone', created_at: minutesAgo(2), read: false,
};
const WARNING: ApiNotification = {
  id: 'w1', type: 'warning', message: 'Repeated spam.', created_at: minutesAgo(3), read: false,
  is_warning: true, warning_id: '7', warning_acknowledged: false, warning_withdrawn: false,
};

function renderPage(rows: ApiNotification[] = [CONTENT_REMOVED]) {
  useNotificationsMock.mockReturnValue({ data: rows, isLoading: false });
  render(<MemoryRouter><NotificationsPage /></MemoryRouter>);
}

describe('NotificationsPage: "Your content was removed" (#327)', () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    invalidateMock.mockReset();
    acknowledgeMock.mockReset();
    markReadMock.mockReset();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 200 })));
  });
  afterEach(() => vi.unstubAllGlobals());

  it('shows a red card that names what was removed and the event, and says it counts as a warning', () => {
    renderPage();
    const c = screen.getByTestId('content-removed-card');

    expect(within(c).getByText('Your content was removed')).toBeInTheDocument();
    expect(within(c).getByText('Content removed')).toBeInTheDocument();
    const detail = within(c).getByTestId('content-removed-detail');
    expect(detail).toHaveTextContent('Your message in "Sunset Picnic" was removed by an administrator');
    expect(detail).toHaveTextContent('This counts as a warning.');
    // Red, in the red of the administrator panel (--adm-danger), as a solid red card.
    expect(c).toHaveStyle({ border: '2px solid hsl(0 84% 60%)' });
    expect(within(c).getByTestId('unread-dot')).toHaveStyle({ background: 'hsl(0 84% 60%)' });
  });

  it('names a removed event too', () => {
    renderPage([{ ...CONTENT_REMOVED, message: REMOVED_EVENT_TEXT }]);
    expect(screen.getByTestId('content-removed-detail')).toHaveTextContent('Your event "Sunset Picnic" was removed by an administrator.');
  });

  it('looks different from a warning card', () => {
    renderPage([CONTENT_REMOVED, WARNING]);
    const removed = screen.getByTestId('content-removed-card');
    const warning = screen.getByTestId('warning-card');
    expect(removed).not.toBe(warning);
    expect(removed.getAttribute('style')).not.toBe(warning.getAttribute('style'));
    expect(within(removed).queryByText('Warning from an administrator')).not.toBeInTheDocument();
  });

  it('shows the warning again to read, with its reason and a Close button, and asks for no acknowledgement', async () => {
    renderPage();
    fireEvent.click(screen.getByTestId('content-removed-card'));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Warning from an administrator')).toBeInTheDocument();
    expect(within(dialog).getByText(/you are all idiots/)).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Close' })).toBeInTheDocument();
    expect(within(dialog).queryByRole('button', { name: /i understand/i })).not.toBeInTheDocument();
    expect(acknowledgeMock).not.toHaveBeenCalled();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(acknowledgeMock).not.toHaveBeenCalled();
  });

  it('never opens the removed event, so there is no "event not found"', async () => {
    renderPage();
    fireEvent.click(screen.getByTestId('content-removed-card'));
    await screen.findByRole('dialog');
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('marks the notification read when it is opened', async () => {
    renderPage();
    fireEvent.click(screen.getByTestId('content-removed-card'));
    await waitFor(() => expect(markReadMock).toHaveBeenCalledWith('test-token', 'r1'));
  });

  it('still opens the notice when the removal did not count as a warning (no warning id)', async () => {
    renderPage([{ ...CONTENT_REMOVED, warning_id: null }]);
    fireEvent.click(screen.getByTestId('content-removed-card'));
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('can be opened with the keyboard', async () => {
    renderPage();
    fireEvent.keyDown(screen.getByTestId('content-removed-card'), { key: 'Enter' });
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
  });

  it('shows it under Updates, with the other removal notice', () => {
    renderPage([CONTENT_REMOVED, EVENT_REMOVED]);
    fireEvent.click(screen.getByRole('tab', { name: /Updates/i }));
    expect(screen.getByTestId('content-removed-card')).toBeInTheDocument();
    expect(screen.getByText('Event "Sunset Picnic" was removed by an administrator.')).toBeInTheDocument();
  });

  it('opens the removed event page for a participant\'s "event removed" notification', async () => {
    renderPage([EVENT_REMOVED]);
    fireEvent.click(screen.getByText('Event "Sunset Picnic" was removed by an administrator.'));
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/event/evt-gone'));
  });
});

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AdminEventsTab from '@/components/admin/AdminEventsTab';
import * as adminApi from '@/lib/adminApi';

const organizer = {
  id: 'org-1',
  username: 'alex_smith',
  full_name: 'Alex Smith',
  display_name: null,
};

const summit = {
  id: 'e1',
  title: 'Community Tech Summit',
  category: 'Technology',
  status: 'active',
  is_cancelled: false,
  start_datetime: '2026-11-20T09:00:00Z',
  end_datetime: '2026-11-20T17:00:00Z',
  organizer,
};

const hackathon = {
  id: 'e2',
  title: 'Cancelled Hackathon',
  category: 'Tech',
  status: 'cancelled',
  is_cancelled: true,
  start_datetime: '2026-08-15T09:00:00Z',
  end_datetime: '2026-08-15T18:00:00Z',
  organizer: { id: 'org-2', username: null, full_name: 'Jordan Doe', display_name: null },
};

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
    ...init,
  });
}

function renderTab(onOpenEvent = vi.fn()) {
  return {
    onOpenEvent,
    ...render(
      <MemoryRouter>
        <AdminEventsTab onOpenEvent={onOpenEvent} onErrorToast={vi.fn()} />
      </MemoryRouter>,
    ),
  };
}

function statusFromCall(call: unknown[] | undefined): string | null {
  const url = new URL(String(call?.[0]), 'http://localhost');
  return url.searchParams.get('status');
}

describe('AdminEventsTab (ticket #249)', () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockResolvedValue(jsonResponse({ data: [summit, hackathon] }));
    vi.stubGlobal('fetch', fetchMock);
    vi.spyOn(adminApi, 'fetchAdminCounts').mockResolvedValue({
      total_users: 150,
      events: { total: 42, upcoming: 18, past: 20, cancelled: 4 },
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('shows the four counts at the top', async () => {
    renderTab();
    const counts = await screen.findByLabelText('Event counts');
    await waitFor(() => expect(counts).toHaveTextContent('42'));
    expect(counts).toHaveTextContent('18');
    expect(counts).toHaveTextContent('20');
    expect(counts).toHaveTextContent('4');
  });

  it('lists title, date, organizer picture, full name and username on each row', async () => {
    renderTab();
    expect(await screen.findByText('Community Tech Summit')).toBeInTheDocument();
    expect(screen.getByText('Alex Smith')).toBeInTheDocument();
    expect(screen.getByText(/Nov 20, 2026/)).toBeInTheDocument();
  });

  it('shows an organizer without a username by full name alone', async () => {
    renderTab();
    expect(await screen.findByText('Jordan Doe')).toBeInTheDocument();
    expect(screen.queryByText('@null')).not.toBeInTheDocument();
    expect(screen.queryByText(/^@$/)).not.toBeInTheDocument();
  });

  it('marks a cancelled event with a "Cancelled" label and no other event', async () => {
    renderTab();
    const row = await screen.findByRole('button', { name: /View event Cancelled Hackathon/i });
    expect(row).toHaveTextContent('Cancelled');
    const normal = screen.getByRole('button', { name: /View event Community Tech Summit/i });
    expect(normal).not.toHaveTextContent('Cancelled');
  });

  it('starts on All and asks the backend for each tab when it is chosen', async () => {
    renderTab();
    await screen.findByText('Community Tech Summit');
    expect(statusFromCall(fetchMock.mock.calls[0])).toBeNull();

    for (const [label, key] of [
      ['Upcoming', 'upcoming'],
      ['Past', 'past'],
      ['Cancelled', 'cancelled'],
    ] as const) {
      fireEvent.click(screen.getByRole('tab', { name: label }));
      await waitFor(() => expect(statusFromCall(fetchMock.mock.calls.at(-1))).toBe(key));
    }

    const callsBeforeAll = fetchMock.mock.calls.length;
    fireEvent.click(screen.getByRole('tab', { name: 'All' }));
    expect(screen.getByRole('tab', { name: 'All' })).toHaveAttribute('aria-selected', 'true');
    expect(fetchMock.mock.calls.length).toBe(callsBeforeAll);
  });

  it('keeps the search text when the tab changes', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    renderTab();
    await screen.findByText('Community Tech Summit');

    fireEvent.change(screen.getByLabelText('Search by event title'), { target: { value: 'summit' } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });
    expect(screen.getByLabelText('Search by event title')).toHaveValue('summit');

    fireEvent.click(screen.getByRole('tab', { name: 'Past' }));
    await waitFor(() => expect(statusFromCall(fetchMock.mock.calls.at(-1))).toBe('past'));
    expect(screen.getByLabelText('Search by event title')).toHaveValue('summit');
  });

  it('waits for the user to stop typing before searching', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    renderTab();
    await screen.findByText('Community Tech Summit');

    const input = screen.getByLabelText('Search by event title');
    fireEvent.change(input, { target: { value: 'h' } });
    fireEvent.change(input, { target: { value: 'ha' } });
    fireEvent.change(input, { target: { value: 'hack' } });
    expect(screen.getByText('Community Tech Summit')).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });
    expect(screen.queryByText('Community Tech Summit')).not.toBeInTheDocument();
    expect(screen.getByText('Cancelled Hackathon')).toBeInTheDocument();
  });

  it('says so when nothing matches the search', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    renderTab();
    await screen.findByText('Community Tech Summit');

    fireEvent.change(screen.getByLabelText('Search by event title'), { target: { value: 'zzz' } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });
    expect(await screen.findByText('No events found')).toBeInTheDocument();
    expect(screen.getByText(/No events match your current filters or search/i)).toBeInTheDocument();
  });

  it('loads the next page and appends it when the first page is full', async () => {
    const page1 = Array.from({ length: 100 }, (_, i) => ({
      ...summit,
      id: `p1-${i}`,
      title: `Paged Event ${i}`,
    }));
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ data: page1 }))
      .mockResolvedValueOnce(jsonResponse({ data: [hackathon] }));

    renderTab();
    expect(await screen.findByText('Cancelled Hackathon')).toBeInTheDocument();
    expect(screen.getByText('Paged Event 0')).toBeInTheDocument();
    const urls = fetchMock.mock.calls.map((call) => new URL(String(call[0]), 'http://localhost'));
    expect(urls[0].searchParams.get('page')).toBe('1');
    expect(urls[1].searchParams.get('page')).toBe('2');
  });

  it('hides "Load More" when there is only one page', async () => {
    renderTab();
    await screen.findByText('Community Tech Summit');
    expect(screen.queryByRole('button', { name: 'Load More Events' })).not.toBeInTheDocument();
  });

  it('opens the panel event page when a row is pressed', async () => {
    const { onOpenEvent } = renderTab();
    fireEvent.click(await screen.findByRole('button', { name: /View event Community Tech Summit/i }));
    expect(onOpenEvent).toHaveBeenCalledWith('e1');
  });

  it('shows hostile text as plain text, not as markup', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        data: [
          {
            ...summit,
            title: '<img src=x onerror=alert(1)>',
            organizer: { ...organizer, full_name: '<b>Bold</b>', username: '<script>x</script>' },
          },
        ],
      }),
    );
    const { container } = renderTab();
    expect(await screen.findByText('<img src=x onerror=alert(1)>')).toBeInTheDocument();
    expect(screen.getByText('<b>Bold</b>')).toBeInTheDocument();
    expect(container.querySelector('img[src="x"]')).toBeNull();
    expect(container.querySelector('script')).toBeNull();
    expect(container.querySelector('b')).toBeNull();
  });

  it('does not keep panel data in the client cache', async () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    renderTab();
    await screen.findByText('Community Tech Summit');
    expect(setItem).not.toHaveBeenCalled();
  });
});

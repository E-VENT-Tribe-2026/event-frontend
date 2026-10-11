import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import AdminEventsTab from '@/components/admin/AdminEventsTab';
import * as adminApi from '@/lib/adminApi';

const organizer = {
  id: 'org-1',
  username: 'alex_smith',
  full_name: 'Alex Smith',
  avatar_url: null,
};

function page(
  items: adminApi.AdminEventListItem[],
  over: Partial<adminApi.AdminEventsResponse> = {},
): adminApi.AdminEventsResponse {
  return { items, total: items.length, page: 1, limit: 20, total_pages: 1, ...over };
}

const summit: adminApi.AdminEventListItem = {
  id: 'e1',
  title: 'Community Tech Summit',
  date: '2026-11-20T09:00:00Z',
  status: 'active',
  is_cancelled: false,
  organizer,
};

const hackathon: adminApi.AdminEventListItem = {
  id: 'e2',
  title: 'Cancelled Hackathon',
  date: '2026-08-15T09:00:00Z',
  status: 'cancelled',
  is_cancelled: true,
  organizer: { id: 'org-2', username: null, full_name: 'Jordan Doe', avatar_url: null },
};

function renderTab() {
  return render(
    <MemoryRouter initialEntries={['/admin']}>
      <Routes>
        <Route path="/admin" element={<AdminEventsTab onErrorToast={vi.fn()} />} />
        <Route path="/admin/events/:eventId" element={<div>Event page opened</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe('AdminEventsTab (ticket #249)', () => {
  let listSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.spyOn(adminApi, 'fetchAdminCounts').mockResolvedValue({
      total_users: 150,
      events: { total: 42, upcoming: 18, past: 20, cancelled: 4 },
    });
    listSpy = vi.spyOn(adminApi, 'fetchAdminEvents').mockResolvedValue(page([summit, hackathon]));
  });

  afterEach(() => {
    vi.useRealTimers();
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
    expect(screen.getByText('@alex_smith')).toBeInTheDocument();
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
    const row = await screen.findByRole('button', { name: /View details for Cancelled Hackathon/i });
    expect(row).toHaveTextContent('Cancelled');
    const normal = screen.getByRole('button', { name: /View details for Community Tech Summit/i });
    expect(normal).not.toHaveTextContent('Cancelled');
  });

  it('starts on All and asks the backend for each tab when it is chosen', async () => {
    renderTab();
    await screen.findByText('Community Tech Summit');
    expect(listSpy).toHaveBeenLastCalledWith('all', 1, 20, '');

    for (const [label, key] of [
      ['Upcoming', 'upcoming'],
      ['Past', 'past'],
      ['Cancelled', 'cancelled'],
      ['All', 'all'],
    ] as const) {
      fireEvent.click(screen.getByRole('tab', { name: label }));
      await waitFor(() => expect(listSpy).toHaveBeenLastCalledWith(key, 1, 20, ''));
    }
  });

  it('keeps the search text when the tab changes', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    renderTab();
    await screen.findByText('Community Tech Summit');

    fireEvent.change(screen.getByLabelText('Search by event title'), { target: { value: 'summit' } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(400);
    });
    expect(listSpy).toHaveBeenLastCalledWith('all', 1, 20, 'summit');

    fireEvent.click(screen.getByRole('tab', { name: 'Past' }));
    await waitFor(() => expect(listSpy).toHaveBeenLastCalledWith('past', 1, 20, 'summit'));
  });

  it('waits for the user to stop typing before searching', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    renderTab();
    await screen.findByText('Community Tech Summit');
    listSpy.mockClear();

    const input = screen.getByLabelText('Search by event title');
    fireEvent.change(input, { target: { value: 's' } });
    fireEvent.change(input, { target: { value: 'su' } });
    fireEvent.change(input, { target: { value: 'sum' } });
    expect(listSpy).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(400);
    });
    expect(listSpy).toHaveBeenCalledTimes(1);
    expect(listSpy).toHaveBeenCalledWith('all', 1, 20, 'sum');
  });

  it('says so when nothing matches the search', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    renderTab();
    await screen.findByText('Community Tech Summit');
    listSpy.mockResolvedValue(page([]));

    fireEvent.change(screen.getByLabelText('Search by event title'), { target: { value: 'zzz' } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(400);
    });
    expect(await screen.findByText('No events found')).toBeInTheDocument();
    expect(screen.getByText(/matched "zzz"/)).toBeInTheDocument();
  });

  it('loads the next page and appends it when "Load More Events" is pressed', async () => {
    listSpy.mockResolvedValueOnce(page([summit], { page: 1, total_pages: 2, total: 2 }));
    renderTab();
    await screen.findByText('Community Tech Summit');

    listSpy.mockResolvedValueOnce(page([hackathon], { page: 2, total_pages: 2, total: 2 }));
    fireEvent.click(screen.getByRole('button', { name: 'Load More Events' }));

    expect(await screen.findByText('Cancelled Hackathon')).toBeInTheDocument();
    expect(screen.getByText('Community Tech Summit')).toBeInTheDocument();
    expect(listSpy).toHaveBeenLastCalledWith('all', 2, 20, '');
    expect(screen.queryByRole('button', { name: 'Load More Events' })).not.toBeInTheDocument();
  });

  it('hides "Load More" when there is only one page', async () => {
    renderTab();
    await screen.findByText('Community Tech Summit');
    expect(screen.queryByRole('button', { name: 'Load More Events' })).not.toBeInTheDocument();
  });

  it('opens the panel event page when a row is pressed', async () => {
    renderTab();
    fireEvent.click(await screen.findByRole('button', { name: /View details for Community Tech Summit/i }));
    expect(await screen.findByText('Event page opened')).toBeInTheDocument();
  });

  it('shows hostile text as plain text, not as markup', async () => {
    listSpy.mockResolvedValue(
      page([
        {
          ...summit,
          title: '<img src=x onerror=alert(1)>',
          organizer: { ...organizer, full_name: '<b>Bold</b>', username: '<script>x</script>' },
        },
      ])
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

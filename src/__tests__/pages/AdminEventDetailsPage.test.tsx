import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import AdminEventDetailsPage from '@/pages/AdminEventDetailsPage';
import * as adminApi from '@/lib/adminApi';

vi.mock('@/components/BottomNav', () => ({ default: () => <nav /> }));

const baseEvent: adminApi.AdminEventDetails = {
  id: 'e1',
  title: 'Community Tech Summit',
  description: 'Annual tech conference.',
  category: 'Technology',
  start_datetime: '2026-11-20T09:00:00Z',
  end_datetime: '2026-11-20T17:00:00Z',
  location_name: 'Central Hall',
  latitude: 48.8566,
  longitude: 2.3522,
  cost: 15,
  max_capacity: 100,
  status: 'active',
  is_cancelled: false,
  organizer: { id: 'org-1', username: 'alex_smith', full_name: 'Alex Smith', avatar_url: null },
  participant_count: 2,
  participants: [
    { id: 'p1', username: 'sarah_c', full_name: 'Sarah Connor', avatar_url: null, status: 'registered' },
    { id: 'p2', username: null, full_name: 'Jordan Doe', avatar_url: null, status: 'registered' },
  ],
};

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/admin/events/e1']}>
      <Routes>
        <Route path="/admin/events/:eventId" element={<AdminEventDetailsPage />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('AdminEventDetailsPage (ticket #249)', () => {
  let detailsSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    detailsSpy = vi.spyOn(adminApi, 'fetchAdminEventDetails').mockResolvedValue(baseEvent);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('loads the event named in the address', async () => {
    renderPage();
    expect(await screen.findByText('Community Tech Summit')).toBeInTheDocument();
    expect(detailsSpy).toHaveBeenCalledWith('e1');
  });

  it('shows the event details', async () => {
    renderPage();
    expect(await screen.findByText('Annual tech conference.')).toBeInTheDocument();
    expect(screen.getByText('Central Hall')).toBeInTheDocument();
    expect(screen.getByText('Technology')).toBeInTheDocument();
    expect(screen.getByText('€15')).toBeInTheDocument();
    expect(screen.getByText('Capacity: 100')).toBeInTheDocument();
    expect(screen.getByText(/Nov 20, 2026/)).toBeInTheDocument();
  });

  it('shows the organizer with full name and username', async () => {
    renderPage();
    expect(await screen.findByText('Alex Smith')).toBeInTheDocument();
    expect(screen.getByText('@alex_smith')).toBeInTheDocument();
  });

  it('lists every participant with full name and username, and the count', async () => {
    renderPage();
    expect(await screen.findByText('Participants (2)')).toBeInTheDocument();
    expect(screen.getByText('Sarah Connor')).toBeInTheDocument();
    expect(screen.getByText('@sarah_c')).toBeInTheDocument();
    // a participant without a username appears by full name alone
    expect(screen.getByText('Jordan Doe')).toBeInTheDocument();
    expect(screen.queryByText('@null')).not.toBeInTheDocument();
  });

  it('says so when there are no participants', async () => {
    detailsSpy.mockResolvedValue({ ...baseEvent, participant_count: 0, participants: [] });
    renderPage();
    expect(await screen.findByText('No participants yet.')).toBeInTheDocument();
  });

  it('shows the "Cancelled" label for a cancelled event', async () => {
    detailsSpy.mockResolvedValue({ ...baseEvent, status: 'cancelled', is_cancelled: true });
    renderPage();
    expect(await screen.findByText('Cancelled')).toBeInTheDocument();
  });

  it('does not show "Cancelled" for an active event', async () => {
    renderPage();
    await screen.findByText('Community Tech Summit');
    expect(screen.queryByText('Cancelled')).not.toBeInTheDocument();
  });

  it('shows "Free" when the event costs nothing', async () => {
    detailsSpy.mockResolvedValue({ ...baseEvent, cost: 0 });
    renderPage();
    expect(await screen.findByText('Free')).toBeInTheDocument();
  });

  it('shows an error when the event cannot be loaded', async () => {
    detailsSpy.mockRejectedValue(new Error('Event not found.'));
    renderPage();
    expect(await screen.findByRole('alert')).toHaveTextContent('Event not found.');
  });

  it('shows hostile text as plain text, not as markup', async () => {
    detailsSpy.mockResolvedValue({
      ...baseEvent,
      title: '<img src=x onerror=alert(1)>',
      description: '<script>alert(1)</script>',
      participants: [
        { id: 'p1', username: '<b>x</b>', full_name: '<i>Name</i>', avatar_url: null },
      ],
      participant_count: 1,
    });
    const { container } = renderPage();
    expect(await screen.findByText('<img src=x onerror=alert(1)>')).toBeInTheDocument();
    expect(screen.getByText('<script>alert(1)</script>')).toBeInTheDocument();
    expect(screen.getByText('<i>Name</i>')).toBeInTheDocument();
    expect(container.querySelector('script')).toBeNull();
    expect(container.querySelector('img[src="x"]')).toBeNull();
    expect(container.querySelector('i')).toBeNull();
    expect(container.querySelector('b')).toBeNull();
  });

  it('has a back button', async () => {
    renderPage();
    await screen.findByText('Community Tech Summit');
    expect(screen.getByRole('button', { name: 'Back' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
  });
});

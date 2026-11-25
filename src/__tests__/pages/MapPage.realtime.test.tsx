import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const { fetchMapEvents } = vi.hoisted(() => ({ fetchMapEvents: vi.fn() }));

vi.mock('@/lib/mapEventsApi', () => ({
  fetchMapEvents,
  peekMapEvents: () => null,
}));
vi.mock('@/lib/signedIn', () => ({ hasSignedInSession: () => true }));
vi.mock('@/lib/organizerProfile', () => ({ fetchOrganizerProfile: vi.fn(async () => null) }));
vi.mock('@/components/BottomNav', () => ({ default: () => null }));
vi.mock('@/components/DatePickerField', () => ({ default: () => null }));
vi.mock('@/app/AppChrome', () => ({ useTopBarSearch: () => ({ search: '', setSearch: () => {} }) }));
vi.mock('leaflet/dist/leaflet.css', () => ({}));

import MapPage from '@/pages/MapPage';
import { notifyEventsChanged } from '@/lib/realtimeEvents';

describe('MapPage realtime refresh', () => {
  beforeEach(() => {
    fetchMapEvents.mockReset();
    fetchMapEvents.mockResolvedValue([]);
  });

  it('reloads the events when another user creates, changes or cancels an event', async () => {
    render(
      <MemoryRouter>
        <MapPage />
      </MemoryRouter>,
    );
    await waitFor(() => expect(fetchMapEvents).toHaveBeenCalledTimes(1));

    act(() => notifyEventsChanged());

    await waitFor(() => expect(fetchMapEvents).toHaveBeenCalledTimes(2));
  });
});

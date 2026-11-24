import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { User } from '@/lib/storage';
import EventDetailsPage from '@/pages/EventDetailsPage';
import { clearCache } from '@/lib/queryCache';

const { getCurrentUserMock, getAuthTokenMock } = vi.hoisted(() => ({
  getCurrentUserMock: vi.fn<[], User | null>(),
  getAuthTokenMock: vi.fn<[], string | null>(),
}));

vi.mock('@/lib/storage', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@/lib/storage')>();
  return { ...mod, getCurrentUser: () => getCurrentUserMock() };
});
vi.mock('@/lib/auth', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@/lib/auth')>();
  return { ...mod, getAuthToken: () => getAuthTokenMock() };
});
vi.mock('@/components/BottomNav', () => ({ default: () => null }));

const me = {
  id: 'me', name: 'me', email: 'me@test.com', role: 'participant', password: 'x', avatar: '', profilePhoto: '',
  coverPhoto: '', bio: '', interests: [], dob: '', gender: '', isPremium: false, friends: [], createdAt: '', username: 'me',
} as unknown as User;

const json = (body: unknown, code: number) =>
  Promise.resolve(new Response(JSON.stringify(body), { status: code, headers: { 'content-type': 'application/json' } }));

function stubEvent(status: number, body: unknown) {
  vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    if (url.includes('/api/events/evt-1')) return json(body, status);
    return json({}, 404);
  }));
}

const renderPage = () =>
  render(
    <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }} initialEntries={['/event/evt-1']}>
      <Routes>
        <Route path="/event/:id" element={<EventDetailsPage />} />
        <Route path="/home" element={<div>Home page</div>} />
      </Routes>
    </MemoryRouter>,
  );

describe('EventDetailsPage: removed events (#327)', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    clearCache();
    getCurrentUserMock.mockReturnValue(me);
    getAuthTokenMock.mockReturnValue('tok-me');
  });
  afterEach(() => vi.unstubAllGlobals());

  it('says the event was removed by an administrator when the server answers 410', async () => {
    stubEvent(410, { detail: { code: 'event_removed', message: 'This event was removed by an administrator.' } });
    renderPage();

    const note = await screen.findByTestId('event-removed-note');
    expect(note).toHaveTextContent('This event was removed by an administrator');
    expect(screen.queryByText('Event not found')).not.toBeInTheDocument();
  });

  it('offers a way out of the removed event page', async () => {
    stubEvent(410, { detail: { code: 'event_removed', message: 'This event was removed by an administrator.' } });
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: /browse events/i }));
    expect(await screen.findByText('Home page')).toBeInTheDocument();
  });

  it('still says "Event not found" for an event that does not exist (404)', async () => {
    stubEvent(404, { detail: 'Event not found' });
    renderPage();
    expect(await screen.findByText('Event not found')).toBeInTheDocument();
    expect(screen.queryByTestId('event-removed-note')).not.toBeInTheDocument();
  });
});

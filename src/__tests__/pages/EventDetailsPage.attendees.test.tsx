import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { User } from '@/lib/storage';
import EventDetailsPage from '@/pages/EventDetailsPage';
import { invalidatePrefix } from '@/lib/queryCache';

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

const makeUser = (id: string): User => ({
  id, name: id, email: `${id}@test.com`, role: 'organizer', password: 'x', avatar: '', profilePhoto: '',
  coverPhoto: '', bio: '', interests: [], dob: '', gender: '', isPremium: false, friends: [], createdAt: '',
  username: id,
}) as unknown as User;

const summary = (id: string, username: string | null, full: string) => ({
  id, username, full_name: full, display_name: username ?? full, avatar_kind: 'icon', icon_id: 'sun', avatar_url: null,
});
const row = (id: string, username: string | null, full: string, isFriend?: boolean) => ({
  user_id: id, status: 'going', profiles: { full_name: full, username: username ?? undefined },
  user: summary(id, username, full), ...(isFriend === undefined ? {} : { is_friend: isFriend }),
});

type Setup = { me: string; status: 'none' | 'going'; count: number; friends: unknown[]; list: unknown[] };

function setup({ me, status, count, friends, list }: Setup) {
  getCurrentUserMock.mockReturnValue(makeUser(me));
  getAuthTokenMock.mockReturnValue('tok-' + me);
  const calls: string[] = [];
  const json = (body: unknown, code = 200) =>
    Promise.resolve(new Response(JSON.stringify(body), { status: code, headers: { 'content-type': 'application/json' } }));
  vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    calls.push(url);
    if (url.includes('/api/events/evt-1')) {
      return json({
        id: 'evt-1', title: 'Test Event', description: 'd', category: 'Music',
        start_datetime: '2030-05-01T12:00:00.000Z', end_datetime: '2030-05-01T14:00:00.000Z',
        cost: 0, max_capacity: 50, location_name: 'Venue', latitude: 0, longitude: 0,
        created_by: 'org-1', status: 'active',
      });
    }
    if (url.endsWith('/participants/count')) return json({ event_id: 'evt-1', count });
    if (url.endsWith('/participants/friends')) return json(friends);
    if (url.endsWith('/my-status')) return json({ joined: status === 'going', status: status === 'going' ? 'going' : null });
    if (url.endsWith('/api/participants/evt-1/participants')) return json(list);
    return json({}, 404);
  }));
  return calls;
}

const renderPage = () =>
  render(
    <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }} initialEntries={['/event/evt-1']}>
      <Routes><Route path="/event/:id" element={<EventDetailsPage />} /></Routes>
    </MemoryRouter>,
  );

describe('EventDetailsPage: Attendees box with friends (#289)', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    invalidatePrefix('/api');
  });
  afterEach(() => vi.unstubAllGlobals());

  it('before joining: lists the attending friends with picture, full name and username, and the others as a number', async () => {
    const calls = setup({
      me: 'me', status: 'none', count: 5,
      friends: [row('f1', 'ann_a', 'Ann Archer', true), row('f2', null, 'Bob Baker', true)],
      list: [],
    });
    renderPage();

    expect(await screen.findByText('Friends attending this event')).toBeInTheDocument();
    const rows = screen.getAllByTestId('friend-attending-row');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent('Ann Archer');
    expect(rows[0]).toHaveTextContent('@ann_a');
    // An attendee without a username shows only the full name.
    expect(rows[1]).toHaveTextContent('Bob Baker');
    expect(rows[1]).not.toHaveTextContent('@');
    // 5 attend, 2 of them are friends: the other 3 are only a number.
    expect(screen.getByTestId('other-attendees-count')).toHaveTextContent('3 other people are going.');
    // The full list is not for people who have not joined: it is never requested.
    expect(calls.some((u) => u.endsWith('/api/participants/evt-1/participants'))).toBe(false);
  });

  it('before joining with no friend attending: only the number of attendees', async () => {
    setup({ me: 'me', status: 'none', count: 4, friends: [], list: [] });
    renderPage();

    await waitFor(() => expect(screen.getByText(/only the count is shown here/i)).toBeInTheDocument());
    // The number arrives from the count endpoint, which every signed-in user may read.
    await waitFor(() => expect(screen.getAllByText('4').length).toBeGreaterThan(0));
    expect(screen.queryByText('Friends attending this event')).not.toBeInTheDocument();
  });

  it('after joining: one list of all attendees with a "Friend" label on the friends only', async () => {
    setup({
      me: 'me', status: 'going', count: 3,
      friends: [row('f1', 'ann_a', 'Ann Archer', true)],
      list: [row('me', 'me', 'Me Myself', false), row('f1', 'ann_a', 'Ann Archer', true), row('s1', 'stan_s', 'Stan Stone', false)],
    });
    renderPage();

    await waitFor(() => expect(screen.getAllByTestId('friend-label')).toHaveLength(1));
    const list = screen.getByRole('list');
    expect(within(list).getByText('Ann Archer')).toBeInTheDocument();
    expect(within(list).getByText('Stan Stone')).toBeInTheDocument();
    const annRow = within(list).getByText('Ann Archer').closest('li') as HTMLElement;
    expect(within(annRow).getByTestId('friend-label')).toHaveTextContent('Friend');
    const stanRow = within(list).getByText('Stan Stone').closest('li') as HTMLElement;
    expect(within(stanRow).queryByTestId('friend-label')).not.toBeInTheDocument();
    // The "friends attending" section is only for people who have not joined.
    expect(screen.queryByText('Friends attending this event')).not.toBeInTheDocument();
  });

  it('after joining: an attendee without a username shows only the full name', async () => {
    setup({
      me: 'me', status: 'going', count: 2, friends: [],
      list: [row('me', 'me', 'Me Myself', false), row('n1', null, 'No Username', false)],
    });
    renderPage();

    const nameEl = await screen.findByText('No Username');
    const li = nameEl.closest('li') as HTMLElement;
    expect(within(li).queryByTestId('profile-username')).not.toBeInTheDocument();
    expect(li).not.toHaveTextContent('@');
  });

  it('the organizer still sees the list and the Remove button next to the other attendees', async () => {
    setup({
      me: 'org-1', status: 'none', count: 2, friends: [],
      list: [row('org-1', 'org_1', 'Organizer', false), row('p2', 'pat_p', 'Pat Park', false)],
    });
    renderPage();

    const patRow = (await screen.findByText('Pat Park')).closest('li') as HTMLElement;
    expect(within(patRow).getByRole('button', { name: /remove/i })).toBeInTheDocument();
    const ownRow = screen.getByText('Organizer', { selector: 'span' }).closest('li') as HTMLElement;
    expect(within(ownRow).queryByRole('button', { name: /remove/i })).not.toBeInTheDocument();
  });
});

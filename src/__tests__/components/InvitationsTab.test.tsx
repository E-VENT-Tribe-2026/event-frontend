import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import InvitationsTab from '@/components/InvitationsTab';
import { useMyInvitations } from '@/hooks/useMyInvitations';
import { clearAuthToken, setAuthToken } from '@/lib/auth';
import { invalidatePrefix } from '@/lib/queryCache';

const inviter = (id: string, username: string | null, full: string | null) => ({
  id,
  username,
  full_name: full,
  display_name: username ?? full ?? 'Someone',
  avatar_kind: 'icon',
  icon_id: 'sun',
  avatar_url: null,
});

const invitation = (id: number, who: ReturnType<typeof inviter>, eventId = 'ev-1', title = 'Summer Picnic') => ({
  invitation_id: id,
  created_at: '2026-10-10T10:00:00+00:00',
  inviter: who,
  event: { id: eventId, title, start_datetime: '2027-01-01T10:00:00+00:00' },
});

const ANN = inviter('u-ann', 'ann_a', 'Ann Archer');
const BOB = inviter('u-bob', 'bob_b', 'Bob Baker');

function mockApi(pages: Record<number, unknown>, options: { deleteStatus?: number; deleteBody?: unknown } = {}) {
  const calls: Array<{ method: string; url: string }> = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? 'GET';
      calls.push({ method, url });
      const json = (status: number, body: unknown) => ({ ok: status < 400, status, json: async () => body }) as Response;
      if (method === 'DELETE') return json(options.deleteStatus ?? 200, options.deleteBody ?? { message: 'Invitation dismissed' });
      const page = Number(new URL(url, 'http://x').searchParams.get('page') ?? 1);
      return json(200, pages[page] ?? { page, limit: 20, has_more: false, total: 0, data: [] });
    }),
  );
  return calls;
}

/** Tab plus a counter, the way the profile shows them. */
function Harness() {
  const { total } = useMyInvitations(true);
  return (
    <>
      <span data-testid="counter">{total}</span>
      <InvitationsTab viewerId="me" />
    </>
  );
}

const renderHarness = () =>
  render(
    <MemoryRouter initialEntries={['/profile']}>
      <Routes>
        <Route path="/profile" element={<Harness />} />
        <Route path="/event/:id" element={<div>Event details page</div>} />
      </Routes>
    </MemoryRouter>,
  );

describe('InvitationsTab', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    invalidatePrefix('/api');
    setAuthToken('mock-token');
  });
  afterEach(() => {
    clearAuthToken();
    vi.unstubAllGlobals();
  });

  it('lists each invitation as its own row with the inviter, also for several to one event', async () => {
    mockApi({
      1: { page: 1, limit: 20, has_more: false, total: 2, data: [invitation(11, ANN), invitation(12, BOB)] },
    });
    renderHarness();

    const rows = await screen.findAllByTestId('invitation-row');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent('Ann Archer has invited you to "Summer Picnic"');
    expect(rows[0]).toHaveTextContent('@ann_a');
    expect(rows[1]).toHaveTextContent('Bob Baker has invited you to "Summer Picnic"');
    expect(screen.getByTestId('counter')).toHaveTextContent('2');
  });

  it("opens the event's details when a row is selected", async () => {
    mockApi({ 1: { page: 1, limit: 20, has_more: false, total: 1, data: [invitation(11, ANN, 'ev-77')] } });
    renderHarness();

    fireEvent.click(await screen.findByTestId('invitation-row'));
    expect(await screen.findByText('Event details page')).toBeInTheDocument();
  });

  it('dismisses an invitation: the row goes away and the number goes down', async () => {
    const calls = mockApi({
      1: { page: 1, limit: 20, has_more: false, total: 2, data: [invitation(11, ANN), invitation(12, BOB)] },
    });
    renderHarness();
    await screen.findAllByTestId('invitation-row');

    fireEvent.click(screen.getAllByRole('button', { name: 'Dismiss' })[0]);

    await waitFor(() => expect(screen.getAllByTestId('invitation-row')).toHaveLength(1));
    expect(screen.queryByText(/Ann Archer/)).not.toBeInTheDocument();
    expect(screen.getByTestId('counter')).toHaveTextContent('1');
    expect(calls.some((c) => c.method === 'DELETE' && c.url.endsWith('/api/invitations/11'))).toBe(true);
    // Dismissing must not open the event.
    expect(screen.queryByText('Event details page')).not.toBeInTheDocument();
  });

  it('shows the backend reason when a dismissal is refused and keeps the row', async () => {
    mockApi(
      { 1: { page: 1, limit: 20, has_more: false, total: 1, data: [invitation(11, ANN)] } },
      { deleteStatus: 404, deleteBody: { detail: { code: 'invitation_not_found', message: 'Invitation not found.' } } },
    );
    renderHarness();
    await screen.findByTestId('invitation-row');

    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));

    expect(await screen.findByText('Invitation not found.')).toBeInTheDocument();
    expect(screen.getByTestId('counter')).toHaveTextContent('1');
  });

  it('shows an empty message when there are no invitations', async () => {
    mockApi({ 1: { page: 1, limit: 20, has_more: false, total: 0, data: [] } });
    renderHarness();
    expect(await screen.findByText('You have no invitations.')).toBeInTheDocument();
    expect(screen.getByTestId('counter')).toHaveTextContent('0');
  });

  it('loads more invitations on request', async () => {
    mockApi({
      1: { page: 1, limit: 20, has_more: true, total: 2, data: [invitation(11, ANN)] },
      2: { page: 2, limit: 20, has_more: false, total: 2, data: [invitation(12, BOB)] },
    });
    renderHarness();
    await screen.findByText(/Ann Archer/);
    fireEvent.click(screen.getByRole('button', { name: /load more/i }));

    expect(await screen.findByText(/Bob Baker/)).toBeInTheDocument();
    expect(screen.getByText(/Ann Archer/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /load more/i })).not.toBeInTheDocument();
  });
});

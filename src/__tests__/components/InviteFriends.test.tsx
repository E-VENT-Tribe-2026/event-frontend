import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import InviteFriendsDialog from '@/components/InviteFriendsDialog';
import InvitedByBanner from '@/components/InvitedByBanner';
import { clearAuthToken, setAuthToken } from '@/lib/auth';
import { invalidatePrefix } from '@/lib/queryCache';

const EVENT_ID = 'event-1';

const user = (id: string, username: string | null, full: string | null) => ({
  id,
  username,
  full_name: full,
  display_name: username ?? full ?? 'Someone',
  avatar_kind: 'icon',
  icon_id: 'sun',
  avatar_url: null,
});

const friend = (id: string, username: string, status: string, canInvite = status === 'can_invite') => ({
  user: user(id, username, `Name ${username}`),
  invite_status: status,
  can_invite: canInvite,
});

function mockApi(pages: Record<string, unknown>, options: { postStatus?: number; postBody?: unknown } = {}) {
  const calls: Array<{ method: string; url: string; body?: string }> = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? 'GET';
      calls.push({ method, url, body: init?.body as string | undefined });
      const json = (status: number, body: unknown) => ({ ok: status < 400, status, json: async () => body }) as Response;
      if (method === 'POST' && url.endsWith('/api/invitations')) {
        return json(options.postStatus ?? 201, options.postBody ?? { invitation_id: 1 });
      }
      const key = Object.keys(pages).find((k) => url.includes(k));
      return json(200, key ? pages[key] : { page: 1, limit: 20, has_more: false, data: [] });
    }),
  );
  return calls;
}

describe('InviteFriendsDialog', () => {
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

  const open = () => render(<InviteFriendsDialog open onOpenChange={() => {}} eventId={EVENT_ID} />);

  it('lists friends with an Invite button each', async () => {
    mockApi({
      'page=1': { page: 1, limit: 20, has_more: false, data: [friend('f1', 'ann', 'can_invite'), friend('f2', 'bob', 'can_invite')] },
    });
    open();
    expect(await screen.findByText('Name ann')).toBeInTheDocument();
    expect(screen.getByText('@bob')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Invite Name ann' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Invite Name bob' })).toBeEnabled();
  });

  it('greys out invited, attending and unavailable friends with short text and no reason', async () => {
    mockApi({
      'page=1': {
        page: 1, limit: 20, has_more: false,
        data: [friend('f1', 'ann', 'invited'), friend('f2', 'bob', 'attending'), friend('f3', 'cy', 'unavailable')],
      },
    });
    open();
    expect(await screen.findByText('Invited')).toBeInTheDocument();
    expect(screen.getByText('Attending')).toBeInTheDocument();
    expect(screen.getByText("Can't be invited")).toBeInTheDocument();
    for (const name of ['ann', 'bob', 'cy']) {
      expect(screen.getByRole('button', { name: `Invite Name ${name}` })).toBeDisabled();
    }
  });

  it('shows Invited on a friend right after inviting, without reopening', async () => {
    const calls = mockApi({ 'page=1': { page: 1, limit: 20, has_more: false, data: [friend('f1', 'ann', 'can_invite')] } });
    open();
    fireEvent.click(await screen.findByRole('button', { name: 'Invite Name ann' }));

    expect(await screen.findByText('Invited')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Invite Name ann' })).toBeDisabled();
    const post = calls.find((c) => c.method === 'POST');
    expect(JSON.parse(post!.body!)).toEqual({ event_id: EVENT_ID, invitee_id: 'f1' });
  });

  it('shows the backend reason when an invitation is refused and keeps the friend invitable', async () => {
    mockApi(
      { 'page=1': { page: 1, limit: 20, has_more: false, data: [friend('f1', 'ann', 'can_invite')] } },
      { postStatus: 409, postBody: { detail: { code: 'already_attending', message: 'This friend already attends the event.' } } },
    );
    open();
    fireEvent.click(await screen.findByRole('button', { name: 'Invite Name ann' }));

    expect(await screen.findByText('This friend already attends the event.')).toBeInTheDocument();
    expect(screen.queryByText('Invited')).not.toBeInTheDocument();
  });

  it('loads more friends on request', async () => {
    mockApi({
      'page=1': { page: 1, limit: 20, has_more: true, data: [friend('f1', 'ann', 'can_invite')] },
      'page=2': { page: 2, limit: 20, has_more: false, data: [friend('f2', 'bob', 'can_invite')] },
    });
    open();
    await screen.findByText('Name ann');
    fireEvent.click(screen.getByRole('button', { name: /load more/i }));

    expect(await screen.findByText('Name bob')).toBeInTheDocument();
    expect(screen.getByText('Name ann')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /load more/i })).not.toBeInTheDocument();
  });

  it('searches friends by text after typing stops', async () => {
    const calls = mockApi({
      'search=jo': { page: 1, limit: 20, has_more: false, data: [friend('f9', 'john', 'can_invite')] },
      'page=1': { page: 1, limit: 20, has_more: false, data: [friend('f1', 'ann', 'can_invite')] },
    });
    open();
    await screen.findByText('Name ann');
    fireEvent.change(screen.getByLabelText('Search friends'), { target: { value: 'jo' } });

    expect(await screen.findByText('Name john')).toBeInTheDocument();
    expect(screen.queryByText('Name ann')).not.toBeInTheDocument();
    expect(calls.some((c) => c.url.includes('search=jo'))).toBe(true);
  });
});

describe('InvitedByBanner', () => {
  const inviter = user('i1', 'zoe', 'Zoe Stone');

  it('names the inviter with full name and username', () => {
    render(<InvitedByBanner invitation={{ invited: true, invited_by: inviter, other_inviters_count: 0 }} />);
    expect(screen.getByText('Zoe Stone has invited you to this event')).toBeInTheDocument();
    expect(screen.getByText('@zoe')).toBeInTheDocument();
  });

  it('names the first inviter and the number of the others', () => {
    render(<InvitedByBanner invitation={{ invited: true, invited_by: inviter, other_inviters_count: 3 }} />);
    expect(screen.getByText('Zoe Stone and 3 others invited you')).toBeInTheDocument();
  });

  it('shows nothing when the user is not invited', () => {
    const { container } = render(<InvitedByBanner invitation={{ invited: false, invited_by: null, other_inviters_count: 0 }} />);
    expect(container).toBeEmptyDOMElement();
  });
});

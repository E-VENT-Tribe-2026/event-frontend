import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchNotifications } from '@/lib/notificationsApi';

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
}

const created = '2026-10-20T10:00:00Z';

describe('fetchNotifications — warning rows (ticket #294 Part 4)', () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => vi.unstubAllGlobals());

  it('maps the warning fields, with warning_id as a string', async () => {
    fetchMock.mockResolvedValue(jsonResponse([{
      id: 11,
      type: 'warning',
      message: 'Repeated spam in event chats.',
      is_warning: true,
      warning_id: 7,
      warning_acknowledged: false,
      warning_withdrawn: false,
      created_at: created,
      read: false,
    }]));
    const [row] = await fetchNotifications('token-warn-1');
    expect(row).toMatchObject({
      id: '11',
      type: 'warning',
      message: 'Repeated spam in event chats.',
      is_warning: true,
      warning_id: '7',
      warning_acknowledged: false,
      warning_withdrawn: false,
    });
  });

  it('keeps acknowledged and withdrawn flags', async () => {
    fetchMock.mockResolvedValue(jsonResponse([
      { id: 1, type: 'warning', message: 'A', is_warning: true, warning_id: 1, warning_acknowledged: true, warning_withdrawn: false },
      { id: 2, type: 'warning', message: 'B', is_warning: true, warning_id: 2, warning_acknowledged: false, warning_withdrawn: true },
    ]));
    const rows = await fetchNotifications('token-warn-2');
    expect(rows[0]).toMatchObject({ warning_acknowledged: true, warning_withdrawn: false });
    expect(rows[1]).toMatchObject({ warning_acknowledged: false, warning_withdrawn: true });
  });

  it('turns missing or odd warning values into null', async () => {
    fetchMock.mockResolvedValue(jsonResponse([
      { id: 3, type: 'warning', message: 'C', is_warning: true, warning_id: null, warning_acknowledged: 'yes' },
    ]));
    const [row] = await fetchNotifications('token-warn-3');
    expect(row).toMatchObject({ is_warning: true, warning_id: null, warning_acknowledged: null, warning_withdrawn: null });
  });

  it('adds no warning fields to any other row', async () => {
    fetchMock.mockResolvedValue(jsonResponse([
      { id: 21, type: 'event_updated', message: 'Picnic moved', created_at: created, read: true, warning_id: 99 },
      { id: 22, type: 'warning', message: 'Not flagged', is_warning: false, warning_id: 5, warning_acknowledged: true },
    ]));
    const [normal, unflagged] = await fetchNotifications('token-warn-4');

    expect(normal).toEqual({
      id: '21',
      type: 'event_updated',
      message: 'Picnic moved',
      related_event_id: null,
      related_user_id: null,
      event_title: null,
      created_at: created,
      read: true,
      actor_name: null,
    });
    for (const key of ['is_warning', 'warning_id', 'warning_acknowledged', 'warning_withdrawn']) {
      expect(normal).not.toHaveProperty(key);
      expect(unflagged).not.toHaveProperty(key);
    }
  });
});

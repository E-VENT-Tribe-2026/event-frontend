import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchNotifications } from '@/lib/notificationsApi';

const json = (body: unknown) =>
  new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });

const REMOVED_MESSAGE =
  'Your content was removed. Your message in "Sunset Picnic" was removed by an administrator: "you are all idiots...". This counts as a warning.';

describe('fetchNotifications: "Your content was removed" and "event removed" rows (#327)', () => {
  const fetchMock = vi.fn<typeof fetch>();
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('keeps the warning fields of a content_removed row, which is not a warning card (is_warning false)', async () => {
    fetchMock.mockResolvedValue(json([{
      id: 981, type: 'content_removed', event_id: 'evt-1', is_read: false, message: REMOVED_MESSAGE,
      warning_id: 32, is_warning: false, warning_acknowledged: false, warning_withdrawn: false,
      created_at: '2026-10-26T09:15:41Z',
    }]));
    const [row] = await fetchNotifications('token-removed-1');
    expect(row).toMatchObject({
      id: '981',
      type: 'content_removed',
      message: REMOVED_MESSAGE,
      related_event_id: 'evt-1',
      is_warning: false,
      warning_id: '32',
      warning_acknowledged: false,
      warning_withdrawn: false,
    });
  });

  it('keeps a content_removed row whose removal did not count as a warning (warning_id null)', async () => {
    fetchMock.mockResolvedValue(json([{
      id: 982, type: 'content_removed', event_id: 'evt-1', message: 'Your content was removed. Your event "X" was removed by an administrator.',
      warning_id: null, is_warning: false,
    }]));
    const [row] = await fetchNotifications('token-removed-2');
    expect(row.type).toBe('content_removed');
    expect(row.warning_id).toBeUndefined();
  });

  it('maps an event_removed row for a participant, without any warning fields', async () => {
    fetchMock.mockResolvedValue(json([{
      id: 990, type: 'event_removed', event_id: 'evt-1', message: 'Event "Sunset Picnic" was removed by an administrator.',
      warning_id: null, is_warning: false,
    }]));
    const [row] = await fetchNotifications('token-removed-3');
    expect(row).toMatchObject({ id: '990', type: 'event_removed', related_event_id: 'evt-1' });
    expect(row.is_warning).toBeUndefined();
  });
});

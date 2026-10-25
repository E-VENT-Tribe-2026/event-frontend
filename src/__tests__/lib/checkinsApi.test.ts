import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  fetchEventCheckinCode,
  fetchEventCheckins,
  submitEventCheckin,
  messageForCheckinStatus,
  parseCheckinList,
} from '@/lib/checkinsApi';
import * as authModule from '@/lib/auth';

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('checkinsApi', () => {
  beforeEach(() => {
    vi.spyOn(authModule, 'getAuthToken').mockReturnValue('tok');
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('loads the organizer door code from GET /check-in-code', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse({ event_id: 'evt-1', code: '482193', qr_content: '482193' }),
    );

    const door = await fetchEventCheckinCode('evt-1');
    expect(door).toEqual({ event_id: 'evt-1', code: '482193', qr_content: '482193' });
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/events/evt-1/check-in-code'),
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer tok' }) }),
    );
  });

  it('loads check-ins with times for the organizer', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse({
        event_id: 'evt-1',
        checked_in_count: 2,
        participant_count: 5,
        viewer_checked_in: true,
        include_times: true,
        items: [
          {
            user: { id: 'u1', username: 'ada', full_name: 'Ada' },
            checked_in_at: '2026-10-25T20:01:00+00:00',
          },
        ],
      }),
    );

    const summary = await fetchEventCheckins('evt-1');
    expect(summary?.include_times).toBe(true);
    expect(summary?.viewer_checked_in).toBe(true);
    expect(summary?.checkins[0]).toMatchObject({
      user_id: 'u1',
      username: 'ada',
      checked_in_at: '2026-10-25T20:01:00+00:00',
    });
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/events/evt-1/check-ins'),
      expect.anything(),
    );
  });

  it('posts a typed code and a scanned QR as separate bodies', async () => {
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse({
        checked_in: true,
        already_checked_in: false,
        checked_in_at: '2026-10-25T20:01:00+00:00',
      }),
    );

    await submitEventCheckin('evt-1', '482193', 'code');
    expect(JSON.parse(String(vi.mocked(fetch).mock.calls[0][1]?.body))).toEqual({ code: '482193' });

    await submitEventCheckin('evt-1', '482193', 'qr_content');
    expect(JSON.parse(String(vi.mocked(fetch).mock.calls[1][1]?.body))).toEqual({ qr_content: '482193' });
    expect(String(vi.mocked(fetch).mock.calls[0][0])).toContain('/api/events/evt-1/check-in');
  });

  it('maps 400, 403 and 429 replies', () => {
    expect(messageForCheckinStatus(400)).toMatch(/not valid|cancelled|closed/i);
    expect(messageForCheckinStatus(403)).toMatch(/joined this event/i);
    expect(messageForCheckinStatus(429)).toMatch(/wrong codes/i);
  });

  it('strips times when include_times is false', () => {
    const summary = parseCheckinList({
      checked_in_count: 2,
      participant_count: 5,
      viewer_checked_in: true,
      include_times: false,
      items: [{ user: { id: 'u1', username: 'ada' }, checked_in_at: '2026-10-25T20:01:00+00:00' }],
    });
    expect(summary.include_times).toBe(false);
    expect(summary.checkins[0].checked_in_at).toBeNull();
    expect(summary.viewer_checked_in).toBe(true);
  });
});

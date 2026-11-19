import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createReport, messageForReportStatus } from '@/lib/reportsApi';
import * as authModule from '@/lib/auth';

function jsonResponse(body: unknown, status = 201) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('reportsApi', () => {
  beforeEach(() => {
    vi.spyOn(authModule, 'getAuthToken').mockReturnValue('tok');
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('posts to /api/reports with the report payload', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse({
        id: 9,
        status: 'open',
        target_type: 'message',
        target_id: '42',
        reason: 'harassment_or_hate',
        origin: 'event_chat',
        created_at: '2026-10-25T20:00:00Z',
        message: 'Report received.',
      }),
    );

    const result = await createReport({
      target_type: 'message',
      target_id: '42',
      reason: 'harassment_or_hate',
      origin: 'event_chat',
      description: 'Keeps insulting other participants.',
    });

    expect(result.id).toBe(9);
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/reports'),
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer tok',
          'Content-Type': 'application/json',
        }),
        body: JSON.stringify({
          target_type: 'message',
          target_id: '42',
          reason: 'harassment_or_hate',
          origin: 'event_chat',
          description: 'Keeps insulting other participants.',
        }),
      }),
    );
  });

  it('requires a description when the reason is other', async () => {
    await expect(
      createReport({
        target_type: 'event',
        target_id: 'e1',
        reason: 'other',
        origin: 'event_details',
      }),
    ).rejects.toThrow('Please describe what happened.');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('maps already_reported to a clear message', () => {
    expect(messageForReportStatus(409, { detail: { code: 'already_reported' } })).toBe(
      'You already have an open report about this.',
    );
  });
});

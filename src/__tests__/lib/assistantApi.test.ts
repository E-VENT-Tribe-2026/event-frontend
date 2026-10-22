import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  sendAssistantChat,
  searchAssistantEvents,
  getAssistantEventDetails,
  draftAssistantEvent,
  extractCardsFromReply,
  AssistantApiError,
} from '@/lib/assistantApi';
import * as authModule from '@/lib/auth';

describe('assistantApi', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(authModule, 'getAuthToken').mockReturnValue('mock-jwt-token');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('extractCardsFromReply', () => {
    it('extracts direct cards and event arrays from response object', () => {
      const responseObj = {
        reply: 'Here are the events',
        events: [
          {
            id: 'evt-1',
            title: 'Indie Concert',
            category: 'Music',
            start_datetime: '2026-11-01T20:00:00Z',
          },
        ],
      };

      const result = extractCardsFromReply(responseObj.reply, responseObj);
      expect(result.displayText).toBe('Here are the events');
      expect(result.events).toHaveLength(1);
      expect(result.events?.[0].title).toBe('Indie Concert');
    });

    it('extracts embedded JSON codeblocks from markdown reply', () => {
      const reply = `I found some great options for you!
\`\`\`json
{
  "events": [
    {
      "id": "e123",
      "title": "Techno Night",
      "category": "Nightlife",
      "cost": 15
    }
  ]
}
\`\`\`
Let me know if you want to join!`;

      const result = extractCardsFromReply(reply);
      expect(result.events).toHaveLength(1);
      expect(result.events?.[0].title).toBe('Techno Night');
      expect(result.displayText).toContain('I found some great options for you!');
      expect(result.displayText).toContain('Let me know if you want to join!');
      expect(result.displayText).not.toContain('```json');
    });

    it('extracts draft event payload from embedded JSON', () => {
      const reply = `Here is your draft:
\`\`\`json
{
  "draft": {
    "title": "Weekend Hackathon",
    "category": "Technology",
    "cost": 0,
    "max_capacity": 100
  },
  "validation_issues": ["Start time required"]
}
\`\`\`
Ready to publish?`;

      const result = extractCardsFromReply(reply);
      expect(result.draft?.title).toBe('Weekend Hackathon');
      expect(result.validationIssues).toContain('Start time required');
      expect(result.displayText).toContain('Ready to publish?');
    });
  });

  describe('sendAssistantChat', () => {
    it('transmits full turn history and passes Bearer token', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          reply: 'E-VENT helps you discover and organize local events.',
        }),
      });
      global.fetch = fetchMock;

      const history = [
        { role: 'user' as const, content: 'What is E-VENT?' },
        { role: 'assistant' as const, content: 'It is an event platform.' },
        { role: 'user' as const, content: 'How do I create an event?' },
      ];

      const res = await sendAssistantChat(history);
      expect(res.reply).toContain('E-VENT helps you discover');

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const call = fetchMock.mock.calls[0];
      const [url, options] = call;

      expect(url).toContain('/api/assistant/chat');
      expect(options.method).toBe('POST');
      expect(options.headers).toMatchObject({
        Authorization: 'Bearer mock-jwt-token',
        'Content-Type': 'application/json',
      });

      const body = JSON.parse(options.body);
      expect(body.messages).toHaveLength(3);
      expect(body.messages[0]).toEqual({ role: 'user', content: 'What is E-VENT?' });
      expect(body.messages[2]).toEqual({ role: 'user', content: 'How do I create an event?' });
    });

    it('handles 401 Unauthorized and notifies auth expired', async () => {
      const notifySpy = vi.spyOn(authModule, 'notifyAuthExpired');
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({ detail: 'Unauthorized' }),
      });

      await expect(
        sendAssistantChat([{ role: 'user', content: 'test' }])
      ).rejects.toThrow(/session has expired/i);

      expect(notifySpy).toHaveBeenCalledTimes(1);
    });

    it('handles 502 Bad Gateway and 503 Service Unavailable with retryable error', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
        json: async () => ({ error: { message: 'Overloaded', code: 'SERVICE_UNAVAILABLE' } }),
      });

      try {
        await sendAssistantChat([{ role: 'user', content: 'hello' }]);
        expect.unreachable('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(AssistantApiError);
        const apiErr = err as AssistantApiError;
        expect(apiErr.status).toBe(503);
        expect(apiErr.canRetry).toBe(true);
        expect(apiErr.message).toContain('503');
      }
    });

    it('handles 422 Unprocessable Entity error', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 422,
        json: async () => ({ error: { message: 'Invalid turn format', code: 'VALIDATION_ERROR' } }),
      });

      await expect(
        sendAssistantChat([{ role: 'user', content: 'bad format' }])
      ).rejects.toThrow(/422/);
    });

    it('handles network drops with clear retryable message', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Failed to fetch'));

      try {
        await sendAssistantChat([{ role: 'user', content: 'test' }]);
        expect.unreachable('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(AssistantApiError);
        const apiErr = err as AssistantApiError;
        expect(apiErr.canRetry).toBe(true);
        expect(apiErr.message).toContain('Network connection dropped');
      }
    });
  });

  describe('tools endpoints', () => {
    it('calls searchAssistantEvents', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          request_id: 'req-1',
          success: true,
          events: [{ id: 'evt-1', title: 'Music Fest' }],
        }),
      });

      const res = await searchAssistantEvents('music');
      expect(res.success).toBe(true);
      expect(res.events[0].title).toBe('Music Fest');
    });

    it('calls draftAssistantEvent', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          request_id: 'req-2',
          success: true,
          draft: { title: 'Hackathon', category: 'Technology' },
          validation_issues: [],
        }),
      });

      const res = await draftAssistantEvent('Hackathon in Berlin');
      expect(res.success).toBe(true);
      expect(res.draft.title).toBe('Hackathon');
    });

    it('calls getAssistantEventDetails', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          request_id: 'req-3',
          success: true,
          event: { id: 'evt-9', title: 'Art Gallery' },
        }),
      });

      const res = await getAssistantEventDetails('evt-9');
      expect(res.success).toBe(true);
      expect(res.event.title).toBe('Art Gallery');
    });
  });
});

import { describe, it, expect } from 'vitest';
import { displayChatContent, encodeChatPayload, parseChatPayload } from '@/lib/chatPayload';

describe('chatPayload', () => {
  it('round-trips poll and check-in payloads', () => {
    const poll = encodeChatPayload({
      v: 1,
      type: 'poll',
      pollId: 'p1',
      question: 'Pizza or tacos?',
      options: ['Pizza', 'Tacos'],
      text: 'Pizza or tacos?',
    });
    expect(parseChatPayload(poll)).toMatchObject({ type: 'poll', pollId: 'p1', options: ['Pizza', 'Tacos'] });
    expect(parseChatPayload(encodeChatPayload({ v: 1, type: 'checkin', text: 'Ada is here' }))?.type).toBe('checkin');
    expect(parseChatPayload('just a message')).toBeNull();
  });

  it('shows the words from a stored text payload, not the JSON', () => {
    expect(displayChatContent('{"v":1,"type":"text","text":"hi all"}')).toBe('hi all');
    expect(displayChatContent({ v: 1, type: 'text', text: 'hi all' })).toBe('hi all');
    expect(displayChatContent('plain words')).toBe('plain words');
  });
});

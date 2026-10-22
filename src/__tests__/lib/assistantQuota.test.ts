import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  BASIC_ASSISTANT_ASKS_PER_DAY,
  assistantQuota,
  consumeAssistantAsk,
} from '@/lib/assistantQuota';

const USER = 'quota-user';
const KEY = `event_assistant_quota:${USER}`;

describe('assistantQuota', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    window.localStorage.clear();
  });

  it('gives Basic accounts five asks and Pro unlimited', () => {
    expect(assistantQuota(USER, false)).toEqual({
      unlimited: false,
      remaining: BASIC_ASSISTANT_ASKS_PER_DAY,
      used: 0,
      limit: BASIC_ASSISTANT_ASKS_PER_DAY,
    });
    expect(assistantQuota(USER, true).unlimited).toBe(true);
    expect(consumeAssistantAsk(USER, true)).toBe(true);
    expect(assistantQuota(USER, true).unlimited).toBe(true);
  });

  it('stops Basic asks after the daily limit', () => {
    for (let i = 0; i < BASIC_ASSISTANT_ASKS_PER_DAY; i++) {
      expect(consumeAssistantAsk(USER, false)).toBe(true);
    }
    expect(consumeAssistantAsk(USER, false)).toBe(false);
    expect(assistantQuota(USER, false).remaining).toBe(0);
  });

  it('resets when the stored date is not today', () => {
    window.localStorage.setItem(KEY, JSON.stringify({ date: '2000-01-01', used: 5 }));
    expect(assistantQuota(USER, false).remaining).toBe(BASIC_ASSISTANT_ASKS_PER_DAY);
    expect(consumeAssistantAsk(USER, false)).toBe(true);
    expect(assistantQuota(USER, false).used).toBe(1);
  });
});

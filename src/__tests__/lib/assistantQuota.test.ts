import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  ASSISTANT_QUOTA_DISABLED,
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

  it('gives five asks per day', () => {
    expect(assistantQuota(USER)).toEqual(
      ASSISTANT_QUOTA_DISABLED
        ? { remaining: 1, used: 0, limit: BASIC_ASSISTANT_ASKS_PER_DAY }
        : {
            remaining: BASIC_ASSISTANT_ASKS_PER_DAY,
            used: 0,
            limit: BASIC_ASSISTANT_ASKS_PER_DAY,
          },
    );
  });

  it('stops asks after the daily limit', () => {
    for (let i = 0; i < BASIC_ASSISTANT_ASKS_PER_DAY; i++) {
      expect(consumeAssistantAsk(USER)).toBe(true);
    }
    if (ASSISTANT_QUOTA_DISABLED) {
      expect(consumeAssistantAsk(USER)).toBe(true);
      return;
    }
    expect(consumeAssistantAsk(USER)).toBe(false);
    expect(assistantQuota(USER).remaining).toBe(0);
  });

  it('resets when the stored date is not today', () => {
    window.localStorage.setItem(KEY, JSON.stringify({ date: '2000-01-01', used: 5 }));
    expect(assistantQuota(USER).remaining).toBe(BASIC_ASSISTANT_ASKS_PER_DAY);
    expect(consumeAssistantAsk(USER)).toBe(true);
    expect(assistantQuota(USER).used).toBe(1);
  });
});

import { describe, it, expect } from 'vitest';
import { accountPlanFrom, accountPlanLabel, BASIC_PERKS, PRO_PERKS } from '@/lib/accountPlan';

describe('accountPlanFrom', () => {
  it('treats a missing plan as Basic', () => {
    expect(accountPlanFrom(null)).toBe('basic');
    expect(accountPlanFrom({})).toBe('basic');
    expect(accountPlanFrom({ isPremium: false })).toBe('basic');
    expect(accountPlanLabel('basic')).toBe('Basic');
  });

  it('reads Pro from isPremium, is_premium, account_type or plan', () => {
    expect(accountPlanFrom({ isPremium: true })).toBe('pro');
    expect(accountPlanFrom({ is_premium: true })).toBe('pro');
    expect(accountPlanFrom({ account_type: 'pro' })).toBe('pro');
    expect(accountPlanFrom({ account_type: 'basic' })).toBe('basic');
    expect(accountPlanFrom({ plan: 'premium' })).toBe('pro');
    expect(accountPlanFrom('pro')).toBe('pro');
    expect(accountPlanLabel('pro')).toBe('Pro');
  });

  it('lists friend activity on Basic, not Pro', () => {
    expect(BASIC_PERKS).toContain('See what your friends are up to');
    expect(PRO_PERKS).not.toContain('See what your friends are up to');
  });

  it('lists custom banners, recurring events and unlimited AI on Pro', () => {
    expect(BASIC_PERKS).toContain('5 AI assistant asks per day');
    expect(PRO_PERKS).toContain('Custom event banners');
    expect(PRO_PERKS).toContain('Recurring events');
    expect(PRO_PERKS).toContain('Unlimited AI assistant');
  });
});

export type AccountPlan = 'basic' | 'pro';

export const PRO_MONTHLY_EUR = 5;
export const PRO_PRICE_LABEL = `€${PRO_MONTHLY_EUR}/mo`;

/** Read Basic vs Pro from a user, profile payload, or a plan string. Missing data is Basic. */
export function accountPlanFrom(source: unknown): AccountPlan {
  if (source === true || source === 1) return 'pro';
  if (typeof source === 'string') {
    const s = source.toLowerCase().trim();
    if (s === 'pro' || s === 'premium' || s === 'plus') return 'pro';
    return 'basic';
  }
  if (!source || typeof source !== 'object') return 'basic';
  const o = source as Record<string, unknown>;
  if (o.isPremium === true) return 'pro';
  if (o.is_premium === true || o.is_premium === 1 || o.is_premium === 'true') return 'pro';
  return accountPlanFrom(o.account_type ?? o.account_plan ?? o.plan ?? o.subscription ?? o.tier);
}

export function accountPlanLabel(plan: AccountPlan): string {
  return plan === 'pro' ? 'Pro' : 'Basic';
}

export const BASIC_PERKS = [
  'Discover and join events',
  'See what your friends are up to',
  'Chat with people at events you joined',
  'Friends, invitations and notifications',
  '5 AI assistant asks per day',
];

export const PRO_PERKS = [
  'Custom event banners',
  'Recurring events',
  'Unlimited AI assistant',
  'Boost events so more people find them',
  'Analytics for events you organize',
  'Priority listing in search and home',
];

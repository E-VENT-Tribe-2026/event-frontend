import { getApiUrl } from '@/lib/api';
import type { EventItem } from '@/lib/storage';

export const EMPTY_EVENTS: EventItem[] = [];
export const EMPTY_SET = new Set<string>();
export const INTEREST_PROMPT_DISMISSED_KEY = 'event_interest_prompt_dismissed';

export const SUGGESTIONS_PATH = '/api/friends/suggestions';
export const MAX_SUGGESTIONS = 5;
export const PAGE = 6;
export const UPCOMING_PREVIEW = 4;

export type SuggestedUser = {
  id: string;
  username?: string | null;
  full_name?: string | null;
  display_name?: string | null;
  avatar_url?: string | null;
};

const FRIEND_LIST_PATHS = ['/api/friends', '/api/blocks'];
const REQUEST_PATHS = [
  '/api/friends/requests/sent?page=1&limit=50',
  '/api/friends/requests/incoming?page=1&limit=50',
];

/** Treat missing/invalid cost as free (€0). */
export function eventBudgetAmount(budget: unknown): number {
  const n = Number(budget);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export function isBudgetInRange(budget: unknown, min: number, max: number): boolean {
  const amount = eventBudgetAmount(budget);
  const lo = Math.min(min, max);
  const hi = Math.max(min, max);
  return amount >= lo && amount <= hi;
}

export function clampBudgetMin(value: number, budgetMax: number): number {
  return Math.min(Math.max(0, value), budgetMax);
}

export function clampBudgetMax(value: number, budgetMin: number, maxPrice: number): number {
  const ceiling = Math.max(0, maxPrice);
  return Math.min(Math.max(budgetMin, value), ceiling);
}

/** Range input max: never 0, otherwise the thumbs cannot be dragged back up. */
export const BUDGET_SLIDER_FALLBACK = 500;

export function budgetSliderMax(apiMax: unknown): number {
  return typeof apiMax === 'number' && Number.isFinite(apiMax) && apiMax > 0
    ? apiMax
    : BUDGET_SLIDER_FALLBACK;
}

export function toArray(body: unknown): any[] {
  if (Array.isArray(body)) return body;
  if (body && typeof body === 'object') {
    for (const v of Object.values(body as Record<string, unknown>)) {
      if (Array.isArray(v)) return v;
    }
  }
  return [];
}

export function collectUserIds(body: unknown, selfId: string | undefined, rowsAreUsers: boolean): string[] {
  const ids: string[] = [];
  for (const item of toArray(body)) {
    if (!item || typeof item !== 'object') continue;
    const o = item as Record<string, any>;
    const found = [
      o.user?.id, o.friend?.id, o.sender?.id, o.receiver?.id, o.requester?.id, o.addressee?.id,
      o.to_user?.id, o.target?.id,
      o.user_id, o.friend_id, o.sender_id, o.receiver_id, o.requester_id, o.addressee_id,
      o.to_user_id, o.target_id, o.receiver_user_id,
    ].filter((v): v is string => typeof v === 'string' && v.trim() !== '');
    if (found.length === 0 && rowsAreUsers && typeof o.id === 'string') found.push(o.id);
    for (const id of found) if (id !== selfId) ids.push(id);
  }
  return ids;
}

export async function fetchExcludedIds(token: string, selfId: string | undefined): Promise<string[]> {
  const jobs = [
    ...FRIEND_LIST_PATHS.map((p) => ({ path: p, rowsAreUsers: true })),
    ...REQUEST_PATHS.map((p) => ({ path: p, rowsAreUsers: false })),
  ];
  const results = await Promise.all(
    jobs.map(async ({ path, rowsAreUsers }) => {
      try {
        const res = await fetch(getApiUrl(path), {
          headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
        });
        if (!res.ok) return [] as string[];
        return collectUserIds(await res.json().catch(() => null), selfId, rowsAreUsers);
      } catch {
        return [] as string[];
      }
    }),
  );
  return results.flat();
}

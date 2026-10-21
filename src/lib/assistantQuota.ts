export const BASIC_ASSISTANT_ASKS_PER_DAY = 5;
const STORAGE_PREFIX = 'event_assistant_quota:';

function todayStamp(): string {
  return new Date().toISOString().slice(0, 10);
}

function storageKey(userId: string | undefined): string {
  return `${STORAGE_PREFIX}${userId || 'anon'}`;
}

type QuotaRecord = { date: string; used: number };

function readRecord(userId: string | undefined): QuotaRecord {
  const empty = { date: todayStamp(), used: 0 };
  if (typeof window === 'undefined') return empty;
  try {
    const raw = window.localStorage.getItem(storageKey(userId));
    if (!raw) return empty;
    const parsed = JSON.parse(raw) as QuotaRecord;
    if (!parsed || parsed.date !== todayStamp()) return empty;
    const used = Number(parsed.used);
    return { date: parsed.date, used: Number.isFinite(used) && used > 0 ? Math.floor(used) : 0 };
  } catch {
    return empty;
  }
}

function writeRecord(userId: string | undefined, record: QuotaRecord) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(storageKey(userId), JSON.stringify(record));
  } catch {
    /* quota / private mode */
  }
}

export type AssistantQuota = {
  unlimited: boolean;
  remaining: number;
  used: number;
  limit: number;
};

export function assistantQuota(userId: string | undefined, isPro: boolean): AssistantQuota {
  if (isPro) {
    return { unlimited: true, remaining: Number.POSITIVE_INFINITY, used: 0, limit: Number.POSITIVE_INFINITY };
  }
  const { used } = readRecord(userId);
  const capped = Math.min(BASIC_ASSISTANT_ASKS_PER_DAY, Math.max(0, used));
  return {
    unlimited: false,
    remaining: Math.max(0, BASIC_ASSISTANT_ASKS_PER_DAY - capped),
    used: capped,
    limit: BASIC_ASSISTANT_ASKS_PER_DAY,
  };
}

/** Spend one Basic ask. Pro always succeeds. Returns false when the daily limit is hit. */
export function consumeAssistantAsk(userId: string | undefined, isPro: boolean): boolean {
  if (isPro) return true;
  const current = assistantQuota(userId, false);
  if (current.remaining <= 0) return false;
  writeRecord(userId, { date: todayStamp(), used: current.used + 1 });
  return true;
}

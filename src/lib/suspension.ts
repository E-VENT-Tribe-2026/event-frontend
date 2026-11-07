// Account suspension (ticket #294, Part 5).
//
// Backend contract: sign-in and every authenticated request of a suspended
// account answer 403 with
//   detail: { code: 'account_suspended', message: 'Your account is suspended.', reason: string | null }
// Wrong credentials still answer 401.

const ACCOUNT_SUSPENDED_CODE = 'account_suspended';

export type SuspensionNotice = {
  /** The administrator's reason, or null when none was given. Render as plain text. */
  reason: string | null;
};

/**
 * Reads the `detail` of an error response. Returns a SuspensionNotice only when
 * `detail.code === 'account_suspended'`, otherwise null. A blank reason becomes null.
 */
export function readSuspension(detail: unknown): SuspensionNotice | null {
  if (!detail || typeof detail !== 'object') return null;
  const d = detail as { code?: unknown; reason?: unknown };
  if (d.code !== ACCOUNT_SUSPENDED_CODE) return null;
  const reason = typeof d.reason === 'string' && d.reason.trim() ? d.reason : null;
  return { reason };
}

/** Username rules (FR 7.3) — shared client validation. */

export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 20;

/** Visible next to the username field while the user types. */
export const USERNAME_RULES_HINT =
  '3–20 characters · lowercase letters, digits, _ and . · no spaces · cannot be changed later';

const USERNAME_PATTERN = /^[a-z0-9._]+$/;

export function normalizeUsername(value: string): string {
  return value.trim().toLowerCase();
}

/** Returns a specific rule message, or null if valid. */
export function getUsernameValidationError(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return 'Username is required';
  if (/\s/.test(trimmed)) return 'Username cannot contain spaces';
  const normalized = trimmed.toLowerCase();
  if (normalized.length < USERNAME_MIN_LENGTH) {
    return `Username must be at least ${USERNAME_MIN_LENGTH} characters`;
  }
  if (normalized.length > USERNAME_MAX_LENGTH) {
    return `Username must be at most ${USERNAME_MAX_LENGTH} characters`;
  }
  if (!USERNAME_PATTERN.test(normalized)) {
    return 'Username may only use lowercase English letters, digits, underscores and full stops';
  }
  return null;
}

export function isUsernameValid(raw: string): boolean {
  return getUsernameValidationError(raw) === null;
}

export function hasChosenUsername(username?: string | null): boolean {
  return Boolean(username?.trim());
}

export const FULL_NAME_RULES_HINT =
  '3–50 characters · letters, spaces and common punctuation · shown as username (Full Name)';

const FULL_NAME_PATTERN = /^[\p{L}][\p{L}\s.'’,()-]*[\p{L}.]$/u;

/** Trim only. The saved value keeps the letters the user typed. */
export function normalizeFullName(value: string): string {
  return value.trim();
}

export function getFullNameValidationError(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return 'Full name is required';
  if (trimmed.length < 3) return 'Full name must be at least 3 characters';
  if (trimmed.length > 50) return 'Full name must be at most 50 characters';
  if (!FULL_NAME_PATTERN.test(trimmed)) {
    return 'Full name may only use letters, spaces and common punctuation';
  }
  return null;
}

/** Accounts without a username must pick one, and a full name, before the app. */
export function destinationAfterSignIn(username?: string | null): '/home' | '/choose-username' {
  return hasChosenUsername(username) ? '/home' : '/choose-username';
}

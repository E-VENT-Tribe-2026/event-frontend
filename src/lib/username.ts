export const USERNAME_RULES_HINT =
  '3–20 characters. Lowercase letters, digits, underscores and full stops. No spaces. Capital letters are saved as lowercase.';

export const FULL_NAME_RULES_HINT =
  '3–50 characters once spaces at the ends are removed. Letters, spaces and common punctuation. Stored as you type it.';

const FULL_NAME_PATTERN = /^[^\W\d_]+(?:[ '\u2019.,\-]+[^\W\d_]+)*$/u;

/** username (Full Name), or the full name when no username has been chosen. */
export function formatUserDisplayName(username?: string | null, fullName?: string | null): string {
  const user = (username || '').trim();
  const name = (fullName || '').trim();
  if (user && name) return `${user} (${name})`;
  if (name) return name;
  if (user) return user;
  return '';
}

export function hasChosenUsername(username: unknown): boolean {
  return typeof username === 'string' && username.trim().length > 0;
}

/** Accounts without a username must pick one, and a full name, before the app. */
export function destinationAfterSignIn(username: unknown): '/home' | '/choose-username' {
  return hasChosenUsername(username) ? '/home' : '/choose-username';
}

export function normalizeUsername(value: string): string {
  return value.trim().toLowerCase();
}

/** Which username rule is broken, or null when the value can be registered. */
export function usernameError(value: string): string | null {
  if (!value.trim()) return 'Username is required';
  if (/\s/.test(value)) return 'Username cannot contain spaces';
  const normalized = normalizeUsername(value);
  if (normalized.length < 3) return 'Username must be at least 3 characters';
  if (normalized.length > 20) return 'Username must be at most 20 characters';
  if (!/^[a-z0-9._]+$/.test(normalized)) {
    return 'Username may only use lowercase English letters, digits, underscores and full stops';
  }
  return null;
}

/** Which full-name rule is broken, or null when the value can be registered. */
export function fullNameError(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return 'Full name is required';
  if (trimmed.length < 3) return 'Full name must be at least 3 characters';
  if (trimmed.length > 50) return 'Full name must be at most 50 characters';
  if (!FULL_NAME_PATTERN.test(trimmed)) {
    return 'Full name may only use letters, spaces and common punctuation';
  }
  return null;
}

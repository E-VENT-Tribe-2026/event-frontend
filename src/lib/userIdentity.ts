export interface IdentifiableUser {
  /** Empty/undefined means "no username chosen yet". */
  username?: string;
  fullName: string;
}

/** Returns `username (Full Name)`, or just the full name if no username yet. */
export function formatUserIdentity(user: IdentifiableUser): string {
  const username = user.username?.trim();
  const fullName = user.fullName?.trim() || 'Unknown user';
  return username ? `${username} (${fullName})` : fullName;
}
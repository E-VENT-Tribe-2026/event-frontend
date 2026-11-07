import { getAuthToken } from './auth';
import { getCurrentUser } from './storage';

/** True when this browser has a session token or a signed-in user snapshot. */
export function hasSignedInSession(): boolean {
  return Boolean(getAuthToken() || getCurrentUser());
}

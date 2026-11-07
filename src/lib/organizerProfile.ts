import { getApiUrl } from '@/lib/api';
import { getAuthToken } from '@/lib/auth';
import { cachedFetch, TTL } from '@/lib/queryCache';

export type OrganizerProfile = {
  full_name?: string;
  username?: string;
  avatar_url?: string;
};

export function organizerProfileCacheKey(userId: string) {
  return `/api/profile/${userId}:organizer`;
}

export async function fetchOrganizerProfile(userId: string): Promise<OrganizerProfile | null> {
  if (!userId.trim()) return null;
  return cachedFetch(
    organizerProfileCacheKey(userId),
    async () => {
      const token = getAuthToken();
      const headers: Record<string, string> = { Accept: 'application/json' };
      if (token) headers.Authorization = `Bearer ${token}`;
      const res = await fetch(getApiUrl(`/api/profile/${userId}`), { headers });
      if (!res.ok) return null;
      const profData = await res.json().catch(() => null);
      const prof = profData?.data || profData?.profile || profData;
      if (!prof || typeof prof !== 'object') return null;
      return {
        full_name: prof.full_name || prof.name || prof.username,
        username: prof.username,
        avatar_url: prof.avatar_url,
      } as OrganizerProfile;
    },
    TTL.MEDIUM,
  ).catch(() => null);
}

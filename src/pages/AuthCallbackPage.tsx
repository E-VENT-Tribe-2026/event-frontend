import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { setAuthToken, clearAuthToken } from '@/lib/auth';
import { readSuspension, type SuspensionNotice } from '@/lib/suspension';
import { setCurrentUserFromOAuth } from '@/lib/storage';
import { getApiUrl } from '@/lib/api';
import { API_ENDPOINTS } from '@/lib/apiUrls';
import { destinationAfterSignIn, hasChosenUsername } from '@/lib/username';
import { pickDefaultIconUrl } from '@/lib/uploadAvatar';
import { rememberGoogleName } from '@/pages/ChooseUsernamePage';
import { fetchMfaStatus, needsAdminVerification, setPendingAdminVerification } from '@/lib/adminAuth';
import { consumeOAuthNextPath } from '@/lib/oauthRedirect';
import { isPasswordResetAuthType, readAuthLinkType } from '@/lib/authLink';

function normalizeNextPath(raw: string | null): string {
  const fallback = '/home';
  if (!raw?.trim()) return fallback;
  try {
    // Use URL API to robustly detect cross-origin redirects
    const url = new URL(raw.trim(), window.location.origin);
    if (url.origin !== window.location.origin) return fallback;
    const path = url.pathname;
    // Only allow known app routes — reject bare '/' and anything suspicious
    if (path === '/' || path.length > 200) return fallback;
    return path + url.search;
  } catch {
    return fallback;
  }
}

/**
 * Google sign-in never calls /api/auth/login, so a suspension is checked here.
 * Returns the notice only for a 403 with the suspended code; anything else
 * (success, other errors, network failure) returns null so sign-in continues.
 */
async function fetchSuspension(accessToken: string): Promise<SuspensionNotice | null> {
  try {
    const res = await fetch(getApiUrl('/api/auth/me'), {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
    });
    if (res.status !== 403) return null;
    const body = await res.json().catch(() => null);
    return readSuspension((body as { detail?: unknown } | null)?.detail);
  } catch {
    return null;
  }
}

export default function AuthCallbackPage() {
  const navigate = useNavigate();

  useEffect(() => {
    const handleCallback = async () => {
      const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
      const queryParams = new URLSearchParams(window.location.search);
      const recoveryType = readAuthLinkType();
      const nextPath = normalizeNextPath(queryParams.get('next') || consumeOAuthNextPath());
      const recoveryToken =
        hashParams.get('access_token') ||
        queryParams.get('access_token') ||
        queryParams.get('token');

      if (isPasswordResetAuthType(recoveryType) && recoveryToken) {
        navigate(`/reset-password?token=${encodeURIComponent(recoveryToken)}`, { replace: true });
        return;
      }

      if (!supabase) {
        navigate('/login', { replace: true });
        return;
      }

      const pkceCode = queryParams.get('code');
      let session = null as Awaited<ReturnType<typeof supabase.auth.getSession>>['data']['session'];

      if (pkceCode) {
        const { data: exchanged, error: exchangeError } = await supabase.auth.exchangeCodeForSession(pkceCode);
        if (exchangeError || !exchanged?.session) {
          navigate('/login', { replace: true });
          return;
        }
        session = exchanged.session;
      } else {
        const { data, error } = await supabase.auth.getSession();
        if (isPasswordResetAuthType(recoveryType) && data?.session?.access_token) {
          navigate(`/reset-password?token=${encodeURIComponent(data.session.access_token)}`, { replace: true });
          return;
        }
        if (error || !data.session) {
          navigate('/login', { replace: true });
          return;
        }
        session = data.session;
      }

      if (isPasswordResetAuthType(recoveryType) && session?.access_token) {
        navigate(`/reset-password?token=${encodeURIComponent(session.access_token)}`, { replace: true });
        return;
      }

      setAuthToken(session.access_token);

      const suspension = await fetchSuspension(session.access_token);
      if (suspension) {
        clearAuthToken();
        navigate('/login', { replace: true, state: { suspension } });
        return;
      }

      // Scenario F: Google sign-in never calls /api/auth/login,
      // so an administrator's status is checked separately here.
      const mfaStatus = await fetchMfaStatus(session.access_token);
      if (mfaStatus && needsAdminVerification(mfaStatus)) {
        setPendingAdminVerification({
          accessToken: session.access_token,
          hasMfaLinked: Boolean(mfaStatus.has_mfa_linked),
          factorId: mfaStatus.factor_id,
        });
        navigate('/admin-verify', { replace: true });
        return;
      }

      const googleName = String(
        session.user.user_metadata?.full_name || session.user.user_metadata?.name || '',
      ).trim();
      rememberGoogleName(googleName);

      let avatarUrl = String(session.user.user_metadata?.avatar_url || '');
      let fullName = googleName || session.user.email?.split('@')[0] || '';
      let bio = '';
      let interests: string[] = [];
      let username: string | undefined;

      try {
        const profileRes = await fetch(getApiUrl(API_ENDPOINTS.PROFILE_ME), {
          headers: { Authorization: `Bearer ${session.access_token}`, Accept: 'application/json' },
        });
        const profileData = await profileRes.json().catch(() => ({} as Record<string, unknown>));
        const p = (profileData.data || profileData.user || profileData) as Record<string, unknown>;
        avatarUrl = String(p.avatar_url || avatarUrl);
        fullName = String(p.full_name || p.name || fullName);
        bio = String(p.bio || '');
        interests = Array.isArray(p.interests) ? (p.interests as string[]) : [];
        username = typeof p.username === 'string' ? p.username : undefined;

        if (/googleusercontent|ggpht\.com/i.test(avatarUrl)) {
          const defaultIcon = pickDefaultIconUrl();
          avatarUrl = defaultIcon;
          if (hasChosenUsername(username)) {
            await fetch(getApiUrl(API_ENDPOINTS.PROFILE_ME), {
              method: 'PUT',
              headers: {
                Authorization: `Bearer ${session.access_token}`,
                'Content-Type': 'application/json',
                Accept: 'application/json',
              },
              body: JSON.stringify({ avatar_url: defaultIcon }),
            });
          }
        }
      } catch {
        /* use metadata defaults */
      }

      setCurrentUserFromOAuth({
        id: session.user.id,
        email: session.user.email || '',
        name: fullName,
        username,
        avatar: avatarUrl,
        bio,
        interests,
      });

      const dest = destinationAfterSignIn(username, mfaStatus?.role ?? null);
      navigate(dest === '/home' ? nextPath : dest, { replace: true });
    };

    void handleCallback();
  }, [navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <p className="text-muted-foreground text-sm">Signing you in...</p>
    </div>
  );
}

import { useEffect, useState, useCallback } from 'react';
import { getAuthToken } from '@/lib/auth';
import { checkAdminVerified } from '@/lib/adminApi';

export function useAdminAuth() {
  const [isVerifiedAdmin, setIsVerifiedAdmin] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const check = useCallback(async () => {
    const token = getAuthToken();
    if (!token) {
      setIsVerifiedAdmin(false);
      setIsLoading(false);
      return;
    }

    try {
      const res = await checkAdminVerified();
      setIsVerifiedAdmin(Boolean(res.isVerifiedAdmin));
    } catch {
      setIsVerifiedAdmin(false);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void check();

    const onUserUpdated = () => void check();
    window.addEventListener('eventapp:user-updated', onUserUpdated);
    return () => {
      window.removeEventListener('eventapp:user-updated', onUserUpdated);
    };
  }, [check]);

  return { isVerifiedAdmin, isLoading, refreshAdminStatus: check };
}
